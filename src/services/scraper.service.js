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
    if (!isDeepScrape || mainResult.isDirectVideoPage || !mainResult.internalLinks || mainResult.internalLinks.length === 0) {
      return mainResult;
    }    // Scraping Profundo: Explorar hasta 12 subpáginas internas prioritarias en paralelo
    const deepLinksToCrawl = mainResult.internalLinks.slice(0, 12);
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

    let response;
    try {
      response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000,
        maxRedirects: 5
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`La página o video no existe (Error 404). Verifica que el enlace sea correcto y siga disponible: ${targetUrl}`);
      } else if (error.response && error.response.status === 403) {
        throw new Error(`Acceso denegado (Error 403). La página está bloqueando la extracción automática: ${targetUrl}`);
      }
      throw new Error(`Fallo al acceder a la URL: ${error.message}`);
    }

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

    const isDirectVideoPageRequest = /\/view_video|\/video\/\d+|\/watch\?|\/v\/|\/play\/|viewkey=/i.test(targetUrl);

    const addMediaItem = (rawSrc, tagType = 'image', altText = '', metaContext = '', extraAttrs = {}) => {
      const resolved = UrlResolverService.resolveUrl(rawSrc, finalUrl);
      if (!resolved) return;

      if (resolved.startsWith('data:image/svg+xml;base64') && resolved.length < 150) return;
      if (resolved.includes('1x1') || resolved.includes('pixel.gif') || resolved.includes('spacer.gif')) return;

      if (!mediaSet.has(resolved)) {
        const { type, ext } = UrlResolverService.getMediaTypeAndExt(resolved, tagType);
        const filename = UrlResolverService.getFilenameFromUrl(resolved, ext, counter++);
        
        let width = extraAttrs.width || null;
        let height = extraAttrs.height || null;

        if (type === 'video' && (!width || !height)) {
          const dim = ScraperService.detectDimensionsFromQuality(resolved);
          if (dim.width) width = dim.width;
          if (dim.height) height = dim.height;
        }

        let item = {
          id: 'media_' + Math.random().toString(36).substr(2, 9),
          url: resolved,
          type: type,
          extension: ext.toUpperCase(),
          filename: filename,
          alt: altText ? altText.trim().substring(0, 150) : '',
          context: metaContext || tagType,
          domain: parsedBaseUrl.hostname,
          width: width,
          height: height,
          proxyUrl: `/api/proxy?url=${encodeURIComponent(resolved)}`
        };

        item = AITaggingService.enrichItem(item);
        mediaSet.set(resolved, item);
      }
    };

    // Meta Tags (Poster & Title)
    $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) addMediaItem(content, 'image', 'Poster de Video', 'Meta Video Poster');
    });

    $('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content) addMediaItem(content, 'video', 'Meta Video', 'Meta Tag Video');
    });

    // If NOT a direct video page request, scrape general HTML images, backgrounds, picture elements, and links
    if (!isDirectVideoPageRequest) {
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
    }    // Explicit flashvars & mediaDefinitions JSON extraction for video streaming platforms
    try {
      const flashvarsMatch = html.match(/var\s+flashvars_\d+\s*=\s*({[\s\S]*?});/) || html.match(/flashvars\s*=\s*({[\s\S]*?});/);
      if (flashvarsMatch) {
        const flashvarsObj = JSON.parse(flashvarsMatch[1]);
        if (Array.isArray(flashvarsObj.mediaDefinitions)) {
          flashvarsObj.mediaDefinitions.forEach(mediaDef => {
            if (mediaDef.videoUrl && typeof mediaDef.videoUrl === 'string') {
              const uLower = mediaDef.videoUrl.toLowerCase();
              if (uLower.includes('/get_media') || uLower.includes('/embed/') || uLower.includes('view_video.php')) {
                return; // Skip get_media JSON API endpoints and embed URLs
              }

              const qStr = mediaDef.quality ? `${mediaDef.quality}p` : 'HD';
              const dim = ScraperService.detectDimensionsFromQuality(qStr) || {};
              const resWidth = mediaDef.width || dim.width || null;
              const resHeight = mediaDef.height || dim.height || null;
              
              addMediaItem(
                mediaDef.videoUrl,
                'video',
                `Video Stream (${mediaDef.quality || 'HD'}p)`,
                `Flashvars MediaDefinition (${mediaDef.quality || 'HD'}p)`,
                { width: resWidth, height: resHeight }
              );
            }
          });
        }
      }
    } catch(e) {}

    // Extract Video Streams Embedded in <script> and JS Player Configs (flashvars, mediaDefinitions, HLS/MP4)
    const cleanedHtml = html.replace(/\\\/|\\u002F/g, '/').replace(/&amp;/g, '&');
    const streamRegex = /https?:\/\/[^"'\s\\><]+?\.(mp4|m3u8|webm|flv|mov|m4v)(\?[^"'\s\\><]*)?/gi;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(cleanedHtml)) !== null) {
      const rawUrl = streamMatch[0];
      if (rawUrl.includes('1x1') || rawUrl.includes('pixel') || rawUrl.includes('preview_sprite') || rawUrl.includes('sprite') || rawUrl.includes('/get_media') || rawUrl.includes('/embed/')) continue;

      const { qualityLabel, width, height } = ScraperService.detectDimensionsFromQuality(rawUrl);
      const contextText = qualityLabel ? `Stream de Video (${qualityLabel})` : 'Stream de Video Player/JS';
      addMediaItem(rawUrl, 'video', `Video Stream (${qualityLabel || 'Media'})`, contextText, { width, height });
    }

    // Extract links & collect internal URLs for Deep Scraping (Prioritizing Video Pages)
    const priorityVideoLinks = new Set();
    const otherInternalLinks = new Set();

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
              if (/\/view_video|\/video\/\d+|\/watch|\/v\/|\/play|\/item\/|\/media\//i.test(resolvedLink)) {
                priorityVideoLinks.add(resolvedLink);
              } else {
                otherInternalLinks.add(resolvedLink);
              }
            }
          } catch(e) {}
        }
      }
    });

    const orderedInternalLinks = [...Array.from(priorityVideoLinks), ...Array.from(otherInternalLinks)];

    let items = Array.from(mediaSet.values());
    items = AITaggingService.detectDuplicates(items);

    const imageCount = items.filter(i => i.type === 'image').length;
    const videoCount = items.filter(i => i.type === 'video').length;

    // Detect and Group Main Video with Qualities List
    const videoItems = items.filter(i => {
      if (i.type !== 'video') return false;
      const uLower = (i.url || '').toLowerCase();
      if (uLower.includes('/get_media') || uLower.includes('/embed/') || uLower.includes('view_video.php')) {
        return false;
      }
      return true;
    });
    let mainVideo = null;
    let hasMainVideo = false;

    if (videoItems.length > 0) {
      const posterItem = items.find(i => i.context.toLowerCase().includes('poster') || i.context.toLowerCase().includes('opengraph') || i.type === 'image');
      const posterUrl = posterItem ? posterItem.proxyUrl : null;

      const qualitiesMap = new Map();

      videoItems.forEach(v => {
        const dim = ScraperService.detectDimensionsFromQuality(v.url);
        const qualityKey = dim.qualityLabel || (v.width && v.height ? `${v.height}p` : 'HD');
        
        if (!qualitiesMap.has(qualityKey)) {
          const resWidth = dim.width || v.width || null;
          const resHeight = dim.height || v.height || null;
          const safeFilename = `${pageTitle.substring(0, 50).replace(/[^a-zA-Z0-9_\.-]/g, '_')}_${qualityKey.replace(/[^a-zA-Z0-9]/g, '')}.mp4`;

          qualitiesMap.set(qualityKey, {
            quality: qualityKey,
            label: dim.qualityLabel || `${qualityKey} Video Stream`,
            width: resWidth,
            height: resHeight,
            url: v.url,
            proxyUrl: v.proxyUrl,
            extension: v.extension,
            filename: safeFilename,
            downloadUrl: `/api/download?url=${encodeURIComponent(v.url)}&filename=${encodeURIComponent(safeFilename)}`
          });
        }
      });

      const sortedQualities = Array.from(qualitiesMap.values()).sort((a, b) => {
        const resA = (a.width || 0) * (a.height || 0);
        const resB = (b.width || 0) * (b.height || 0);
        return resB - resA;
      });

      if (sortedQualities.length > 0) {
        hasMainVideo = true;
        mainVideo = {
          title: pageTitle,
          poster: posterUrl || sortedQualities[0].proxyUrl,
          domain: parsedBaseUrl.hostname,
          bestStreamUrl: sortedQualities[0].proxyUrl,
          bestStreamDirectUrl: sortedQualities[0].url,
          qualities: sortedQualities
        };
      }
    }
    const isDirectVideoPage = isDirectVideoPageRequest && hasMainVideo;
    const finalItems = isDirectVideoPage ? [] : items;

    return {
      finalUrl,
      domain: parsedBaseUrl.hostname,
      pageTitle,
      hasMainVideo,
      mainVideo,
      isDirectVideoPage,
      internalLinks: isDirectVideoPage ? [] : orderedInternalLinks,
      stats: {
        total: isDirectVideoPage ? (mainVideo?.qualities?.length || 1) : items.length,
        images: isDirectVideoPage ? 0 : imageCount,
        videos: isDirectVideoPage ? (mainVideo?.qualities?.length || 1) : videoCount
      },
      items: finalItems
    };
  }

  static detectDimensionsFromQuality(urlStr) {
    if (!urlStr) return { qualityLabel: null, width: null, height: null };
    const match = urlStr.match(/(2160p|1080p|720p|480p|360p|240p|180p|4k)/i);
    if (!match) return { qualityLabel: null, width: null, height: null };
    const q = match[1].toLowerCase();
    if (q === '2160p' || q === '4k') return { qualityLabel: '4K Ultra HD 2160p', width: 3840, height: 2160 };
    if (q === '1080p') return { qualityLabel: 'Full HD 1080p', width: 1920, height: 1080 };
    if (q === '720p') return { qualityLabel: 'HD 720p', width: 1280, height: 720 };
    if (q === '480p') return { qualityLabel: 'SD 480p', width: 854, height: 480 };
    if (q === '360p') return { qualityLabel: 'SD 360p', width: 640, height: 360 };
    if (q === '240p') return { qualityLabel: 'SD 240p', width: 426, height: 240 };
    if (q === '180p') return { qualityLabel: 'Low 180p', width: 320, height: 180 };
    return { qualityLabel: `${q.toUpperCase()}`, width: null, height: null };
  }
}

module.exports = ScraperService;
