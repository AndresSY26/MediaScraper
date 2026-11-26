import { CDN_LIBRARIES } from '../config/constants.js';
import { loadScriptOnce } from '../utils/dom.util.js';

/**
 * Servicio de Visión por Computador con carga diferida (lazy-load) de TensorFlow.js & MobileNet
 */
export class AIVisionService {
  static modelPromise = null;

  static async ensureLibrariesLoaded() {
    if (!window.tf) {
      await loadScriptOnce(CDN_LIBRARIES.TFJS);
    }
    if (!window.mobilenet) {
      await loadScriptOnce(CDN_LIBRARIES.MOBILENET);
    }
  }

  static async loadModel() {
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        await this.ensureLibrariesLoaded();
        if (!window.mobilenet) {
          throw new Error('MobileNet no disponible');
        }
        return await window.mobilenet.load();
      })().catch((err) => {
        // Limpiar promesa rechazada para permitir reintentos futuros si recupera la red
        this.modelPromise = null;
        throw err;
      });
    }
    return this.modelPromise;
  }

  /**
   * Clasifica visualmente los píxeles de un elemento HTMLImageElement
   */
  static async classifyImage(imgElement) {
    try {
      const model = await this.loadModel();
      if (!model) return null;

      const predictions = await model.classify(imgElement);
      if (!predictions || predictions.length === 0) return null;

      return predictions.slice(0, 3).map(pred => {
        const rawLabel = (pred.className || '').toLowerCase();
        const confidence = Math.round((pred.probability || 0) * 100);
        const translatedLabel = this.translateLabel(rawLabel);

        return {
          label: translatedLabel,
          confidence: `${confidence}%`
        };
      });
    } catch (err) {
      console.warn('Clasificación visual IA omitida:', err.message || err);
      return null;
    }
  }

  static translateLabel(raw) {
    if (/laptop|notebook|computer/i.test(raw)) return 'Computador / Laptop';
    if (/keyboard/i.test(raw)) return 'Teclado Tech';
    if (/mouse/i.test(raw)) return 'Mouse / Periférico';
    if (/monitor|screen|display/i.test(raw)) return 'Pantalla / Monitor';
    if (/cellular|mobile|phone/i.test(raw)) return 'Smartphone / Móvil';
    if (/car|vehicle|racer|automobile/i.test(raw)) return 'Auto / Vehículo';
    if (/motorcycle|bike/i.test(raw)) return 'Motocicleta';
    if (/space|shuttle|rocket/i.test(raw)) return 'Cohete / Espacio';
    if (/camera/i.test(raw)) return 'Cámara Fotográfica';
    if (/headphone|earphone/i.test(raw)) return 'Audífonos Tech';
    if (/robot/i.test(raw)) return 'Robot / Automatización';
    if (/cat|tabby|feline/i.test(raw)) return 'Felino / Mascota';
    if (/dog|retriever|canine/i.test(raw)) return 'Canino / Mascota';
    if (/web|site|graphic|chart/i.test(raw)) return 'Gráfico / Interfaz Web';

    return raw.split(',')[0].split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
