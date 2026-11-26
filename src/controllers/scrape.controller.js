const config = require('../../config');
const SocialDomainService = require('../services/socialDomain.service');
const ScraperService = require('../services/scraper.service');
const UrlResolverService = require('../services/urlResolver.service');

/**
 * Controlador de peticiones de scraping con validación anti-SSRF y presupuesto de tiempo
 */
class ScrapeController {
  static async handleScrape(req, res, next) {
    try {
      const { url, isDeepScrape } = req.body || {};

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Debes proporcionar una URL válida.', status: 400 });
      }

      // Tomar la primera URL limpia si el usuario pega múltiples líneas
      const firstCandidate = url
        .split(/[\n,]/)
        .map(u => u.trim())
        .find(Boolean);

      if (!firstCandidate) {
        return res.status(400).json({ error: 'Debes proporcionar una URL válida.', status: 400 });
      }

      let targetUrl = firstCandidate;
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      // 1. Validación sintáctica y de seguridad (bloquea file://, javascript:, localhost, IPs privadas)
      const parsed = UrlResolverService.validatePublicHttpUrl(targetUrl);
      targetUrl = parsed.href;

      // 2. Validar dominio de redes sociales restringidas
      const socialCheck = SocialDomainService.checkSocialMediaDomain(targetUrl);
      if (socialCheck.isSocial) {
        return res.json({
          isSocialMedia: true,
          domain: socialCheck.domain,
          message: 'Aún no tenemos soporte para extracción directa en redes sociales cerradas (YouTube, Instagram, X/Twitter, TikTok, Facebook).'
        });
      }

      // 3. Scraping con presupuesto máximo alineado al entorno
      const result = await ScraperService.scrapeMediaFromUrl(targetUrl, Boolean(isDeepScrape), {
        budgetMs: config.deepScrapeBudget
      });

      return res.json({
        success: true,
        isSocialMedia: false,
        url: result.finalUrl,
        domain: result.domain,
        title: result.pageTitle,
        hasMainVideo: result.hasMainVideo || false,
        mainVideo: result.mainVideo || null,
        isDirectVideoPage: result.isDirectVideoPage || false,
        stats: result.stats,
        items: result.items
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ScrapeController;
