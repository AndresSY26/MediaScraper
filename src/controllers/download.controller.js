const axios = require('axios');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

/**
 * Controlador para descargas individuales directas
 */
class DownloadController {
  static async handleDownload(req, res, next) {
    const { url: mediaUrl, filename } = req.query;
    if (!mediaUrl) return res.status(400).send('URL requerida');

    const safeFilename = filename ? filename.replace(/[^a-zA-Z0-9_\.-]/g, '_') : 'media_file';

    try {
      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }

      response.data.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DownloadController;
