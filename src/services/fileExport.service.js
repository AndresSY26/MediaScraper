const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

/**
 * Servicio para exportar y guardar archivos en el sistema local
 */
class FileExportService {
  static async exportItemsToDirectory(targetDirectory, items) {
    let resolvedDir = path.resolve(targetDirectory.trim());
    
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }

    let savedCount = 0;
    let failedCount = 0;
    const results = [];

    for (const item of items) {
      try {
        const safeName = item.filename.replace(/[^a-zA-Z0-9_\.-]/g, '_');
        const destPath = path.join(resolvedDir, safeName);

        const writer = fs.createWriteStream(destPath);
        const response = await axios({
          url: item.url,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent': DEFAULT_USER_AGENT
          },
          timeout: 20000
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        savedCount++;
        results.push({ filename: safeName, status: 'success', path: destPath });
      } catch (itemErr) {
        failedCount++;
        results.push({ filename: item.filename, status: 'failed', error: itemErr.message });
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
