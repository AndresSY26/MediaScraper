const { URL } = require('url');
const { UNSUPPORTED_SOCIAL_DOMAINS } = require('../../config/constants');

/**
 * Servicio para validación y detección de dominios de redes sociales restringidos
 */
class SocialDomainService {
  static checkSocialMediaDomain(urlString) {
    if (!urlString || typeof urlString !== 'string') {
      return { isValid: false, isSocial: false, domain: null };
    }

    try {
      const parsed = new URL(urlString.trim());
      const host = parsed.hostname.toLowerCase();

      for (const domain of UNSUPPORTED_SOCIAL_DOMAINS) {
        if (host === domain || host.endsWith('.' + domain)) {
          return {
            isValid: true,
            isSocial: true,
            domain
          };
        }
      }

      return {
        isValid: true,
        isSocial: false,
        domain: host
      };
    } catch (err) {
      return {
        isValid: false,
        isSocial: false,
        domain: null
      };
    }
  }
}

module.exports = SocialDomainService;
