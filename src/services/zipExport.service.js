const archiver = require('archiver');
const axios = require('axios');
const { PassThrough } = require('stream');
const config = require('../../config');
const { DEFAULT_USER_AGENT } = require('../../config/constants');
const UrlResolverService = require('./urlResolver.service');

/**
 * Servicio para empaquetar y transmitir archivos multimedia en formato ZIP mediante streams seguros
 */
class ZipExportService {
  /**
   * Genera y transmite un archivo ZIP con control de memoria, presupuesto de tiempo y cancelación limpia
   */
  static async streamZip(items, req, res) {
    const boundedItems = items.slice(0, config.maxZipItems);
    const startTime = Date.now();
    const maxExecutionBudgetMs = config.isVercel ? 45000 : 90000;
    let totalBytesStreamed = 0;
    let clientClosed = false;
    const activeAbortController = new AbortController();

    const onClientClose = () => {
      if (!res.writableEnded) {
        clientClosed = true;
        activeAbortController.abort();
      }
    };
    if (req && typeof req.on === 'function') {
      req.on('close', onClientClose);
    }

    const archive = archiver('zip', {
      zlib: { level: 5 }
    });

    archive.on('warning', (warn) => {
      if (warn.code !== 'ENOENT') {
        console.warn('[ZIP Warning]:', warn.message);
      }
    });

    archive.on('error', (err) => {
      console.error('[ZIP Error]:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Fallo al comprimir el archivo ZIP' });
      } else if (!res.writableEnded) {
        res.destroy(err);
      }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="MediaScraper_Paquete_${Date.now()}.zip"`);
    res.setHeader('Cache-Control', 'no-store');

    archive.pipe(res);

    try {
      for (let i = 0; i < boundedItems.length; i++) {
        if (clientClosed || res.destroyed || res.writableEnded) {
          archive.abort();
          return;
        }

        if (Date.now() - startTime > maxExecutionBudgetMs) {
          console.warn('[ZIP Budget]: Tiempo máximo alcanzado; cerrando paquete con elementos procesados.');
          break;
        }

        if (totalBytesStreamed >= config.maxZipTotalBytes) {
          console.warn('[ZIP Budget]: Límite de tamaño máximo alcanzado.');
          break;
        }

        const item = boundedItems[i] || {};
        const rawCandidate = item.url || item.proxyUrl;
        if (!rawCandidate) continue;

        const safeFilename = `${i + 1}_${String(item.filename || 'recurso.bin').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

        // Soporte limpio para imágenes inline data:image/*
        if (typeof rawCandidate === 'string' && rawCandidate.startsWith('data:image/')) {
          if (UrlResolverService.isSafeDataImageUri(rawCandidate)) {
            const base64Part = rawCandidate.split(',')[1] || '';
            const buf = Buffer.from(base64Part, 'base64');
            totalBytesStreamed += buf.length;
            archive.append(buf, { name: safeFilename });
          }
          continue;
        }

        try {
          const safeUrl = await UrlResolverService.assertSafeTarget(rawCandidate);
          const parsedTarget = new URL(safeUrl);
          const response = await axios({
            method: 'get',
            url: safeUrl,
            responseType: 'stream',
            headers: {
              'User-Agent': DEFAULT_USER_AGENT,
              'Referer': `${parsedTarget.protocol}//${parsedTarget.hostname}/`
            },
            timeout: 12000,
            maxContentLength: config.maxZipItemBytes,
            signal: activeAbortController.signal,
            validateStatus: (status) => status >= 200 && status < 400
          });

          const pass = new PassThrough();
          let itemBytes = 0;

          await new Promise((resolve) => {
            const cleanupStream = () => {
              if (response.data && typeof response.data.destroy === 'function') {
                response.data.destroy();
              }
            };

            response.data.on('data', (chunk) => {
              itemBytes += chunk.length;
              totalBytesStreamed += chunk.length;
              if (itemBytes > config.maxZipItemBytes || totalBytesStreamed > config.maxZipTotalBytes) {
                cleanupStream();
                pass.end();
                resolve();
              }
            });

            response.data.on('error', () => {
              pass.end();
              resolve();
            });

            pass.on('end', resolve);
            pass.on('close', resolve);
            pass.on('error', () => resolve());

            archive.append(pass, { name: safeFilename });
            response.data.pipe(pass);
          });
        } catch (err) {
          if (clientClosed) break;
          console.warn(`No se pudo agregar al ZIP el archivo (${i + 1}): ${err.message}`);
        }
      }

      if (!clientClosed && !res.destroyed) {
        await archive.finalize();
      }
    } finally {
      if (req && typeof req.off === 'function') {
        req.off('close', onClientClose);
      }
    }
  }
}

module.exports = ZipExportService;
