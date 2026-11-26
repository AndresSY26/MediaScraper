import { CLIENT_LIMITS } from '../config/constants.js';

/**
 * Servicio cliente para consumo resiliente de API HTTP compatible con respuestas Serverless
 */
export class ApiService {
  static async parseSafeResponse(response) {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        return { ok: response.ok, status: response.status, data: json };
      } catch (e) {
        // Fallback si el JSON está truncado
      }
    }

    const rawText = await response.text().catch(() => '');
    let friendlyError = 'Error inesperado al procesar la respuesta del servidor.';
    if (response.status === 504) {
      friendlyError = 'El sitio objetivo tardó demasiado en responder (Tiempo límite agotado). Intenta desactivar el Scraping Profundo.';
    } else if (response.status === 413) {
      friendlyError = 'La solicitud excede el tamaño máximo permitido por el servidor.';
    } else if (response.status === 429) {
      friendlyError = 'Demasiadas solicitudes seguidas. Espera unos segundos antes de volver a intentar.';
    } else if (response.status >= 500) {
      friendlyError = 'El servidor encontró un problema temporal al conectar con la página solicitada.';
    } else if (rawText) {
      friendlyError = rawText.slice(0, 180);
    }

    return {
      ok: false,
      status: response.status,
      data: { error: friendlyError, status: response.status }
    };
  }

  static async scrapeUrl(url, isDeepScrape = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_LIMITS.SCRAPE_TIMEOUT_MS);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, isDeepScrape }),
        signal: controller.signal
      });
      return await this.parseSafeResponse(response);
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          ok: false,
          status: 504,
          data: { error: 'La extracción superó el tiempo máximo de espera. Prueba sin Scraping Profundo.' }
        };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
