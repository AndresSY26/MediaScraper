const os = require('os');
const path = require('path');

/**
 * Configuración centralizada del Servidor y Entorno (Vercel Serverless + Render + Local)
 */
const isVercel = Boolean(process.env.VERCEL);
const isRender = Boolean(process.env.RENDER);
const env = process.env.NODE_ENV || 'development';
const isCloud = isVercel || isRender || env === 'production';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 3005,
  env,
  isVercel,
  isRender,
  isCloud,
  maxBodyLimit: process.env.MAX_BODY_LIMIT || (isVercel ? '4mb' : '20mb'),
  scrapeTimeout: Number(process.env.SCRAPE_TIMEOUT_MS) || 12000,
  deepScrapeBudget: Number(process.env.DEEP_SCRAPE_BUDGET_MS) || 25000,
  proxyTimeout: Number(process.env.PROXY_TIMEOUT_MS) || 20000,
  maxScrapeHtmlBytes: Number(process.env.MAX_SCRAPE_HTML_BYTES) || 5 * 1024 * 1024,
  maxZipItems: Number(process.env.MAX_ZIP_ITEMS) || 25,
  maxZipItemBytes: Number(process.env.MAX_ZIP_ITEM_BYTES) || 25 * 1024 * 1024,
  maxZipTotalBytes: Number(process.env.MAX_ZIP_TOTAL_BYTES) || 100 * 1024 * 1024,
  tempDir: path.join(os.tmpdir(), 'mediascraper'),
  enableLocalFsExport: process.env.ENABLE_LOCAL_FS_EXPORT === 'true',
  allowedOrigins,
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxScrape: Number(process.env.RATE_LIMIT_MAX_SCRAPE) || 20,
    maxProxy: Number(process.env.RATE_LIMIT_MAX_PROXY) || 180,
    maxExport: Number(process.env.RATE_LIMIT_MAX_EXPORT) || 10
  }
};
