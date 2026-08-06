const path = require('path');
const { URL } = require('url');
const { VIDEO_EXTENSIONS_REGEX, IMAGE_EXTENSIONS_REGEX } = require('../../config/constants');

/**
 * Servicio para formateo, resolución y limpieza de URLs y nombres de archivo
 */
class UrlResolverService {
  static resolveUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return null;
    
    let cleanUrl = relativeUrl.trim();
    if (cleanUrl.startsWith('//')) {
      cleanUrl = 'https:' + cleanUrl;
    }
    
    try {
      return new URL(cleanUrl, baseUrl).href;
    } catch (e) {
      return null;
    }
  }

  static getFilenameFromUrl(mediaUrl, defaultExt = 'bin', index = 1) {
    try {
      const parsed = new URL(mediaUrl);
      const pathname = parsed.pathname;
      let basename = path.basename(pathname);
      
      if (!basename || basename.indexOf('.') === -1 || basename.length > 60) {
        const cleanHost = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        return `media_${cleanHost}_${index}.${defaultExt}`;
      }
      
      basename = basename.split('?')[0].split('#')[0];
      basename = basename.replace(/[^a-zA-Z0-9_\.-]/g, '_');
      
      return basename || `media_${index}.${defaultExt}`;
    } catch (e) {
      return `media_${index}.${defaultExt}`;
    }
  }

  static getMediaTypeAndExt(urlStr, tagType = 'image') {
    const lower = urlStr.toLowerCase();
    
    if (VIDEO_EXTENSIONS_REGEX.test(lower)) {
      const match = lower.match(VIDEO_EXTENSIONS_REGEX);
      return { type: 'video', ext: match ? match[1] : 'mp4' };
    }
    
    if (IMAGE_EXTENSIONS_REGEX.test(lower)) {
      const match = lower.match(IMAGE_EXTENSIONS_REGEX);
      let ext = match ? match[1] : 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      return { type: 'image', ext };
    }

    if (tagType === 'video') return { type: 'video', ext: 'mp4' };
    return { type: 'image', ext: 'jpg' };
  }
}

module.exports = UrlResolverService;
