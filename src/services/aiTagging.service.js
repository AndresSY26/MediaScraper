/**
 * Servicio de Inteligencia & Clasificación Automática de Archivos Multimedia
 */
class AITaggingService {
  /**
   * Genera etiquetas inteligentes y categorías acotando el tamaño de entrada para evitar bloqueos de CPU
   */
  static enrichItem(item) {
    if (!item || typeof item !== 'object') {
      return { aiTags: ['Imagen Web'] };
    }

    const tags = [];
    const lowerFilename = String(item.filename || '').slice(0, 200).toLowerCase();
    const lowerAlt = String(item.alt || '').slice(0, 250).toLowerCase();
    const lowerContext = String(item.context || '').slice(0, 150).toLowerCase();
    const rawUrl = String(item.url || '');
    const lowerUrl = rawUrl.startsWith('data:') ? '' : rawUrl.slice(0, 400).toLowerCase();
    const ext = String(item.extension || '').slice(0, 15).toLowerCase();
    const combinedText = `${lowerUrl} ${lowerAlt} ${lowerFilename}`;

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
    if (/gpu|nvidia|rtx|amd|radeon|intel|processor|cpu|hardware|chip/i.test(combinedText)) {
      tags.push('Hardware & Componentes');
    }
    if (/ai|robot|tech|machine|neural|cyber|code|software|app/i.test(combinedText)) {
      tags.push('Tecnología & IA');
    }
    if (/car|moto|electric|auto|vehicle|drive/i.test(combinedText)) {
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

    // Etiqueta genérica basada en tipo si no hubo coincidencias específicas
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
    if (!Array.isArray(items)) return [];
    const urlMap = new Map();
    return items.map(item => {
      const key = item?.url || '';
      const isDuplicate = Boolean(key && urlMap.has(key));
      if (key) urlMap.set(key, true);
      return {
        ...item,
        isDuplicate
      };
    });
  }
}

module.exports = AITaggingService;
