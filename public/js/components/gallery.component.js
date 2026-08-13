import { CustomVideoPlayer } from './videoPlayer.component.js';

/**
 * Componente Galería de Contenidos Multimedia con Generador Dinámico de Filtros Basado en los Resultados Reales Extraídos
 */
export class GalleryComponent {
  constructor(onInspectItem) {
    this.mediaGrid = document.getElementById('mediaGrid');
    this.countAll = document.getElementById('countAll');
    this.countImages = document.getElementById('countImages');
    this.countVideos = document.getElementById('countVideos');
    this.selectedCountBadge = document.getElementById('selectedCountBadge');
    this.openExportModalBtn = document.getElementById('openExportModalBtn');
    this.selectAllBtn = document.getElementById('selectAllBtn');
    this.deselectAllBtn = document.getElementById('deselectAllBtn');
    this.sortSelect = document.getElementById('sortSelect');
    this.qualityFilterGroup = document.getElementById('qualityFilterGroup');

    this.onInspectItem = onInspectItem;
    this.allItems = [];
    this.selectedIds = new Set();
    this.currentFilter = 'all';
    this.qualityFilter = 'all';
    this.currentSort = 'default';

    this.initEvents();
  }

  initEvents() {
    if (this.selectAllBtn) {
      this.selectAllBtn.addEventListener('click', () => this.selectAllVisible());
    }
    if (this.deselectAllBtn) {
      this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
    }

    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', () => {
        this.currentSort = this.sortSelect.value;
        this.render();
      });
    }

    // Category Tabs
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.render();
      });
    });
  }

  setItems(items, stats, mainVideo, isDirectVideoPage = false) {
    this.allItems = items || [];
    this.selectedIds.clear();
    this.qualityFilter = 'all';
    this.isDirectVideoPage = Boolean(isDirectVideoPage || (mainVideo && mainVideo.qualities && mainVideo.qualities.length > 0 && items.length === 0));

    if (this.countAll) this.countAll.textContent = stats.total;
    if (this.countImages) this.countImages.textContent = stats.images;
    if (this.countVideos) this.countVideos.textContent = stats.videos;

    const actionsBar = document.querySelector('.actions-bar');
    const subActionsBar = document.querySelector('.sub-actions-bar');

    if (this.isDirectVideoPage) {
      if (actionsBar) actionsBar.style.display = 'none';
      if (subActionsBar) subActionsBar.style.display = 'none';
    } else {
      if (actionsBar) actionsBar.style.display = 'flex';
      if (subActionsBar) subActionsBar.style.display = 'flex';
    }

    document.querySelectorAll('.tab-item').forEach(btn => {
      if (btn.dataset.filter === this.currentFilter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderMainVideoHero(mainVideo);
    if (!this.isDirectVideoPage) {
      this.renderDynamicQualityFilters();
    } else if (this.qualityFilterGroup) {
      this.qualityFilterGroup.innerHTML = '';
    }
    this.render();
  }
  renderMainVideoHero(mainVideo) {
    const heroSection = document.getElementById('mainVideoHeroSection');
    if (!heroSection) return;

    if (!mainVideo || !mainVideo.qualities || mainVideo.qualities.length === 0) {
      heroSection.style.display = 'none';
      heroSection.innerHTML = '';
      return;
    }

    const videoTitle = mainVideo.title || 'Video Extraído';
    const posterUrl = mainVideo.poster || '';

    const qualitiesRowsHTML = mainVideo.qualities.map(q => {
      const isUltra = (q.width && q.width >= 1920) || (q.height && q.height >= 1080);
      const isHd = (q.width && q.width >= 1280) || (q.height && q.height >= 720);
      const tagClass = isUltra ? 'ultra' : (isHd ? 'hd' : 'sd');

      return `
        <div class="quality-download-row">
          <div class="quality-info">
            <span class="quality-tag ${tagClass}">
              <i class="ri-video-download-line"></i> ${q.quality}
            </span>
            <span class="quality-meta">${q.width && q.height ? `${q.width}×${q.height} px` : 'Calidad Video Stream'} • ${q.extension || 'MP4'}</span>
          </div>
          <div class="quality-actions">
            <a href="${q.downloadUrl}" class="btn-quality-download" download="${q.filename}">
              <i class="ri-download-2-line"></i> Descargar ${q.quality}
            </a>
          </div>
        </div>
      `;
    }).join('');

    const bestStreamUrl = mainVideo.bestStreamUrl || '';
    const audioDownloadUrl = `/api/download?url=${encodeURIComponent(mainVideo.bestStreamDirectUrl || bestStreamUrl)}&filename=${encodeURIComponent(videoTitle.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '_') + '_audio.mp3')}`;

    heroSection.innerHTML = `
      <div class="main-video-card">
        <div class="main-video-header">
          <span class="video-badge"><i class="ri-movie-fill"></i> Extractor de Video Principal</span>
          <span class="video-domain-badge"><i class="ri-global-line"></i> ${mainVideo.domain || ''}</span>
        </div>
        
        <div class="main-video-content-grid">
          <div class="main-video-player-box" id="mainVideoPlayerBox">
            ${bestStreamUrl ? '' : `<img src="${posterUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`}
          </div>
          
          <div class="main-video-details-box">
            <h2 class="main-video-title">${videoTitle}</h2>
            
            <div class="qualities-section-header">
              <span><i class="ri-hd-line"></i> Calidades de Video Disponibles para Descarga Directa:</span>
            </div>

            <div class="qualities-download-list">
              ${qualitiesRowsHTML}

              <!-- Audio MP3 Option -->
              <div class="quality-download-row audio-row">
                <div class="quality-info">
                  <span class="quality-tag audio"><i class="ri-music-2-fill"></i> Audio MP3</span>
                  <span class="quality-meta">Extraer sólo la pista de audio</span>
                </div>
                <div class="quality-actions">
                  <a href="${audioDownloadUrl}" class="btn-audio-download" download>
                    <i class="ri-music-line"></i> Extraer Audio (.MP3)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const playerBox = heroSection.querySelector('#mainVideoPlayerBox');
    if (playerBox && bestStreamUrl) {
      playerBox.innerHTML = '';
      const player = new CustomVideoPlayer(bestStreamUrl);
      playerBox.appendChild(player.getElement());
    }

    heroSection.style.display = 'block';
  }

  renderDynamicQualityFilters() {
    if (!this.qualityFilterGroup) return;
    this.qualityFilterGroup.innerHTML = '';

    if (this.allItems.length === 0) return;

    let count4k = 0;
    let count1080p = 0;
    let count720p = 0;
    const formatMap = new Map();

    this.allItems.forEach(item => {
      const w = item.width || 0;
      const h = item.height || 0;
      const ext = (item.extension || '').toUpperCase();

      if (w >= 3840 || h >= 2160) count4k++;
      else if (w >= 1920 || h >= 1080) count1080p++;
      else if (w >= 1280 || h >= 720) count720p++;

      if (ext) {
        formatMap.set(ext, (formatMap.get(ext) || 0) + 1);
      }
    });

    const labelSpan = document.createElement('span');
    labelSpan.style.cssText = 'font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-right: 6px;';
    labelSpan.innerHTML = '<i class="ri-filter-3-line"></i> Calidades y Formatos Detectados:';
    this.qualityFilterGroup.appendChild(labelSpan);

    const allChip = this.createFilterChip('⚡ Todos', 'all', true);
    this.qualityFilterGroup.appendChild(allChip);

    if (count4k > 0) {
      this.qualityFilterGroup.appendChild(this.createFilterChip(`💎 4K Ultra HD (${count4k})`, '4k'));
    }
    if (count1080p > 0) {
      this.qualityFilterGroup.appendChild(this.createFilterChip(`🖥️ Full HD (${count1080p})`, '1080p'));
    }
    if (count720p > 0) {
      this.qualityFilterGroup.appendChild(this.createFilterChip(`📺 720p HD (${count720p})`, '720p'));
    }

    formatMap.forEach((count, ext) => {
      let icon = '📄';
      if (ext === 'SVG') icon = '🎨';
      if (ext === 'GIF') icon = '🎞️';
      if (ext === 'MP4' || ext === 'WEBM') icon = '🎬';
      if (ext === 'WEBP' || ext === 'PNG' || ext === 'JPG' || ext === 'JPEG') icon = '🖼️';

      this.qualityFilterGroup.appendChild(this.createFilterChip(`${icon} ${ext} (${count})`, `ext_${ext}`));
    });
  }

  createFilterChip(text, filterVal, isActive = false) {
    const btn = document.createElement('button');
    btn.className = `quality-chip ${isActive ? 'active' : ''}`;
    btn.textContent = text;
    btn.dataset.quality = filterVal;

    btn.addEventListener('click', () => {
      this.qualityFilterGroup.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      this.qualityFilter = filterVal;
      this.render();
    });

    return btn;
  }

  getFilteredItems() {
    let result = [...this.allItems];

    if (this.currentFilter !== 'all') {
      result = result.filter(item => item.type === this.currentFilter);
    }

    if (this.qualityFilter === '4k') {
      result = result.filter(item => (item.width && item.width >= 3840) || (item.height && item.height >= 2160));
    } else if (this.qualityFilter === '1080p') {
      result = result.filter(item => (item.width && item.width >= 1920) || (item.height && item.height >= 1080));
    } else if (this.qualityFilter === '720p') {
      result = result.filter(item => (item.width && item.width >= 1280) || (item.height && item.height >= 720));
    } else if (this.qualityFilter.startsWith('ext_')) {
      const targetExt = this.qualityFilter.replace('ext_', '');
      result = result.filter(item => (item.extension || '').toUpperCase() === targetExt);
    }

    if (this.currentSort === 'res-desc') {
      result.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
    } else if (this.currentSort === 'res-asc') {
      result.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
    } else if (this.currentSort === 'name-asc') {
      result.sort((a, b) => a.filename.localeCompare(b.filename));
    }

    return result;
  }

  getSelectedItems() {
    return this.allItems.filter(item => this.selectedIds.has(item.id));
  }

  render() {
    this.mediaGrid.innerHTML = '';

    if (this.isDirectVideoPage) {
      this.mediaGrid.innerHTML = `
        <div style="grid-column: 1 / -1; background: var(--bg-surface); border: 1px solid var(--border-cyan); border-radius: var(--radius-md); padding: 36px 24px; text-align: center; box-shadow: 0 0 25px rgba(6, 182, 212, 0.12);">
          <div style="font-size: 42px; color: var(--accent-cyan); margin-bottom: 12px;"><i class="ri-checkbox-circle-fill"></i></div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #ffffff; margin-bottom: 8px;">Modo Extractor de Video Directo Activado</h3>
          <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 580px; margin: 0 auto; line-height: 1.5;">
            El video y sus calidades (4K Ultra HD, Full HD, HD, SD y Audio MP3) fueron extraídos limpiamente sin basura ni imágenes de la página. Elige la resolución deseada en la tarjeta superior para iniciar la descarga inmediata.
          </p>
        </div>
      `;
      this.updateSelectionUI();
      return;
    }

    const itemsToRender = this.getFilteredItems();

    if (itemsToRender.length === 0) {
      this.mediaGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
          <div style="font-size: 40px; margin-bottom: 12px;"><i class="ri-folder-open-line"></i></div>
          <p>No se encontraron archivos con el filtro de calidad o formato seleccionado.</p>
        </div>
      `;
      this.updateSelectionUI();
      return;
    }
    const fallbackSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='14'%3ESin Vista Previa%3C/text%3E%3C/svg%3E";

    itemsToRender.forEach((item, index) => {
      const card = document.createElement('div');
      const isSelected = this.selectedIds.has(item.id);
      card.className = `media-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = item.id;

      card.style.animationDelay = `${Math.min(index * 0.04, 0.4)}s`;

      const resBadgeText = (item.width && item.height) 
        ? `${item.width}×${item.height}`
        : (item.type === 'video' ? 'VIDEO HD' : 'IMAGEN HD');

      let mediaPreviewHTML = '';
      if (item.type === 'video') {
        mediaPreviewHTML = `
          <video src="${item.proxyUrl}" muted preload="metadata" style="pointer-events: none;"></video>
          <span class="type-badge video"><i class="ri-video-line"></i> ${item.extension}</span>
          <span class="res-badge"><i class="ri-hd-line"></i> ${resBadgeText}</span>
        `;
      } else {
        mediaPreviewHTML = `
          <img src="${item.proxyUrl}" alt="${item.alt || item.filename}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';"/>
          <span class="type-badge"><i class="ri-image-line"></i> ${item.extension}</span>
          <span class="res-badge">${resBadgeText}</span>
        `;
      }

      card.innerHTML = `
        <div class="select-overlay">
          <label class="custom-checkbox-wrapper" title="Seleccionar para exportación múltiple">
            <input type="checkbox" class="custom-checkbox" ${isSelected ? 'checked' : ''} />
            <span class="checkbox-box"><i class="ri-check-line"></i></span>
          </label>
        </div>
        <div class="media-preview-box" title="Haz clic para inspeccionar detalles y descargar">
          ${mediaPreviewHTML}
        </div>
        <div class="card-info">
          <div class="file-header">
            <div class="file-name" title="${item.filename}">${item.filename}</div>
            <div class="file-meta">
              <span class="meta-tag-pill ${item.type}">${item.type.toUpperCase()}</span>
              <span class="meta-context-pill">${item.context}</span>
            </div>
          </div>
          <div class="card-inspect-hint">
            <i class="ri-side-bar-line"></i> Ver detalles e información
          </div>
        </div>
      `;

      const checkbox = card.querySelector('.custom-checkbox');
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleSelection(item.id, checkbox.checked, card);
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('.custom-checkbox-wrapper')) return;
        if (this.onInspectItem) this.onInspectItem(item);
      });

      this.mediaGrid.appendChild(card);
    });

    this.updateSelectionUI();
  }

  toggleSelection(id, isSelected, cardElement) {
    if (isSelected) {
      this.selectedIds.add(id);
      if (cardElement) cardElement.classList.add('selected');
    } else {
      this.selectedIds.delete(id);
      if (cardElement) cardElement.classList.remove('selected');
    }
    this.updateSelectionUI();
  }

  selectAllVisible() {
    const visibleItems = this.getFilteredItems();
    visibleItems.forEach(item => this.selectedIds.add(item.id));
    this.render();
  }

  deselectAll() {
    this.selectedIds.clear();
    this.render();
  }

  updateSelectionUI() {
    const count = this.selectedIds.size;
    if (this.selectedCountBadge) this.selectedCountBadge.textContent = count;
    if (this.openExportModalBtn) this.openExportModalBtn.disabled = count === 0;
  }
}
