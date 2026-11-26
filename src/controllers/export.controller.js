const FileExportService = require('../services/fileExport.service');
const ZipExportService = require('../services/zipExport.service');

/**
 * Controlador para exportación segura en servidor (/tmp) y descarga comprimida en ZIP streaming
 */
class ExportController {
  static async handleExport(req, res, next) {
    try {
      const { targetDirectory, items } = req.body || {};

      if (!targetDirectory || typeof targetDirectory !== 'string') {
        return res.status(400).json({ error: 'Debes especificar una ruta de carpeta válida.', status: 400 });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No hay elementos seleccionados para exportar.', status: 400 });
      }

      const result = await FileExportService.exportItemsToDirectory(targetDirectory, items);

      return res.json({
        success: true,
        savedCount: result.savedCount,
        failedCount: result.failedCount,
        targetDirectory: result.targetDirectory,
        results: result.results
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleZipExport(req, res, next) {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No hay elementos seleccionados para comprimir.', status: 400 });
      }

      await ZipExportService.streamZip(items, req, res);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExportController;
