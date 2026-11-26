import { escapeHtml } from '../utils/dom.util.js';

/**
 * Componente Gestor de Historial de Búsquedas Recientes (localStorage sanitizado contra XSS)
 */
export class HistoryComponent {
  constructor(onSelectHistoryItem) {
    this.historyBtn = document.getElementById('historyDropdownBtn');
    this.historyMenu = document.getElementById('historyMenu');
    this.historyList = document.getElementById('historyList');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.onSelectHistoryItem = onSelectHistoryItem;

    this.STORAGE_KEY = 'media_scraper_history_v1';
    this.initEvents();
    this.render();
  }

  initEvents() {
    if (this.historyBtn) {
      this.historyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.historyMenu.classList.toggle('active');
      });
    }

    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearHistory();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.historyMenu && !this.historyMenu.contains(e.target) && !this.historyBtn?.contains(e.target)) {
        this.historyMenu.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.historyMenu?.classList.contains('active')) {
        this.historyMenu.classList.remove('active');
      }
    });
  }

  getHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  addEntry(url, title, stats) {
    let history = this.getHistory();
    history = history.filter(item => item.url !== url);

    history.unshift({
      url,
      title: title || url,
      stats,
      date: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });

    if (history.length > 12) history = history.slice(0, 12);

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
    this.render();
  }

  clearHistory() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}
    this.render();
  }

  render() {
    if (!this.historyList) return;

    const history = this.getHistory();
    this.historyList.innerHTML = '';

    if (history.length === 0) {
      this.historyList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
          No hay consultas recientes en tu historial.
        </div>
      `;
      return;
    }

    history.forEach(entry => {
      const safeTitle = escapeHtml(entry.title || entry.url || '');
      const safeUrl = escapeHtml(entry.url || '');
      const safeDate = escapeHtml(entry.date || '');
      const imgCount = Number(entry.stats?.images || 0);
      const vidCount = Number(entry.stats?.videos || 0);

      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      itemEl.innerHTML = `
        <div class="history-item-info">
          <div class="history-item-title" title="${safeTitle}">${safeTitle}</div>
          <div class="history-item-url" title="${safeUrl}">${safeUrl}</div>
          <div class="history-item-meta">
            <span><i class="ri-time-line"></i> ${safeDate}</span>
            <span><i class="ri-image-line"></i> ${imgCount} imgs</span>
            <span><i class="ri-video-line"></i> ${vidCount} vids</span>
          </div>
        </div>
        <button type="button" class="history-item-action" title="Reanalizar Sitio Web" aria-label="Reanalizar">
          <i class="ri-arrow-right-line"></i>
        </button>
      `;

      itemEl.addEventListener('click', () => {
        if (this.onSelectHistoryItem && entry.url) {
          this.onSelectHistoryItem(entry.url);
        }
        if (this.historyMenu) this.historyMenu.classList.remove('active');
      });

      this.historyList.appendChild(itemEl);
    });
  }
}
