const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const axios = require('axios');
const config = require('../../config');
const { DEFAULT_USER_AGENT } = require('../../config/constants');
const UrlResolverService = require('./urlResolver.service');

/**
 * Servicio para exportar archivos confinando estrictamente a /tmp/mediascraper en entornos cloud/serverless
 */
class FileExportService {
  static resolveSafeExportDirectory(requestedDirectory) {
    if (!config.enableLocalFsExport) {
      const err = new Error(
        'La escritura directa en carpetas del servidor está deshabilitada por seguridad. Usa la opción "Descargar Paquete ZIP" para guardar en tu dispositivo.'
      );
      err.status = 403;
      throw err;
    }

    const rawDir = String(requestedDirectory || 'export').trim();

    // En Vercel, Render o producción, confinar SIEMPRE dentro de /tmp/mediascraper sin permitir traversal
    if (config.isCloud || config.isVercel) {
      const sanitizedFolder = path.basename(rawDir.replace(/\\/g, '/')).replace(/[^a-zA-Z0-9_.-]/g, '_') || 'batch';
      const safeTmpDir = path.resolve(config.tempDir, sanitizedFolder);
      if (!safeTmpDir.startsWith(path.resolve(config.tempDir))) {
        const err = new Error('Ruta temporal inválida.');
        err.status = 400;
        throw err;
      }
      return safeTmpDir;
    }

    return path.resolve(rawDir);
  }

  static async exportItemsToDirectory(targetDirectory, items) {
    const resolvedDir = this.resolveSafeExportDirectory(targetDirectory);
    await fs.promises.mkdir(resolvedDir, { recursive: true });

    const boundedItems = items.slice(0, config.maxZipItems);
    let savedCount = 0;
    let failedCount = 0;
    const results = [];

    for (let i = 0; i < boundedItems.length; i++) {
      const item = boundedItems[i] || {};
      const fallbackName = `recurso_${i + 1}.bin`;
      const rawName = path.basename(String(item.filename || fallbackName).replace(/\\/g, '/'));
      const safeName = `${i + 1}_${rawName.replace(/[^a-zA-Z0-9_.-]/g, '_') || fallbackName}`;
      const destPath = path.join(resolvedDir, safeName);

      try {
        const safeUrl = await UrlResolverService.assertSafeTarget(item.url || item.proxyUrl);
        const response = await axios({
          url: safeUrl,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent': DEFAULT_USER_AGENT
          },
          timeout: config.proxyTimeout,
          maxContentLength: config.maxZipItemBytes,
          maxBodyLength: config.maxZipItemBytes
        });

        await pipeline(response.data, fs.createWriteStream(destPath));

        savedCount++;
        results.push({ filename: safeName, status: 'success', path: destPath });
      } catch (itemErr) {
        failedCount++;
        await fs.promises.rm(destPath, { force: true }).catch(() => {});
        results.push({ filename: safeName, status: 'failed', error: itemErr.message });
      }
    }

    return {
      savedCount,
      failedCount,
      targetDirectory: resolvedDir,
      results
    };
  }
}

module.exports = FileExportService;
