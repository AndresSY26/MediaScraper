const path = require('path');
const net = require('net');
const dns = require('dns');
const { URL } = require('url');
const {
  ALLOWED_PROTOCOLS,
  MAX_URL_LENGTH,
  MAX_DATA_URI_LENGTH,
  VIDEO_EXTENSIONS_REGEX,
  IMAGE_EXTENSIONS_REGEX
} = require('../../config/constants');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data'
]);

const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

/**
 * Servicio centralizado de validación anti-SSRF, resolución y normalización de URLs
 */
class UrlResolverService {
  /**
   * Si se recibe una ruta relativa /api/proxy?url=..., extrae la URL remota real
   */
  static unwrapProxyUrl(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return '';
    let current = rawInput.trim();

    for (let depth = 0; depth < 3; depth++) {
      if (current.startsWith('/api/proxy') || current.includes('/api/proxy?')) {
        try {
          const parsedProxy = new URL(current, 'http://localhost');
          const inner = parsedProxy.searchParams.get('url');
          if (inner) {
            current = inner.trim();
            continue;
          }
        } catch (e) {
          break;
        }
      }
      break;
    }

    return current;
  }

  /**
   * Determina si una dirección IPv4 o IPv6 pertenece a rangos privados, loopback, link-local o reservados
   */
  static isPrivateOrReservedIp(ipString) {
    if (!ipString || typeof ipString !== 'string') return true;
    const normalized = ipString.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
    const version = net.isIP(normalized);

    if (version === 4) {
      const parts = normalized.split('.').map(Number);
      if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
      const [a, b, c] = parts;

      if (a === 0) return true;                                  // 0.0.0.0/8
      if (a === 10) return true;                                 // 10.0.0.0/8
      if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64.0.0/10 (CGNAT)
      if (a === 127) return true;                                // 127.0.0.0/8 (Loopback)
      if (a === 169 && b === 254) return true;                   // 169.254.0.0/16 (Link-local / Cloud Metadata)
      if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16.0.0/12
      if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
      if (a === 192 && b === 168) return true;                   // 192.168.0.0/16
      if (a === 198 && (b === 18 || b === 19)) return true;      // 198.18.0.0/15
      if (a === 198 && b === 51 && c === 100) return true;       // TEST-NET-2
      if (a === 203 && b === 0 && c === 113) return true;        // TEST-NET-3
      if (a >= 224) return true;                                 // Multicast / Reservado
      return false;
    }

    if (version === 6) {
      if (normalized === '::' || normalized === '::1') return true;
      if (/^(0+:){7}0*[01]$/.test(normalized)) return true;

      // IPv4-mapped IPv6 (::ffff:a.b.c.d o ::ffff:xxxx:yyyy)
      if (normalized.startsWith('::ffff:')) {
        const tail = normalized.slice(7);
        if (net.isIP(tail) === 4) {
          return this.isPrivateOrReservedIp(tail);
        }
        const hexMatch = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hexMatch) {
          const hi = parseInt(hexMatch[1], 16);
          const lo = parseInt(hexMatch[2], 16);
          const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return this.isPrivateOrReservedIp(ipv4);
        }
        return true;
      }

      if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;    // fc00::/7 (Unique Local)
      if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;    // fe80::/10 (Link-Local)
      if (normalized.startsWith('ff')) return true;              // ff00::/8 (Multicast)
      if (normalized.startsWith('2001:db8:')) return true;       // Documentación
      return false;
    }

