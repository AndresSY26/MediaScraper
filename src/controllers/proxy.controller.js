const axios = require('axios');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

/**
 * Controlador para streaming proxy de multimedia con soporte para HTTP Range Requests (Byte Serving)
 * Permite reproducciones instantáneas, búfer rápido y navegación fluida sin congelamientos en videos largos.
 */
class ProxyController {
  static async handleProxy(req, res, next) {
    const mediaUrl = req.query.url;
    if (!mediaUrl) return res.status(400).send('URL requerida');

    try {      const parsedUrl = new URL(mediaUrl);
      let originReferer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;

      if (parsedUrl.hostname.includes('phncdn.com') || parsedUrl.hostname.includes('pornhub')) {
        originReferer = 'https://es.pornhub.com/';
      }      const requestHeaders = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': originReferer,
        'Origin': originReferer.slice(0, -1)
      };

      if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
      }

      // Si es un manifiesto HLS (.m3u8), reescribir URLs relativas para que pasen por el proxy
      if (mediaUrl.includes('.m3u8')) {
        const m3u8Res = await axios.get(mediaUrl, {
          headers: requestHeaders,
          timeout: 15000,
          responseType: 'text'
        });

        const baseUrl = mediaUrl.substring(0, mediaUrl.lastIndexOf('/') + 1);
        const lines = (m3u8Res.data || '').split('\n');
        const rewritten = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          let absUrl = trimmed;
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            absUrl = new URL(trimmed, baseUrl).href;
          }
          return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(rewritten);
      }

      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers: requestHeaders,
        timeout: 25000,
        validateStatus: (status) => status >= 200 && status < 400
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

      response.data.pipe(res);

      req.on('close', () => {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      });

    } catch (err) {
      if (res.headersSent) return;
      console.error('Proxy stream error:', err.message);
      res.status(500).send('Error en la transmisión de medios proxy');
    }
  }
}

module.exports = ProxyController;
