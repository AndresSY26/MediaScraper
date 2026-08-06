/**
 * MediaScraper - App Frontend Logic
 * Fullscreen HD Viewer with Zoom, Custom Scrollbars, Remix Icons & Side Drawer
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const scrapeForm = document.getElementById('scrapeForm');
  const urlInput = document.getElementById('urlInput');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  const socialWarningBanner = document.getElementById('socialWarningBanner');
  const socialWarningText = document.getElementById('socialWarningText');
  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorDesc = document.getElementById('errorDesc');

  const resultsSection = document.getElementById('resultsSection');
  const scrapedTitle = document.getElementById('scrapedTitle');
  const scrapedUrlLink = document.getElementById('scrapedUrlLink');
  const mediaGrid = document.getElementById('mediaGrid');

  const countAll = document.getElementById('countAll');
  const countImages = document.getElementById('countImages');
  const countVideos = document.getElementById('countVideos');
  const selectedCountBadge = document.getElementById('selectedCountBadge');

  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const openExportModalBtn = document.getElementById('openExportModalBtn');

  // Side Drawer Elements ("Ventana al Lado")
  const sideDrawer = document.getElementById('sideDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerMediaContainer = document.getElementById('drawerMediaContainer');
  const drawerFilename = document.getElementById('drawerFilename');
  const drawerType = document.getElementById('drawerType');
  const drawerDimensions = document.getElementById('drawerDimensions');
  const drawerContext = document.getElementById('drawerContext');
  const drawerAlt = document.getElementById('drawerAlt');
  const drawerUrlInput = document.getElementById('drawerUrlInput');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const drawerDownloadLink = document.getElementById('drawerDownloadLink');
  const openFullscreenBtn = document.getElementById('openFullscreenBtn');

  // Fullscreen HD Modal & Controls
  const fullscreenModal = document.getElementById('fullscreenModal');
  const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
  const fullscreenMediaContainer = document.getElementById('fullscreenMediaContainer');
  const fsFilename = document.getElementById('fsFilename');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const toggleNativeFSBtn = document.getElementById('toggleNativeFSBtn');

  // Export Modal Elements
  const exportModal = document.getElementById('exportModal');
  const closeExportBtn = document.getElementById('closeExportBtn');
  const cancelExportBtn = document.getElementById('cancelExportBtn');
  const confirmExportBtn = document.getElementById('confirmExportBtn');
  const targetFolderPath = document.getElementById('targetFolderPath');
  const exportCountText = document.getElementById('exportCountText');
  const exportStatusBanner = document.getElementById('exportStatusBanner');
  const exportStatusIcon = document.getElementById('exportStatusIcon');
  const exportStatusTitle = document.getElementById('exportStatusTitle');
  const exportStatusDesc = document.getElementById('exportStatusDesc');

  // State Management
  let allMediaItems = [];
  let selectedMediaIds = new Set();
  let currentFilter = 'all';
  let currentActiveItem = null;
  let currentZoom = 1;

  // Set default export path based on Windows standard
  const defaultPath = 'C:\\Users\\USUARIO\\Downloads\\ScrapedMedia';
  if (targetFolderPath) targetFolderPath.value = defaultPath;

  /* ==========================================
     Theme Management (Dark / Light Mode)
     ========================================== */
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });

  function updateThemeIcon(theme) {
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'ri-moon-clear-line' : 'ri-sun-line';
    }
  }

  /* ==========================================
     Quick Link Chips
     ========================================== */
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      urlInput.value = btn.dataset.url;
      scrapeForm.dispatchEvent(new Event('submit'));
    });
  });

  /* ==========================================
     Form Submission & Scraping Call
     ========================================== */
  scrapeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    hideBanners();
    closeSideDrawer();
    closeFullscreen();
    setLoadingState(true);
    resultsSection.classList.remove('active');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        showErrorBanner('Error de servidor', data.error || 'No se pudo completar la solicitud.');
        setLoadingState(false);
        return;
      }

      if (data.isSocialMedia) {
        showSocialWarning(data.message || 'Aún no tenemos soporte para redes sociales específicas.');
        setLoadingState(false);
        return;
      }

      allMediaItems = data.items || [];
      selectedMediaIds.clear();
      currentFilter = 'all';

      scrapedTitle.textContent = data.title || 'Contenido Extraído';
      scrapedUrlLink.innerHTML = `${data.url} <i class="ri-external-link-line"></i>`;
      scrapedUrlLink.href = data.url;

      countAll.textContent = data.stats.total;
      countImages.textContent = data.stats.images;
      countVideos.textContent = data.stats.videos;

      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab-btn[data-filter="all"]').classList.add('active');

      renderMediaGrid();
      resultsSection.classList.add('active');

    } catch (err) {
      showErrorBanner('Error de Conexión', 'Ocurrió un fallo al comunicarse con el servidor.');
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      scrapeBtn.disabled = true;
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-block';
    } else {
      scrapeBtn.disabled = false;
      btnText.style.display = 'inline-flex';
      btnSpinner.style.display = 'none';
    }
  }

  function hideBanners() {
    socialWarningBanner.style.display = 'none';
    errorBanner.style.display = 'none';
  }

  function showSocialWarning(msg) {
    socialWarningText.textContent = msg;
    socialWarningBanner.style.display = 'flex';
  }

  function showErrorBanner(title, desc) {
    errorTitle.textContent = title;
    errorDesc.textContent = desc;
    errorBanner.style.display = 'flex';
  }

  /* ==========================================
     Filtering & Media Rendering
     ========================================== */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderMediaGrid();
    });
  });

  function getFilteredItems() {
    if (currentFilter === 'all') return allMediaItems;
    return allMediaItems.filter(item => item.type === currentFilter);
  }

  function renderMediaGrid() {
    const itemsToRender = getFilteredItems();
    mediaGrid.innerHTML = '';

    if (itemsToRender.length === 0) {
      mediaGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
          <div style="font-size: 40px; margin-bottom: 12px;"><i class="ri-folder-open-line"></i></div>
          <p>No se encontraron archivos multimedia en esta categoría.</p>
        </div>
      `;
      updateSelectionUI();
      return;
    }

    itemsToRender.forEach(item => {
      const card = document.createElement('div');
      const isSelected = selectedMediaIds.has(item.id);
      card.className = `media-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = item.id;

      let mediaPreviewHTML = '';
      if (item.type === 'video') {
        mediaPreviewHTML = `
          <video src="${item.proxyUrl}" muted preload="metadata" style="pointer-events: none;"></video>
          <span class="type-badge video"><i class="ri-video-line"></i> ${item.extension}</span>
        `;
      } else {
        mediaPreviewHTML = `
          <img src="${item.proxyUrl}" alt="${item.alt || item.filename}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Error+de+Carga';"/>
          <span class="type-badge"><i class="ri-image-line"></i> ${item.extension}</span>
        `;
      }

      card.innerHTML = `
        <div class="select-overlay">
          <label class="custom-checkbox-wrapper">
            <input type="checkbox" class="custom-checkbox" ${isSelected ? 'checked' : ''} />
          </label>
        </div>
        <div class="media-preview-box">
          ${mediaPreviewHTML}
        </div>
        <div class="card-info">
          <div>
            <div class="file-name" title="${item.filename}">${item.filename}</div>
            <div class="file-meta">
              <span>${item.type.toUpperCase()}</span>
              <span>${item.context}</span>
            </div>
          </div>
          <div class="inspect-hint">
            <i class="ri-side-bar-line"></i> Ver detalles en panel
          </div>
        </div>
      `;

      const checkbox = card.querySelector('.custom-checkbox');
      
      // 1. CLIC EN EL CHECK: Selecciona/Deselecciona
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleItemSelection(item.id, checkbox.checked, card);
      });

      // 2. CLIC EN LA TARJETA: Abre Ventana al lado
      card.addEventListener('click', (e) => {
        if (e.target.closest('.custom-checkbox')) return;
        openSideDrawer(item);
      });

      mediaGrid.appendChild(card);
    });

    updateSelectionUI();
  }

  /* ==========================================
     Selection Logic
     ========================================== */
  function toggleItemSelection(id, isSelected, cardElement) {
    if (isSelected) {
      selectedMediaIds.add(id);
      if (cardElement) cardElement.classList.add('selected');
    } else {
      selectedMediaIds.delete(id);
      if (cardElement) cardElement.classList.remove('selected');
    }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const count = selectedMediaIds.size;
    selectedCountBadge.textContent = count;
    openExportModalBtn.disabled = count === 0;
  }

  selectAllBtn.addEventListener('click', () => {
    const visibleItems = getFilteredItems();
    visibleItems.forEach(item => selectedMediaIds.add(item.id));
    renderMediaGrid();
  });

  deselectAllBtn.addEventListener('click', () => {
    selectedMediaIds.clear();
    renderMediaGrid();
  });

  /* ==========================================
     Side Drawer ("Ventana al Lado")
     ========================================== */
  function openSideDrawer(item) {
    currentActiveItem = item;
    drawerMediaContainer.innerHTML = '';
    drawerDimensions.textContent = 'Calculando...';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.proxyUrl;
      video.controls = true;
      video.autoplay = true;
      video.addEventListener('loadedmetadata', () => {
        drawerDimensions.textContent = `${video.videoWidth} x ${video.videoHeight} px`;
      });
      drawerMediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.proxyUrl;
      img.alt = item.filename;
      img.addEventListener('load', () => {
        drawerDimensions.textContent = `${img.naturalWidth} x ${img.naturalHeight} px`;
      });
      img.addEventListener('error', () => {
        drawerDimensions.textContent = 'No disponible';
      });
      drawerMediaContainer.appendChild(img);
    }

    drawerFilename.textContent = item.filename;
    drawerType.textContent = `${item.type.toUpperCase()} (${item.extension})`;
    drawerContext.textContent = item.context || 'Etiqueta Web';
    drawerAlt.textContent = item.alt || 'Sin descripción alt';
    drawerUrlInput.value = item.url;

    drawerDownloadLink.href = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.filename)}`;

    sideDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
  }

  function closeSideDrawer() {
    sideDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
    drawerMediaContainer.innerHTML = '';
  }

  closeDrawerBtn.addEventListener('click', closeSideDrawer);
  drawerOverlay.addEventListener('click', closeSideDrawer);

  drawerMediaContainer.addEventListener('click', () => {
    if (currentActiveItem) openFullscreen(currentActiveItem);
  });

  openFullscreenBtn.addEventListener('click', () => {
    if (currentActiveItem) openFullscreen(currentActiveItem);
  });

  copyUrlBtn.addEventListener('click', () => {
    drawerUrlInput.select();
    navigator.clipboard.writeText(drawerUrlInput.value);
    const originalHTML = copyUrlBtn.innerHTML;
    copyUrlBtn.innerHTML = '<i class="ri-check-line"></i>';
    setTimeout(() => {
      copyUrlBtn.innerHTML = originalHTML;
    }, 1500);
  });

  /* ==========================================
     Fullscreen HD Viewer & Zoom Controls
     ========================================== */
  function openFullscreen(item) {
    fullscreenMediaContainer.innerHTML = '';
    currentZoom = 1;
    applyZoom();

    fsFilename.textContent = item.filename;

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.proxyUrl;
      video.controls = true;
      video.autoplay = true;
      fullscreenMediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.proxyUrl;
      img.alt = item.filename;
      fullscreenMediaContainer.appendChild(img);
    }

    fullscreenModal.classList.add('active');
  }

  function closeFullscreen() {
    fullscreenModal.classList.remove('active');
    fullscreenMediaContainer.innerHTML = '';
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  closeFullscreenBtn.addEventListener('click', closeFullscreen);

  // Zoom Controls
  zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 4) {
      currentZoom += 0.25;
      applyZoom();
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 0.5) {
      currentZoom -= 0.25;
      applyZoom();
    }
  });

  zoomResetBtn.addEventListener('click', () => {
    currentZoom = 1;
    applyZoom();
  });

  function applyZoom() {
    fullscreenMediaContainer.style.transform = `scale(${currentZoom})`;
  }

  // Native Fullscreen toggle
  toggleNativeFSBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Global ESC key shortcut to close overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (fullscreenModal.classList.contains('active')) {
        closeFullscreen();
      } else if (sideDrawer.classList.contains('active')) {
        closeSideDrawer();
      } else if (exportModal.classList.contains('active')) {
        exportModal.classList.remove('active');
      }
    }
  });

  /* ==========================================
     Export Modal (Export to Local Folder)
     ========================================== */
  openExportModalBtn.addEventListener('click', () => {
    if (selectedMediaIds.size === 0) return;
    exportCountText.textContent = `${selectedMediaIds.size} archivo(s)`;
    exportStatusBanner.style.display = 'none';
    confirmExportBtn.disabled = false;
    exportModal.classList.add('active');
  });

  closeExportBtn.addEventListener('click', () => exportModal.classList.remove('active'));
  cancelExportBtn.addEventListener('click', () => exportModal.classList.remove('active'));

  confirmExportBtn.addEventListener('click', async () => {
    const targetDir = targetFolderPath.value.trim();
    if (!targetDir) {
      alert('Por favor especifica una ruta de carpeta válida.');
      return;
    }

    const selectedItems = allMediaItems.filter(item => selectedMediaIds.has(item.id));

    exportStatusBanner.className = 'alert-banner warning';
    exportStatusIcon.innerHTML = '<i class="ri-loader-4-line spin"></i>';
    exportStatusTitle.textContent = 'Guardando Archivos...';
    exportStatusDesc.textContent = `Descargando y guardando ${selectedItems.length} elemento(s) en ${targetDir}`;
    exportStatusBanner.style.display = 'flex';
    confirmExportBtn.disabled = true;

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDirectory: targetDir,
          items: selectedItems
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        exportStatusBanner.className = 'alert-banner';
        exportStatusBanner.style.background = 'var(--success-bg)';
        exportStatusBanner.style.borderColor = 'var(--success-color)';
        exportStatusBanner.style.color = 'var(--success-color)';
        exportStatusIcon.innerHTML = '<i class="ri-checkbox-circle-fill"></i>';
        exportStatusTitle.textContent = '¡Exportación Exitosa!';
        exportStatusDesc.textContent = `Se guardaron ${result.savedCount} archivo(s) en: ${result.targetDirectory}`;
      } else {
        exportStatusBanner.className = 'alert-banner error';
        exportStatusIcon.innerHTML = '<i class="ri-error-warning-fill"></i>';
        exportStatusTitle.textContent = 'Error en la Exportación';
        exportStatusDesc.textContent = result.error || 'No se pudieron exportar los archivos.';
        confirmExportBtn.disabled = false;
      }
    } catch (err) {
      exportStatusBanner.className = 'alert-banner error';
      exportStatusIcon.innerHTML = '<i class="ri-error-warning-fill"></i>';
      exportStatusTitle.textContent = 'Fallo de Red';
      exportStatusDesc.textContent = 'Ocurrió un error al contactar al servidor para exportar los archivos.';
      confirmExportBtn.disabled = false;
    }
  });

});
