import { ThemeComponent } from './components/theme.component.js';
import { FullscreenComponent } from './components/fullscreen.component.js';
import { DrawerComponent } from './components/drawer.component.js';
import { GalleryComponent } from './components/gallery.component.js';
import { ExportModalComponent } from './components/exportModal.component.js';
import { ImageEditorComponent } from './components/imageEditor.component.js';
import { HistoryComponent } from './components/history.component.js';
import { ApiService } from './services/api.service.js';
import { sanitizeHref } from './utils/dom.util.js';

/**
 * Aplicación Principal MediaScraper (PWA Multiplataforma compatible con Vercel & Render)
 */
document.addEventListener('DOMContentLoaded', () => {
  let deferredPrompt;
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('MediaScraper PWA Service Worker registrado'))
      .catch(err => console.warn('PWA Service Worker aviso:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaInstallBtn.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }

  // Navegación activa
  document.querySelectorAll('.nav-link-item').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link-item').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // DOM Elements
  const scrapeForm = document.getElementById('scrapeForm');
  const urlInput = document.getElementById('urlInput');
  const deepScrapeToggle = document.getElementById('deepScrapeToggle');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');

  const socialWarningBanner = document.getElementById('socialWarningBanner');
  const socialWarningText = document.getElementById('socialWarningText');
  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorDesc = document.getElementById('errorDesc');

  const scrapeLoadingSkeleton = document.getElementById('scrapeLoadingSkeleton');
  const scrapeLoadingStatusText = document.getElementById('scrapeLoadingStatusText');
  const resultsSection = document.getElementById('resultsSection');
  const scrapedTitle = document.getElementById('scrapedTitle');
  const scrapedUrlLink = document.getElementById('scrapedUrlLink');
  const openExportModalBtn = document.getElementById('openExportModalBtn');

  let currentScrapedData = { title: 'Catálogo', url: '' };

  // Inicialización de Componentes
  const theme = new ThemeComponent('themeToggleBtn', 'themeIcon');
  const fullscreen = new FullscreenComponent();
  const imageEditor = new ImageEditorComponent();

  async function performScrape(rawUrl, forceDeep = null) {
    const url = (rawUrl || urlInput.value || '').trim();
    if (!url) return;

    if (forceDeep !== null && deepScrapeToggle) {
      deepScrapeToggle.checked = Boolean(forceDeep);
    }
    const isDeepScrape = deepScrapeToggle ? deepScrapeToggle.checked : false;

    hideBanners();
    drawer.close();
    fullscreen.close();
    imageEditor.close();
    setLoadingState(true, isDeepScrape);
    resultsSection.style.display = 'none';
    resultsSection.classList.remove('active');

    try {
      const { ok, data } = await ApiService.scrapeUrl(url, isDeepScrape);

      if (!ok) {
        showErrorBanner('No se pudo completar la extracción', data?.error || 'Verifica que la URL sea pública y accesible.');
        return;
      }

      if (data.isSocialMedia) {
        showSocialWarning(data.message || 'Aún no tenemos soporte para redes sociales cerradas.');
        return;
      }

      currentScrapedData = {
        title: data.title || 'Contenido Extraído',
        url: data.url
      };

      if (scrapedTitle) {
        scrapedTitle.textContent = data.isDirectVideoPage
          ? `📹 Extractor de Video Directo: ${data.title || 'Video Extraído'}`
          : `${data.title || 'Contenido Extraído'}${isDeepScrape ? ' (Scraping Profundo)' : ''}`;
      }

      if (scrapedUrlLink) {
        scrapedUrlLink.textContent = `${data.url} `;
        const icon = document.createElement('i');
        icon.className = 'ri-external-link-line';
        scrapedUrlLink.appendChild(icon);
        scrapedUrlLink.href = sanitizeHref(data.url);
      }

      history.addEntry(data.url, data.title, data.stats);

      gallery.setItems(data.items, data.stats, data.mainVideo, data.isDirectVideoPage);
      resultsSection.style.display = 'block';
      resultsSection.classList.add('active');

      setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('Error en extracción:', err);
      showErrorBanner('Error de Conexión', 'Ocurrió un fallo de red al comunicarse con el servidor.');
    } finally {
      setLoadingState(false, false);
    }
  }

  const history = new HistoryComponent((selectedUrl) => {
    urlInput.value = selectedUrl;
    performScrape(selectedUrl);
  });

  const drawer = new DrawerComponent(
    (item) => fullscreen.open(item),
    (proxyUrl, filename) => imageEditor.open(proxyUrl, filename)
  );

  const gallery = new GalleryComponent(
    (item) => drawer.open(item),
    () => performScrape(urlInput.value, true)
  );

  const exportModal = new ExportModalComponent(
    () => gallery.getSelectedItems(),
    () => currentScrapedData
  );

  // Botón Pegar desde el Portapapeles con manejo de permisos
  const pasteUrlBtn = document.getElementById('pasteUrlBtn');
  if (pasteUrlBtn) {
    pasteUrlBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          urlInput.focus();
          pasteUrlBtn.innerHTML = '<i class="ri-check-line" style="color: var(--success-color);"></i> ¡Pegado!';
          setTimeout(() => {
            pasteUrlBtn.innerHTML = '<i class="ri-clipboard-line"></i> Pegar';
          }, 1800);
        }
      } catch (err) {
        urlInput.focus();
        pasteUrlBtn.innerHTML = '<i class="ri-information-line" style="color: var(--warning-color);"></i> Usa Ctrl+V';
        setTimeout(() => {
          pasteUrlBtn.innerHTML = '<i class="ri-clipboard-line"></i> Pegar';
        }, 2200);
      }
    });
  }

  // Chips de ejemplos rápidos
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = btn.dataset.url;
      urlInput.value = targetUrl;
      performScrape(targetUrl);
    });
  });

  if (openExportModalBtn) {
    openExportModalBtn.addEventListener('click', () => exportModal.open());
  }

  if (scrapeForm) {
    scrapeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performScrape(urlInput.value);
    });
  }

  function setLoadingState(isLoading, isDeep) {
    if (isLoading) {
      scrapeBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline-flex';
      if (scrapeLoadingStatusText) {
        scrapeLoadingStatusText.textContent = isDeep
          ? 'Scraping Profundo activo: explorando página principal y enlaces internos...'
          : 'Conectando con el sitio y detectando recursos multimedia...';
      }
      if (scrapeLoadingSkeleton) scrapeLoadingSkeleton.style.display = 'block';
    } else {
      scrapeBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnLoading) btnLoading.style.display = 'none';
      if (scrapeLoadingSkeleton) scrapeLoadingSkeleton.style.display = 'none';
    }
  }

  function hideBanners() {
    if (socialWarningBanner) socialWarningBanner.style.display = 'none';
    if (errorBanner) errorBanner.style.display = 'none';
  }

  function showSocialWarning(msg) {
    if (socialWarningText) socialWarningText.textContent = msg;
    if (socialWarningBanner) socialWarningBanner.style.display = 'flex';
  }

  function showErrorBanner(title, desc) {
    if (errorTitle) errorTitle.textContent = title;
    if (errorDesc) errorDesc.textContent = desc;
    if (errorBanner) errorBanner.style.display = 'flex';
  }
});
