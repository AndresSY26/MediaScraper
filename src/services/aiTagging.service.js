/**
 * Servicio de Inteligencia & Clasificación Automática de Archivos Multimedia
 */
class AITaggingService {
  /**
   * Genera etiquetas inteligentes, categorías y nivel de resolución para un elemento multimedia
   */
  static enrichItem(item) {
    const tags = [];
    const lowerFilename = (item.filename || '').toLowerCase();
    const lowerAlt = (item.alt || '').toLowerCase();
    const lowerContext = (item.context || '').toLowerCase();
    const lowerUrl = (item.url || '').toLowerCase();
    const ext = (item.extension || '').toLowerCase();

    // 1. Clasificación por tipo de contenido y contexto
    if (lowerFilename.includes('logo') || lowerAlt.includes('logo') || lowerContext.includes('logo')) {
      tags.push('Logo / Identidad');
    }
    if (lowerFilename.includes('icon') || lowerAlt.includes('icon') || ext === 'svg') {
      tags.push('Icono / Vector');
    }
    if (lowerFilename.includes('banner') || lowerFilename.includes('hero') || lowerAlt.includes('banner')) {
      tags.push('Banner / Portada');
    }
    if (lowerFilename.includes('screenshot') || lowerFilename.includes('capture') || lowerAlt.includes('captura')) {
      tags.push('Captura de Pantalla');
    }

    // Tecnología & Hardware Keywords
    if (/gpu|nvidia|rtx|amd|radeon|intel|processor|cpu|hardware|chip/i.test(lowerUrl + lowerAlt + lowerFilename)) {
      tags.push('Hardware & Componentes');
    }
    if (/ai|robot|tech|machine|neural|cyber|code|software|app/i.test(lowerUrl + lowerAlt + lowerFilename)) {
      tags.push('Tecnología & IA');
    }
    if (/car|moto|electric|auto|vehicle|drive/i.test(lowerUrl + lowerAlt + lowerFilename)) {
      tags.push('Motor & Vehículos');
    }

    // 2. Clasificación de formato
    if (item.type === 'video') {
      tags.push('Video Web');
    } else if (ext === 'webp' || ext === 'avif') {
      tags.push('Formato Web Moderno');
    } else if (ext === 'gif') {
      tags.push('Animación GIF');
    }

    // Si no hay etiquetas específicas, asignar etiqueta genérica basada en tipo
    if (tags.length === 0) {
      tags.push(item.type === 'video' ? 'Contenido Audiovisual' : 'Imagen Web');
    }

    return {
      ...item,
      aiTags: tags
    };
  }

  /**
   * Detecta y marca duplicados en una lista de elementos multimedia
   */
  static detectDuplicates(items) {
    const urlMap = new Map();
    return items.map(item => {
      const isDuplicate = urlMap.has(item.url);
      urlMap.set(item.url, true);
      return {
        ...item,
        isDuplicate
      };
    });
  }
}

module.exports = AITaggingService;
