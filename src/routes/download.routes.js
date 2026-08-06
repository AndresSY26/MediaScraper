const express = require('express');
const DownloadController = require('../controllers/download.controller');

const router = express.Router();

router.get('/download', DownloadController.handleDownload);

module.exports = router;
