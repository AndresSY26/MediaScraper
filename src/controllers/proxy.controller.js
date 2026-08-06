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

    try {
      // Reenviar encabezados Range si el navegador los solicita (HTTP 206 Partial Content)
      const requestHeaders = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': mediaUrl
      };

      if (req.headers.range) {
        requestHeaders['Range'] = req.headers.range;
      }

      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers: requestHeaders,
        timeout: 20000,
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Establecer código de respuesta (200 OK o 206 Partial Content)
      res.status(response.status);

      // Reenviar encabezados de contenido y streaming por rangos
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

      // Si el servidor de origen no responde accept-ranges, forzarlo para el navegador
      if (!res.getHeader('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      if (!res.getHeader('cache-control')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }

      // Stream continuo de datos de video/imagen hacia el cliente
      response.data.pipe(res);

      req.on('close', () => {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      });

    } catch (err) {
      if (res.headersSent) {
        return;
      }
      res.status(500).send('Error en la transmisión de medios proxy');
    }
  }
}

module.exports = ProxyController;
