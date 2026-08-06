const { ZipArchive } = require('archiver');
const axios = require('axios');
const https = require('https');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Servicio para empaquetar y exportar archivos multimedia en formato ZIP comprimido
 */
class ZipExportService {
  /**
   * Genera y transmite un archivo ZIP con los elementos multimedia hacia la respuesta HTTP
   */
  static async streamZip(items, res) {
    const archive = new ZipArchive({
      zlib: { level: 5 }
    });

    archive.on('error', (err) => {
      console.error('Error en archiver ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Fallo al comprimir el archivo ZIP' });
      }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="MediaScraper_Paquete_${Date.now()}.zip"`);

    archive.pipe(res);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const targetUrl = item.url || item.proxyUrl;

      if (!targetUrl) continue;

      try {
        const response = await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': DEFAULT_USER_AGENT
          },
          httpsAgent,
          timeout: 12000
        });

        const safeFilename = `${i + 1}_${(item.filename || 'recurso').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        archive.append(Buffer.from(response.data), { name: safeFilename });
      } catch (err) {
        console.warn(`No se pudo agregar al ZIP el archivo (${i + 1}): ${targetUrl} - ${err.message}`);
      }
    }

    await archive.finalize();
  }
}

module.exports = ZipExportService;
