const axios = require('axios');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

/**
 * Controlador para descargas individuales directas de alta velocidad e integridad de video (MP4 y HLS)
 */
class DownloadController {
  static async handleDownload(req, res, next) {
    const { url: mediaUrl, filename } = req.query;
    if (!mediaUrl) return res.status(400).send('URL requerida');

    let safeFilename = filename ? filename.replace(/[^a-zA-Z0-9_\.-]/g, '_') : 'video_download.mp4';
    if (!/\.(mp4|webm|mp3|m4a|jpg|png|gif|webp)$/i.test(safeFilename)) {
      safeFilename += '.mp4';
    }

    try {      const parsedUrl = new URL(mediaUrl);
      let originReferer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;

      if (parsedUrl.hostname.includes('phncdn.com') || parsedUrl.hostname.includes('pornhub')) {
        originReferer = 'https://es.pornhub.com/';
      }

      const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': originReferer,
        'Origin': originReferer.slice(0, -1)
      };
      // Si es una lista de reproducción HLS (.m3u8), ensamblar segmentos TS a MP4
      if (mediaUrl.includes('.m3u8')) {
        return await DownloadController.streamHlsAsMp4(mediaUrl, safeFilename, headers, res);
      }

      // Descarga directa (MP4 / WebM / Audio)
      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers,
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 400
      });

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
      }

      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      response.data.pipe(res);

      req.on('close', () => {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      });

    } catch (err) {
      console.error('Error en descarga:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Error en la descarga del archivo multimedia');
      }
    }
  }

  static async streamHlsAsMp4(m3u8Url, filename, headers, res) {
    try {
      // 1. Obtener Master Playlist
      const resMaster = await axios.get(m3u8Url, { headers, timeout: 15000 });
      let masterData = resMaster.data;

      let indexPlaylistUrl = m3u8Url;

      // Si es un Master Playlist, buscar la lista de reproducción de mayor calidad
      if (typeof masterData === 'string' && masterData.includes('#EXT-X-STREAM-INF')) {
        const lines = masterData.split('\n');
        let relativeIndex = '';
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith('#')) {
            relativeIndex = line;
            break;
          }
        }
        if (relativeIndex) {
          const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
          indexPlaylistUrl = new URL(relativeIndex, baseUrl).href;
        }
      }

      // 2. Obtener lista de segmentos TS
      const resIndex = await axios.get(indexPlaylistUrl, { headers, timeout: 15000 });
      const indexLines = resIndex.data.split('\n');
      const segmentUrls = [];

      for (let line of indexLines) {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const baseUrl = indexPlaylistUrl.substring(0, indexPlaylistUrl.lastIndexOf('/') + 1);
          segmentUrls.push(new URL(line, baseUrl).href);
        }
      }

      if (segmentUrls.length === 0) {
        return res.status(500).send('No se pudieron obtener segmentos del video');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'video/mp4');

      // 3. Descargar y transmitir segmentos secuencialmente sin almacenamiento intermedio
      for (const segUrl of segmentUrls) {
        if (res.writableEnded || res.destroyed) break;

        try {
          const segResponse = await axios.get(segUrl, {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000
          });

          if (segResponse.data) {
            res.write(Buffer.from(segResponse.data));
          }
        } catch (segErr) {
          console.warn(`Aviso: Error descargando segmento TS ${segUrl}:`, segErr.message);
        }
      }

      res.end();

    } catch (err) {
      console.error('Error ensamblando HLS a MP4:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Error ensamblando video HLS');
      }
    }
  }
}

module.exports = DownloadController;
