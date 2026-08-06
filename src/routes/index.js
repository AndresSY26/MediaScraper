const express = require('express');
const scrapeRoutes = require('./scrape.routes');
const proxyRoutes = require('./proxy.routes');
const downloadRoutes = require('./download.routes');
const exportRoutes = require('./export.routes');

const router = express.Router();

router.use('/api', scrapeRoutes);
router.use('/api', proxyRoutes);
router.use('/api', downloadRoutes);
router.use('/api', exportRoutes);

module.exports = router;
