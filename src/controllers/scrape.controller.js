const SocialDomainService = require('../services/socialDomain.service');
const ScraperService = require('../services/scraper.service');

/**
 * Controlador de peticiones de scraping con soporte para Scraping Profundo
 */
class ScrapeController {
  static async handleScrape(req, res, next) {
    try {
      const { url, isDeepScrape } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Debes proporcionar una URL válida.' });
      }

      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      // 1. Validar dominio de redes sociales
      const socialCheck = SocialDomainService.checkSocialMediaDomain(targetUrl);
      if (socialCheck.isSocial) {
        return res.json({
          isSocialMedia: true,
          domain: socialCheck.domain,
          message: 'Aún no tenemos soporte para redes sociales específicas (YouTube, Instagram, X/Twitter, TikTok).'
        });
      }

      // 2. Scraping
      const result = await ScraperService.scrapeMediaFromUrl(targetUrl, Boolean(isDeepScrape));
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
