const { URL } = require('url');
const { UNSUPPORTED_SOCIAL_DOMAINS } = require('../../config/constants');

/**
 * Servicio para validación y detección de dominios de redes sociales
 */
class SocialDomainService {
  static checkSocialMediaDomain(urlString) {
    try {
      const parsed = new URL(urlString);
      const host = parsed.hostname.toLowerCase();
      
      for (const domain of UNSUPPORTED_SOCIAL_DOMAINS) {
        if (host === domain || host.endsWith('.' + domain)) {
          return {
            isSocial: true,
            domain: domain
          };
        }
      }
    } catch (err) {
      // Si la URL es inválida se ignorará aquí
    }
    return { isSocial: false };
  }
}

module.exports = SocialDomainService;
