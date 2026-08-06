const express = require('express');
const ExportController = require('../controllers/export.controller');

const router = express.Router();

router.post('/export', ExportController.handleExport);
router.post('/export-zip', ExportController.handleZipExport);

module.exports = router;
