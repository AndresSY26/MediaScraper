import { CLIENT_LIMITS } from '../config/constants.js';
import { unwrapProxyUrl } from '../utils/dom.util.js';

/**
 * Servicio de extracción real de audio en el navegador mediante Web Audio API (WAV PCM 16-bit)
 * con fallback seguro a descarga de flujo directo para transmisiones HLS o archivos masivos.
 */
export class AudioExtractorService {
  static encodeWavFromAudioBuffer(audioBuffer) {
    const numChannels = Math.min(audioBuffer.numberOfChannels || 1, 2);
    const sampleRate = audioBuffer.sampleRate || 44100;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataByteLength = numFrames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    const writeAscii = (offset, text) => {
      for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    };

    // Cabecera RIFF WAVE estándar
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);               // Subchunk1Size (PCM)
    view.setUint16(20, 1, true);                // AudioFormat (1 = PCM lineal)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);               // BitsPerSample
    writeAscii(36, 'data');
    view.setUint32(40, dataByteLength, true);

    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  static triggerBlobDownload(blob, filename) {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
  }

  static triggerFallbackStreamDownload(rawOriginalUrl, baseName) {
    const cleanUrl = unwrapProxyUrl(rawOriginalUrl);
    if (!cleanUrl) {
      throw new Error('URL de video inválida para extracción de audio.');
    }
    const safeBase = String(baseName || 'audio_extraido').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fallbackFilename = `${safeBase}_audio.m4a`;
    const link = document.createElement('a');
    link.href = `/api/download?url=${encodeURIComponent(cleanUrl)}&filename=${encodeURIComponent(fallbackFilename)}`;
    link.download = fallbackFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /**
   * Extrae y descarga la pista de audio real usando Web Audio API; recurre a descarga limpia si es HLS o muy grande
   */
  static async extractAndDownload(sourceUrl, baseFilename = 'audio_extraido') {
    const originalUrl = unwrapProxyUrl(sourceUrl);
    if (!originalUrl) {
      throw new Error('No se encontró una fuente válida de video.');
    }

    const safeBase = String(baseFilename || 'audio_extraido')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_.-]/g, '_') || 'audio_extraido';

    const isHls = /\.m3u8(\?|$)/i.test(originalUrl);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (isHls || !AudioCtx) {
      this.triggerFallbackStreamDownload(originalUrl, safeBase);
      return { mode: 'fallback' };
    }

    const proxyFetchUrl = sourceUrl.startsWith('/api/proxy')
      ? sourceUrl
      : `/api/proxy?url=${encodeURIComponent(originalUrl)}`;

    const response = await fetch(proxyFetchUrl);
    if (!response.ok) {
      throw new Error('No se pudo obtener el flujo de video para decodificar el audio.');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > CLIENT_LIMITS.MAX_AUDIO_DECODE_BYTES) {
      this.triggerFallbackStreamDownload(originalUrl, safeBase);
      return { mode: 'fallback' };
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > CLIENT_LIMITS.MAX_AUDIO_DECODE_BYTES) {
      this.triggerFallbackStreamDownload(originalUrl, safeBase);
      return { mode: 'fallback' };
    }

    const audioCtx = new AudioCtx();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const wavBlob = this.encodeWavFromAudioBuffer(audioBuffer);
      this.triggerBlobDownload(wavBlob, `${safeBase}.wav`);
      return { mode: 'wav' };
    } finally {
      if (typeof audioCtx.close === 'function') {
        audioCtx.close().catch(() => {});
      }
    }
  }
}
