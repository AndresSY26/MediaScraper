export const CDN_LIBRARIES = {
  TFJS: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js',
  MOBILENET: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
  TESSERACT: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  HLS: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'
};

export const CLIENT_LIMITS = {
  SCRAPE_TIMEOUT_MS: 45000,
  ZIP_TIMEOUT_MS: 90000,
  MAX_AUDIO_DECODE_BYTES: 75 * 1024 * 1024
};
