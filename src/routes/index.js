const express = require('express');
const config = require('../../config');
const { createRateLimiter } = require('../middlewares/rateLimiter.middleware');
const scrapeRoutes = require('./scrape.routes');
const proxyRoutes = require('./proxy.routes');
const downloadRoutes = require('./download.routes');
const exportRoutes = require('./export.routes');

const router = express.Router();

const scrapeLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxScrape,
  message: 'Has alcanzado el límite temporal de extracciones. Espera unos segundos e intenta de nuevo.'
});

const proxyLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxProxy,
  message: 'Demasiadas peticiones de transmisión simultáneas.'
});

const exportLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxExport,
  message: 'Límite de empaquetado ZIP alcanzado temporalmente. Intenta en unos segundos.'
});

router.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    env: config.env,
    serverless: config.isVercel
  });
});

router.use('/api/scrape', scrapeLimiter);
router.use('/api/proxy', proxyLimiter);
router.use('/api/download', proxyLimiter);
router.use('/api/export', exportLimiter);
router.use('/api/export-zip', exportLimiter);

router.use('/api', scrapeRoutes);
router.use('/api', proxyRoutes);
router.use('/api', downloadRoutes);
router.use('/api', exportRoutes);

module.exports = router;