    return true;
  }

  /**
   * Valida sincrónicamente sintaxis, protocolo HTTP(S), puerto y hostname contra SSRF directo
   */
  static validatePublicHttpUrl(rawUrl) {
    const unwrapped = this.unwrapProxyUrl(rawUrl);
    if (!unwrapped) {
      const err = new Error('Debes proporcionar una URL válida.');
      err.status = 400;
      throw err;
    }

    if (unwrapped.length > MAX_URL_LENGTH) {
      const err = new Error('La URL excede la longitud máxima permitida.');
      err.status = 400;
      throw err;
    }

    let parsed;
    try {
      parsed = new URL(unwrapped);
    } catch (e) {
      const err = new Error('Formato de URL inválido.');
      err.status = 400;
      throw err;
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      const err = new Error('Solo se permiten enlaces con protocolo HTTP o HTTPS.');
      err.status = 400;
      throw err;
    }

    if (parsed.username || parsed.password) {
      const err = new Error('No se permiten credenciales incrustadas en la URL.');
      err.status = 400;
      throw err;
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      !hostname ||
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      (!hostname.includes('.') && !net.isIP(hostname))
    ) {
      const err = new Error('Acceso bloqueado a dominios internos o locales.');
      err.status = 403;
      throw err;
    }

    if (net.isIP(hostname) && this.isPrivateOrReservedIp(hostname)) {
      const err = new Error('Acceso bloqueado a direcciones IP privadas o reservadas.');
      err.status = 403;
      throw err;
    }

    if (parsed.port) {
      const portNum = Number(parsed.port);
      const allowedPorts = new Set([80, 443, 8080, 8443]);
      if (!allowedPorts.has(portNum)) {
        const err = new Error(`Puerto de destino no permitido (${portNum}).`);
        err.status = 403;
        throw err;
      }
    }

    return parsed;
  }

  /**
   * Valida asíncronamente la URL incluyendo resolución DNS para prevenir DNS Rebinding hacia IPs internas
   */
  static async assertSafeTarget(rawUrl) {
    const parsed = this.validatePublicHttpUrl(rawUrl);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    if (!net.isIP(hostname)) {
      let records;
      try {
        records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
      } catch (dnsErr) {
        const err = new Error(`No se pudo resolver el dominio solicitado (${hostname}).`);
        err.status = 400;
        throw err;
      }

      if (!Array.isArray(records) || records.length === 0) {
        const err = new Error(`El dominio (${hostname}) no tiene registros DNS válidos.`);
        err.status = 400;
        throw err;
      }

      for (const rec of records) {
        if (this.isPrivateOrReservedIp(rec.address)) {
          const err = new Error('Acceso denegado: el dominio resuelve hacia una red privada o interna.');
          err.status = 403;
          throw err;
        }
      }
    }

    return parsed.href;
  }

  static isSafeDataImageUri(uri) {
    if (!uri || typeof uri !== 'string') return false;
    if (uri.length > MAX_DATA_URI_LENGTH) return false;
    return SAFE_DATA_IMAGE_REGEX.test(uri.trim());
  }

  static resolveUrl(relativeUrl, baseUrl) {
    if (!relativeUrl || typeof relativeUrl !== 'string') return null;

    let cleanUrl = relativeUrl.trim();
    if (!cleanUrl) return null;

    const lower = cleanUrl.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('vbscript:') ||
      lower.startsWith('file:') ||
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:') ||
      lower.startsWith('blob:') ||
      lower.startsWith('about:')
    ) {
      return null;
    }

    if (lower.startsWith('data:')) {
      return this.isSafeDataImageUri(cleanUrl) ? cleanUrl : null;
    }

    if (cleanUrl.startsWith('//')) {
      cleanUrl = 'https:' + cleanUrl;
    }

    try {
      const resolved = new URL(cleanUrl, baseUrl);
      this.validatePublicHttpUrl(resolved.href);
      return resolved.href;
    } catch (e) {
      return null;
    }
  }

  static getFilenameFromUrl(mediaUrl, defaultExt = 'bin', index = 1) {
    const safeExt = String(defaultExt || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
    if (!mediaUrl || typeof mediaUrl !== 'string' || mediaUrl.startsWith('data:')) {
      return `media_inline_${index}.${safeExt}`;
    }

    try {
      const parsed = new URL(mediaUrl);
      const pathname = parsed.pathname;
      let basename = path.posix.basename(pathname);

      if (!basename || basename.indexOf('.') === -1 || basename.length > 60) {
        const cleanHost = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        return `media_${cleanHost}_${index}.${safeExt}`;
      }

      basename = basename.split('?')[0].split('#')[0];
      basename = basename.replace(/[^a-zA-Z0-9_.-]/g, '_');

      return basename || `media_${index}.${safeExt}`;
    } catch (e) {
      return `media_${index}.${safeExt}`;
    }
  }

  static getMediaTypeAndExt(urlStr, tagType = 'image') {
    if (!urlStr || typeof urlStr !== 'string') {
      return { type: tagType === 'video' ? 'video' : 'image', ext: tagType === 'video' ? 'mp4' : 'jpg' };
    }

    const lower = urlStr.toLowerCase();

    if (lower.startsWith('data:image/')) {
      const mimeMatch = lower.match(/^data:image\/([a-z0-9+]+);/);
      let ext = mimeMatch ? mimeMatch[1] : 'png';
      if (ext === 'svg+xml') ext = 'svg';
      if (ext === 'jpeg') ext = 'jpg';
      return { type: 'image', ext };
    }

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
