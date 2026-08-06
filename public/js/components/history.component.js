/**
 * Componente Gestor de Historial de Búsquedas y Colecciones Recientes (localStorage)
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
      if (this.historyMenu && !this.historyMenu.contains(e.target) && e.target !== this.historyBtn) {
        this.historyMenu.classList.remove('active');
      }
    });
  }

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch(e) {
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

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    this.render();
  }

  clearHistory() {
    localStorage.removeItem(this.STORAGE_KEY);
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
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      itemEl.innerHTML = `
        <div class="history-item-info">
          <div class="history-item-title">${entry.title}</div>
          <div class="history-item-url">${entry.url}</div>
          <div class="history-item-meta">
            <span><i class="ri-time-line"></i> ${entry.date}</span>
            <span><i class="ri-image-line"></i> ${entry.stats?.images || 0} imgs</span>
            <span><i class="ri-video-line"></i> ${entry.stats?.videos || 0} vids</span>
          </div>
        </div>
        <button class="history-item-action" title="Reanalizar Sitio Web">
          <i class="ri-arrow-right-line"></i>
        </button>
      `;

      itemEl.addEventListener('click', () => {
        if (this.onSelectHistoryItem) {
          this.onSelectHistoryItem(entry.url);
        }
        if (this.historyMenu) this.historyMenu.classList.remove('active');
      });

      this.historyList.appendChild(itemEl);
    });
  }
}
