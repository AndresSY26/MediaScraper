const axios = require('axios');
const { pipeline } = require('stream');
const config = require('../../config');
const { DEFAULT_USER_AGENT } = require('../../config/constants');
const UrlResolverService = require('../services/urlResolver.service');

/**
 * Controlador para descargas directas seguras con desenvolvimiento de proxy, MIME real y soporte HLS
 */
class DownloadController {
  static async handleDownload(req, res, next) {
    const { url: rawMediaUrl, filename } = req.query;
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
      // Desenvolver /api/proxy?url=... si proviene del reproductor o tarjeta UI y validar anti-SSRF
      const safeMediaUrl = await UrlResolverService.assertSafeTarget(rawMediaUrl);
      const parsedUrl = new URL(safeMediaUrl);
      let originReferer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;

      if (parsedUrl.hostname.includes('phncdn.com') || parsedUrl.hostname.includes('pornhub')) {
        originReferer = 'https://es.pornhub.com/';
      }

      const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': originReferer,
        'Origin': originReferer.slice(0, -1)
      };

      const { type, ext: detectedExt } = UrlResolverService.getMediaTypeAndExt(safeMediaUrl);
      let safeFilename = filename
        ? String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_')
        : `download_${Date.now()}.${detectedExt}`;

      if (!/\.(mp4|webm|ts|mp3|wav|m4a|ogg|jpg|jpeg|png|gif|webp|svg|avif|bmp|ico|tiff)$/i.test(safeFilename)) {
        safeFilename += `.${detectedExt || (type === 'video' ? 'mp4' : 'jpg')}`;
      }

      // Si es lista HLS (.m3u8), ensamblar segmentos de mayor calidad dentro del presupuesto de tiempo
      if (/\.m3u8(\?|$)/i.test(safeMediaUrl)) {
        return await DownloadController.streamHlsSegments(safeMediaUrl, safeFilename, headers, res, abortController.signal);
      }

      const response = await axios({
        method: 'get',
        url: safeMediaUrl,
        responseType: 'stream',
        headers,
        timeout: config.proxyTimeout,
        signal: abortController.signal,
        validateStatus: (status) => status >= 200 && status < 400,
        beforeRedirect: (opts) => {
          if (opts && opts.href) UrlResolverService.validatePublicHttpUrl(opts.href);
        }
      });

      const contentType = response.headers['content-type'] || (type === 'video' ? 'video/mp4' : 'application/octet-stream');
      const encodedName = encodeURIComponent(safeFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Content-Type', contentType);

      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      pipeline(response.data, res, (pipeErr) => {
        if (pipeErr && pipeErr.code !== 'ERR_STREAM_PREMATURE_CLOSE' && !abortController.signal.aborted) {
          if (config.env !== 'test') {
            console.warn('[Download pipeline]:', pipeErr.message);
          }
        }
      });
    } catch (err) {
      if (abortController.signal.aborted || res.headersSent) return;
      if (err.status === 400 || err.status === 403) {
        return next(err);
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return res.status(504).json({ error: 'Tiempo de espera agotado al descargar el recurso.', status: 504 });
      }
      return res.status(502).json({ error: 'Error en la descarga del archivo multimedia remoto.', status: 502 });
    } finally {
      req.off('close', onClientClose);
    }
  }

  static selectBestVariantFromMaster(masterContent, masterUrl) {
    const lines = String(masterContent || '').split('\n').map(l => l.trim());
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
    let bestUrl = null;
    let bestScore = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
        const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const pixels = resMatch ? parseInt(resMatch[1], 10) * parseInt(resMatch[2], 10) : 0;
        const score = pixels > 0 ? pixels : bandwidth;

        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j]) continue;
          if (lines[j].startsWith('#')) break;
          const resolved = UrlResolverService.resolveUrl(lines[j], baseUrl);
          if (resolved && score > bestScore) {
            bestScore = score;
            bestUrl = resolved;
          }
          break;
        }
      }
    }

    return bestUrl || masterUrl;
  }

  static async streamHlsSegments(m3u8Url, filename, headers, res, abortSignal) {
    const startTime = Date.now();
    const maxHlsBudgetMs = config.isVercel ? 48000 : 120000;
    const maxSegments = config.isVercel ? 80 : 300;

    try {
      const resMaster = await axios.get(m3u8Url, {
        headers,
        timeout: 12000,
        maxContentLength: 2 * 1024 * 1024,
        signal: abortSignal
      });
      const masterData = String(resMaster.data || '');

      let indexPlaylistUrl = m3u8Url;
      if (masterData.includes('#EXT-X-STREAM-INF')) {
        const candidateVariant = this.selectBestVariantFromMaster(masterData, m3u8Url);
        indexPlaylistUrl = await UrlResolverService.assertSafeTarget(candidateVariant);
      }

      const resIndex = await axios.get(indexPlaylistUrl, {
        headers,
        timeout: 12000,
        maxContentLength: 2 * 1024 * 1024,
        signal: abortSignal
      });

      const baseUrl = indexPlaylistUrl.substring(0, indexPlaylistUrl.lastIndexOf('/') + 1);
      const segmentUrls = [];
      for (const rawLine of String(resIndex.data || '').split('\n')) {
        const line = rawLine.trim();
        if (line && !line.startsWith('#')) {
          const resolvedSeg = UrlResolverService.resolveUrl(line, baseUrl);
          if (resolvedSeg && !resolvedSeg.startsWith('data:')) {
            segmentUrls.push(resolvedSeg);
          }
        }
      }

      if (segmentUrls.length === 0) {
        return res.status(502).json({ error: 'No se encontraron segmentos válidos en la transmisión HLS.', status: 502 });
      }

      const tsFilename = filename.replace(/\.mp3$/i, '.mp4');
      const encodedName = encodeURIComponent(tsFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${tsFilename}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Content-Type', 'video/mp2t');

      const boundedSegments = segmentUrls.slice(0, maxSegments);
      for (const segUrl of boundedSegments) {
        if (abortSignal?.aborted || res.writableEnded || res.destroyed) break;
        if (Date.now() - startTime > maxHlsBudgetMs) break;

        try {
          const segResponse = await axios.get(segUrl, {
            headers,
            responseType: 'arraybuffer',
            timeout: 10000,
            maxContentLength: 15 * 1024 * 1024,
            signal: abortSignal
          });

          if (segResponse.data && !res.writableEnded) {
            res.write(Buffer.from(segResponse.data));
          }
        } catch (segErr) {
          if (abortSignal?.aborted) break;
        }
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      if (abortSignal?.aborted || res.headersSent) return;
      return res.status(502).json({ error: 'Error ensamblando segmentos de video HLS.', status: 502 });
    }
  }
}

module.exports = DownloadController;
