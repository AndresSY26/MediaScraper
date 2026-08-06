const FileExportService = require('../services/fileExport.service');
const ZipExportService = require('../services/zipExport.service');

/**
 * Controlador para la exportación de archivos a la carpeta local y descarga comprimida en ZIP
 */
class ExportController {
  static async handleExport(req, res, next) {
    try {
      const { targetDirectory, items } = req.body;

      if (!targetDirectory || typeof targetDirectory !== 'string') {
        return res.status(400).json({ error: 'Debes especificar una ruta de carpeta válida.' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No hay elementos seleccionados para exportar.' });
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
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No hay elementos seleccionados para comprimir.' });
      }

      await ZipExportService.streamZip(items, res);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExportController;
