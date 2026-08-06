const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const UrlResolverService = require('./urlResolver.service');
const AITaggingService = require('./aiTagging.service');
const { DEFAULT_USER_AGENT } = require('../../config/constants');

/**
 * Servicio principal de Web Scraping con soporte para Scraping Profundo Multinivel (Subpage Crawler)
 */
class ScraperService {
  static async scrapeMediaFromUrl(targetUrl, isDeepScrape = false) {
    const urlList = targetUrl.split(/[\n,]/).map(u => u.trim()).filter(u => u.length > 0);
    const primaryUrl = urlList[0];

    const mainResult = await this.scrapeSinglePage(primaryUrl);
    if (!isDeepScrape || !mainResult.internalLinks || mainResult.internalLinks.length === 0) {
      return mainResult;
    }

    // Scraping Profundo: Explorar hasta 6 subpáginas internas en paralelo
    const deepLinksToCrawl = mainResult.internalLinks.slice(0, 6);
    const mediaSetMap = new Map();

    mainResult.items.forEach(item => mediaSetMap.set(item.url, item));

    await Promise.all(
      deepLinksToCrawl.map(async (subUrl) => {
        try {
          const subResult = await this.scrapeSinglePage(subUrl);
          subResult.items.forEach(item => {
            if (!mediaSetMap.has(item.url)) {
              mediaSetMap.set(item.url, {
                ...item,
                context: `Scraping Profundo: ${item.context}`
              });
            }
          });
        } catch(e) {}
      })
    );

    let allDeepItems = Array.from(mediaSetMap.values());
    allDeepItems = AITaggingService.detectDuplicates(allDeepItems);

    const imageCount = allDeepItems.filter(i => i.type === 'image').length;
    const videoCount = allDeepItems.filter(i => i.type === 'video').length;

    return {
      ...mainResult,
      stats: {
        total: allDeepItems.length,
        images: imageCount,
        videos: videoCount
      },
      items: allDeepItems
    };
  }

  static async scrapeSinglePage(targetUrl) {
    let parsedBaseUrl = new URL(targetUrl);

    // Direct Image or Video URL Detection
    if (/\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|tiff|mp4|webm|ogg|mov|m4v|m3u8)(\?|$)/i.test(targetUrl)) {
      const { type, ext } = UrlResolverService.getMediaTypeAndExt(targetUrl);
      const filename = UrlResolverService.getFilenameFromUrl(targetUrl, ext, 1);
      let directItem = {
        id: 'media_' + Math.random().toString(36).substr(2, 9),
        url: targetUrl,
        type: type,
        extension: ext.toUpperCase(),
        filename: filename,
        alt: 'Direct Media Asset',
        context: 'Enlace Directo Multimedia',
        domain: parsedBaseUrl.hostname,
        width: null,
        height: null,
        proxyUrl: `/api/proxy?url=${encodeURIComponent(targetUrl)}`
      };
      directItem = AITaggingService.enrichItem(directItem);

      return {
        finalUrl: targetUrl,
        domain: parsedBaseUrl.hostname,
        pageTitle: filename,
        internalLinks: [],
        stats: {
          total: 1,
          images: type === 'image' ? 1 : 0,
          videos: type === 'video' ? 1 : 0
        },
        items: [directItem]
      };
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'] || '';
    if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
      const isVid = contentType.startsWith('video/');
      const type = isVid ? 'video' : 'image';
      const ext = isVid ? 'mp4' : 'jpg';
      const filename = UrlResolverService.getFilenameFromUrl(targetUrl, ext, 1);
      let directItem = {
        id: 'media_' + Math.random().toString(36).substr(2, 9),
        url: targetUrl,
        type: type,
        extension: ext.toUpperCase(),
        filename: filename,
        alt: 'Direct Media Asset',
        context: 'Enlace Directo Multimedia',
        domain: parsedBaseUrl.hostname,
        width: null,
        height: null,
        proxyUrl: `/api/proxy?url=${encodeURIComponent(targetUrl)}`
      };
      directItem = AITaggingService.enrichItem(directItem);

      return {
        finalUrl: targetUrl,
        domain: parsedBaseUrl.hostname,
        pageTitle: filename,
        internalLinks: [],
        stats: {
          total: 1,
          images: isVid ? 0 : 1,
          videos: isVid ? 1 : 0
        },
        items: [directItem]
      };
    }

    const html = typeof response.data === 'string' ? response.data : '';
    const finalUrl = response.request?.res?.responseUrl || targetUrl;
    const $ = cheerio.load(html);
    parsedBaseUrl = new URL(finalUrl);

    const pageTitle = $('title').text().trim() || parsedBaseUrl.hostname;
    const mediaSet = new Map();
    const internalLinks = new Set();
    let counter = 1;

