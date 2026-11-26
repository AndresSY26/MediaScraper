const axios = require('axios');
const { pipeline } = require('stream');
const config = require('../../config');
const { DEFAULT_USER_AGENT } = require('../../config/constants');
const UrlResolverService = require('../services/urlResolver.service');

/**
 * Controlador para streaming proxy de multimedia con soporte HTTP Range Requests y protección anti-SSRF
 */
class ProxyController {
  static async handleProxy(req, res, next) {
    const rawMediaUrl = req.query.url;
    if (!rawMediaUrl || typeof rawMediaUrl !== 'string') {
      return res.status(400).json({ error: 'Parámetro URL requerido.', status: 400 });
    }

    const abortController = new AbortController();
    const onClientClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    req.on('close', onClientClose);

    try {
      const safeMediaUrl = await UrlResolverService.assertSafeTarget(rawMediaUrl);
      const parsedUrl = new URL(safeMediaUrl);
      let originReferer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;

      if (parsedUrl.hostname.includes('phncdn.com') || parsedUrl.hostname.includes('pornhub')) {
        originReferer = 'https://es.pornhub.com/';
      }

      const requestHeaders = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': originReferer,
        'Origin': originReferer.slice(0, -1)
      };

      if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
      }

      // Manifiestos HLS (.m3u8): reescribir segmentos validando cada destino
      if (/\.m3u8(\?|$)/i.test(safeMediaUrl)) {
        const m3u8Res = await axios.get(safeMediaUrl, {
          headers: requestHeaders,
          timeout: Math.min(config.proxyTimeout, 15000),
          maxContentLength: 2 * 1024 * 1024,
          responseType: 'text',
          signal: abortController.signal,
          beforeRedirect: (opts) => {
            if (opts && opts.href) UrlResolverService.validatePublicHttpUrl(opts.href);
          }
        });

        const baseUrl = safeMediaUrl.substring(0, safeMediaUrl.lastIndexOf('/') + 1);
        const lines = String(m3u8Res.data || '').split('\n');
        const rewritten = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const resolvedSeg = UrlResolverService.resolveUrl(trimmed, baseUrl);
          if (!resolvedSeg || resolvedSeg.startsWith('data:')) return '';
          return `/api/proxy?url=${encodeURIComponent(resolvedSeg)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(rewritten);
      }

      const response = await axios({
        method: 'get',
        url: safeMediaUrl,
        responseType: 'stream',
        headers: requestHeaders,
        timeout: config.proxyTimeout,
        signal: abortController.signal,
        validateStatus: (status) => status >= 200 && status < 400,
        beforeRedirect: (opts) => {
          if (opts && opts.href) UrlResolverService.validatePublicHttpUrl(opts.href);
        }
      });

      res.status(response.status);

      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control'
      ];

      headersToForward.forEach(header => {
        if (response.headers[header]) {
          res.setHeader(header, response.headers[header]);
        }
      });

      if (!res.getHeader('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      if (!res.getHeader('cache-control')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }

      pipeline(response.data, res, (pipeErr) => {
        if (pipeErr && pipeErr.code !== 'ERR_STREAM_PREMATURE_CLOSE' && !abortController.signal.aborted) {
          if (config.env !== 'test') {
            console.warn('[Proxy pipeline]:', pipeErr.message);
          }
        }
      });
    } catch (err) {
      if (abortController.signal.aborted || res.headersSent) return;
      if (err.status === 400 || err.status === 403) {
        return next(err);
      }
      if (err.response && (err.response.status === 404 || err.response.status === 403)) {
        return res.status(err.response.status).json({
          error: `El servidor de origen rechazó o no encontró el recurso (${err.response.status}).`,
          status: err.response.status
        });
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return res.status(504).json({ error: 'Tiempo de espera agotado en transmisión proxy.', status: 504 });
      }
      return res.status(502).json({ error: 'Error en la transmisión del recurso remoto.', status: 502 });
    } finally {
      req.off('close', onClientClose);
    }
  }
}

module.exports = ProxyController;
