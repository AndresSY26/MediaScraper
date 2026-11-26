/**
 * Constantes globales del sistema y reglas de validación
 */

const UNSUPPORTED_SOCIAL_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'instagr.am',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'facebook.com',
  'fb.com',
  'fb.watch'
];

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_URL_LENGTH = 2048;
const MAX_DATA_URI_LENGTH = 65536;

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const VIDEO_EXTENSIONS_REGEX = /\.(mp4|webm|ogg|mov|m4v|m3u8|flv|avi)(\?|$)/i;
const IMAGE_EXTENSIONS_REGEX = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|tiff)(\?|$)/i;

module.exports = {
  UNSUPPORTED_SOCIAL_DOMAINS,
  ALLOWED_PROTOCOLS,
  MAX_URL_LENGTH,
  MAX_DATA_URI_LENGTH,
  DEFAULT_USER_AGENT,
  VIDEO_EXTENSIONS_REGEX,
  IMAGE_EXTENSIONS_REGEX
};
