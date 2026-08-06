/**
 * Servicio cliente para consumo de API HTTP con soporte para Scraping Profundo
 */
export class ApiService {
  static async scrapeUrl(url, isDeepScrape = false) {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, isDeepScrape })
    });
    return { ok: response.ok, data: await response.json() };
  }

  static async exportSelectedItems(targetDirectory, items) {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDirectory, items })
    });
    return { ok: response.ok, data: await response.json() };
  }
}