    const addMediaItem = (rawSrc, tagType = 'image', altText = '', metaContext = '', extraAttrs = {}) => {
      const resolved = UrlResolverService.resolveUrl(rawSrc, finalUrl);
      if (!resolved) return;

      if (resolved.startsWith('data:image/svg+xml;base64') && resolved.length < 150) return;
      if (resolved.includes('1x1') || resolved.includes('pixel.gif') || resolved.includes('spacer.gif')) return;

      if (!mediaSet.has(resolved)) {
        const { type, ext } = UrlResolverService.getMediaTypeAndExt(resolved, tagType);
        const filename = UrlResolverService.getFilenameFromUrl(resolved, ext, counter++);
        
        let item = {
          id: 'media_' + Math.random().toString(36).substr(2, 9),
          url: resolved,
          type: type,
          extension: ext.toUpperCase(),
          filename: filename,
          alt: altText ? altText.trim().substring(0, 150) : '',
          context: metaContext || tagType,
          domain: parsedBaseUrl.hostname,
          width: extraAttrs.width || null,
          height: extraAttrs.height || null,
          proxyUrl: `/api/proxy?url=${encodeURIComponent(resolved)}`
        };

        item = AITaggingService.enrichItem(item);
        mediaSet.set(resolved, item);
      }
    };

    // Meta Tags
    $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) addMediaItem(content, 'image', 'Meta OpenGraph / Twitter', 'Meta Tag');
    });

    $('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) addMediaItem(content, 'video', 'Meta Video', 'Meta Tag Video');
    });

    // Images
    $('img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || $img.attr('data-lazy-src') || $img.attr('data-url');
      const alt = $img.attr('alt') || $img.attr('title') || '';
      const w = $img.attr('width');
      const h = $img.attr('height');
      
      if (src) addMediaItem(src, 'image', alt, 'Elemento <img>', { width: w, height: h });

      const srcset = $img.attr('srcset') || $img.attr('data-srcset');
      if (srcset) {
        const parts = srcset.split(',');
        for (const part of parts) {
          const srcUrl = part.trim().split(/\s+/)[0];
          if (srcUrl) addMediaItem(srcUrl, 'image', alt, 'Srcset');
        }
      }
    });

    // Picture / Source
    $('picture source').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        const parts = srcset.split(',');
        for (const part of parts) {
          const srcUrl = part.trim().split(/\s+/)[0];
          if (srcUrl) addMediaItem(srcUrl, 'image', 'Fuente Picture', '<picture>');
        }
      }
    });

    // Videos
    $('video').each((_, el) => {
      const $vid = $(el);
      const src = $vid.attr('src');
      const poster = $vid.attr('poster');
      const w = $vid.attr('width');
      const h = $vid.attr('height');

      if (src) addMediaItem(src, 'video', 'Video HTML5', '<video>', { width: w, height: h });
      if (poster) addMediaItem(poster, 'image', 'Poster de Video', 'Video Poster');

      $vid.find('source').each((_, sEl) => {
        const sSrc = $(sEl).attr('src');
        if (sSrc) addMediaItem(sSrc, 'video', 'Fuente Video', '<video source>');
      });
    });

    // Background CSS
    $('[style*="background"]').each((_, el) => {
      const style = $(el).attr('style');
      const matches = style.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
      if (matches) {
        for (const match of matches) {
          const cleanSrc = match.replace(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i, '$1');
          if (cleanSrc) addMediaItem(cleanSrc, 'image', 'Imagen de Fondo CSS', 'Background CSS');
        }
      }
    });

    // Extract links & collect internal URLs for Deep Scraping
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (/\.(png|jpe?g|webp|gif|svg|mp4|webm|ogg|mov)(\?|$)/i.test(href)) {
        addMediaItem(href, /\.(mp4|webm|ogg|mov)(\?|$)/i.test(href) ? 'video' : 'image', 'Enlace directo', 'Enlace <a>');
      } else {
        const resolvedLink = UrlResolverService.resolveUrl(href, finalUrl);
        if (resolvedLink) {
          try {
            const linkUrl = new URL(resolvedLink);
            if (linkUrl.hostname === parsedBaseUrl.hostname && resolvedLink !== finalUrl && !resolvedLink.includes('#')) {
              internalLinks.add(resolvedLink);
            }
          } catch(e) {}
        }
      }
    });

    let items = Array.from(mediaSet.values());
    items = AITaggingService.detectDuplicates(items);

    const imageCount = items.filter(i => i.type === 'image').length;
    const videoCount = items.filter(i => i.type === 'video').length;

    return {
      finalUrl,
      domain: parsedBaseUrl.hostname,
      pageTitle,
      internalLinks: Array.from(internalLinks),
      stats: {
        total: items.length,
        images: imageCount,
        videos: videoCount
      },
      items
    };
  }
}

module.exports = ScraperService;
