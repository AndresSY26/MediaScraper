import { CustomVideoPlayer } from './videoPlayer.component.js';
import { AudioExtractorService } from '../services/audioExtractor.service.js';
import { escapeHtml, sanitizeHref } from '../utils/dom.util.js';

/**
 * Componente Galería Multimedia con sanitización anti-XSS, estados vacíos inteligentes y limpieza de memoria
 */
export class GalleryComponent {
  constructor(onInspectItem, onRetryDeepScrape = null) {
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
    this.onRetryDeepScrape = onRetryDeepScrape;
    this.allItems = [];
    this.selectedIds = new Set();
    this.currentFilter = 'all';
    this.qualityFilter = 'all';
    this.currentSort = 'default';
    this.heroPlayer = null;

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

    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.render();
      });
    });
  }

  setItems(items, stats = { total: 0, images: 0, videos: 0 }, mainVideo = null, isDirectVideoPage = false) {
    this.allItems = Array.isArray(items) ? items : [];
    this.selectedIds.clear();
    this.currentFilter = 'all';
    this.qualityFilter = 'all';
    this.isDirectVideoPage = Boolean(
      isDirectVideoPage || (mainVideo && Array.isArray(mainVideo.qualities) && mainVideo.qualities.length > 0 && this.allItems.length === 0)
    );

    if (this.countAll) this.countAll.textContent = stats?.total ?? this.allItems.length;
    if (this.countImages) this.countImages.textContent = stats?.images ?? 0;
    if (this.countVideos) this.countVideos.textContent = stats?.videos ?? 0;

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
      btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
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
    if (this.heroPlayer) {
      this.heroPlayer.destroy();
      this.heroPlayer = null;
    }

    const heroSection = document.getElementById('mainVideoHeroSection');
    if (!heroSection) return;

    if (!this.isDirectVideoPage || !mainVideo || !Array.isArray(mainVideo.qualities) || mainVideo.qualities.length === 0) {
      heroSection.style.display = 'none';
      heroSection.innerHTML = '';
      return;
    }

    const rawVideoTitle = mainVideo.title || 'Video Extraído';
    const safeVideoTitle = escapeHtml(rawVideoTitle);
    const safeDomain = escapeHtml(mainVideo.domain || '');
    const safePosterUrl = escapeHtml(sanitizeHref(mainVideo.poster || ''));

    const qualitiesRowsHTML = mainVideo.qualities.map(q => {
      const isUltra = (q.width && q.width >= 1920) || (q.height && q.height >= 1080);
      const isHd = (q.width && q.width >= 1280) || (q.height && q.height >= 720);
      const tagClass = isUltra ? 'ultra' : (isHd ? 'hd' : 'sd');
      const safeQuality = escapeHtml(q.quality || 'HD');
      const safeExt = escapeHtml(q.extension || 'MP4');
      const safeDownloadHref = escapeHtml(sanitizeHref(q.downloadUrl));
      const safeDownloadFilename = escapeHtml(q.filename || 'video.mp4');
      const dimsText = (q.width && q.height)
        ? `${escapeHtml(q.width)}×${escapeHtml(q.height)} px`
        : 'Calidad Video Stream';

      return `
        <div class="quality-download-row">
          <div class="quality-info">
            <span class="quality-tag ${tagClass}">
              <i class="ri-video-download-line"></i> ${safeQuality}
            </span>
            <span class="quality-meta">${dimsText} • ${safeExt}</span>
          </div>
          <div class="quality-actions">
            <a href="${safeDownloadHref}" class="btn-quality-download" download="${safeDownloadFilename}">
              <i class="ri-download-2-line"></i> Descargar ${safeQuality}
            </a>
          </div>
        </div>
      `;
    }).join('');

    const bestStreamUrl = mainVideo.bestStreamUrl || '';

    heroSection.innerHTML = `
      <div class="main-video-card">
        <div class="main-video-header">
          <span class="video-badge"><i class="ri-movie-fill"></i> Extractor de Video Principal</span>
          <span class="video-domain-badge"><i class="ri-global-line"></i> ${safeDomain}</span>
        </div>

        <div class="main-video-content-grid">
          <div class="main-video-player-box" id="mainVideoPlayerBox">
            ${bestStreamUrl ? '' : `<img src="${safePosterUrl}" alt="${safeVideoTitle}" style="width: 100%; height: 100%; object-fit: cover;" />`}
          </div>

          <div class="main-video-details-box">
            <h2 class="main-video-title">${safeVideoTitle}</h2>

            <div class="qualities-section-header">
              <span><i class="ri-hd-line"></i> Calidades de Video Disponibles para Descarga Directa:</span>
            </div>

            <div class="qualities-download-list">
              ${qualitiesRowsHTML}

              <div class="quality-download-row audio-row">
                <div class="quality-info">
                  <span class="quality-tag audio"><i class="ri-music-2-fill"></i> Pista de Audio</span>
                  <span class="quality-meta">Decodificar y guardar sólo el audio</span>
                </div>
                <div class="quality-actions">
                  <button type="button" id="heroExtractAudioBtn" class="btn-audio-download">
                    <i class="ri-music-line"></i> Extraer Audio
                  </button>
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
      this.heroPlayer = new CustomVideoPlayer(bestStreamUrl, {
        originalUrl: mainVideo.bestStreamDirectUrl || bestStreamUrl,
        filename: rawVideoTitle
      });
      playerBox.appendChild(this.heroPlayer.getElement());
    }

    const heroExtractAudioBtn = heroSection.querySelector('#heroExtractAudioBtn');
    if (heroExtractAudioBtn) {
      heroExtractAudioBtn.addEventListener('click', async () => {
        const originalHTML = heroExtractAudioBtn.innerHTML;
        heroExtractAudioBtn.disabled = true;
        heroExtractAudioBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Decodificando Audio...';
        try {
          await AudioExtractorService.extractAndDownload(
            mainVideo.bestStreamDirectUrl || bestStreamUrl,
            rawVideoTitle.substring(0, 40)
          );
          heroExtractAudioBtn.innerHTML = '<i class="ri-check-line"></i> ¡Audio Listo!';
        } catch (err) {
          console.warn('Error extrayendo audio:', err);
          heroExtractAudioBtn.innerHTML = '<i class="ri-error-warning-line"></i> Sin pista de audio';
        } finally {
          setTimeout(() => {
            heroExtractAudioBtn.disabled = false;
            heroExtractAudioBtn.innerHTML = originalHTML;
          }, 2400);
        }
      });
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
    labelSpan.innerHTML = '<i class="ri-filter-3-line"></i> Calidades y Formatos:';
    this.qualityFilterGroup.appendChild(labelSpan);

    this.qualityFilterGroup.appendChild(this.createFilterChip('⚡ Todos', 'all', true));

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
    btn.type = 'button';
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
      result.sort((a, b) => String(a.filename || '').localeCompare(String(b.filename || '')));
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
        <div class="direct-video-notice">
          <div class="empty-state-icon"><i class="ri-checkbox-circle-fill"></i></div>
          <h3 class="empty-state-title">Modo Extractor de Video Directo Activado</h3>
          <p class="empty-state-desc">
            El video y sus calidades disponibles fueron extraídos limpiamente. Elige la resolución o extrae el audio en la tarjeta superior para descargar al instante.
          </p>
        </div>
      `;
      this.updateSelectionUI();
      return;
    }

    if (this.allItems.length === 0) {
      this.mediaGrid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon"><i class="ri-radar-line"></i></div>
          <h3 class="empty-state-title">No se detectaron archivos multimedia públicos en esta página</h3>
          <p class="empty-state-desc">
            Algunos sitios renderizan su contenido dinámicamente tras iniciar sesión o en subpáginas internas. Prueba activando el Scraping Profundo para explorar enlaces secundarios.
          </p>
          <button type="button" id="emptyRetryDeepBtn" class="btn-ghost" style="margin-top: 6px; color: var(--accent-cyan);">
            <i class="ri-flashlight-line"></i> Reintentar con Scraping Profundo
          </button>
        </div>
      `;
      const retryBtn = this.mediaGrid.querySelector('#emptyRetryDeepBtn');
      if (retryBtn && this.onRetryDeepScrape) {
        retryBtn.addEventListener('click', () => this.onRetryDeepScrape());
      }
      this.updateSelectionUI();
      return;
    }

    const itemsToRender = this.getFilteredItems();

    if (itemsToRender.length === 0) {
      this.mediaGrid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon"><i class="ri-filter-off-line"></i></div>
          <h3 class="empty-state-title">Sin coincidencias para el filtro seleccionado</h3>
          <p class="empty-state-desc">No hay elementos con la categoría o resolución elegida actualmente.</p>
          <button type="button" id="resetFiltersBtn" class="btn-ghost" style="margin-top: 6px;">
            <i class="ri-refresh-line"></i> Mostrar Todos (${this.allItems.length})
          </button>
        </div>
      `;
      const resetBtn = this.mediaGrid.querySelector('#resetFiltersBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.currentFilter = 'all';
          this.qualityFilter = 'all';
          document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
          if (this.qualityFilterGroup) {
            this.qualityFilterGroup.querySelectorAll('.quality-chip').forEach(c => c.classList.toggle('active', c.dataset.quality === 'all'));
          }
          this.render();
        });
      }
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
        ? `${escapeHtml(item.width)}×${escapeHtml(item.height)}`
        : (item.type === 'video' ? 'VIDEO HD' : 'IMAGEN HD');

      const safeProxySrc = escapeHtml(sanitizeHref(item.proxyUrl));
      const safeExt = escapeHtml(item.extension || '');
      const safeAlt = escapeHtml(item.alt || item.filename || 'Media');
      const safeFilename = escapeHtml(item.filename || 'recurso');
      const safeType = escapeHtml(item.type || 'image');
      const safeContext = escapeHtml(item.context || 'Web');

      let mediaPreviewHTML = '';
      if (item.type === 'video') {
        mediaPreviewHTML = `
          <video src="${safeProxySrc}" muted preload="metadata" style="pointer-events: none;"></video>
          <span class="type-badge video"><i class="ri-video-line"></i> ${safeExt}</span>
          <span class="res-badge"><i class="ri-hd-line"></i> ${resBadgeText}</span>
        `;
      } else {
        mediaPreviewHTML = `
          <img src="${safeProxySrc}" alt="${safeAlt}" loading="lazy" />
          <span class="type-badge"><i class="ri-image-line"></i> ${safeExt}</span>
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
            <div class="file-name" title="${safeFilename}">${safeFilename}</div>
            <div class="file-meta">
              <span class="meta-tag-pill ${safeType}">${safeType.toUpperCase()}</span>
              <span class="meta-context-pill">${safeContext}</span>
            </div>
          </div>
          <div class="card-inspect-hint">
            <i class="ri-side-bar-line"></i> Ver detalles e información
          </div>
        </div>
      `;

      const imgEl = card.querySelector('img');
      if (imgEl) {
        imgEl.addEventListener('error', () => {
          imgEl.src = fallbackSvg;
        }, { once: true });
      }

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
