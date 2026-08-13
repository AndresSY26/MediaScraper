import { ThemeComponent } from './components/theme.component.js';
import { FullscreenComponent } from './components/fullscreen.component.js';
import { DrawerComponent } from './components/drawer.component.js';
import { GalleryComponent } from './components/gallery.component.js';
import { ExportModalComponent } from './components/exportModal.component.js';
import { ImageEditorComponent } from './components/imageEditor.component.js';
import { HistoryComponent } from './components/history.component.js';
import { ApiService } from './services/api.service.js';

/**
 * Aplicación Principal MediaScraper (Next-Gen PWA Architecture sin Nube ni Logins)
 */
document.addEventListener('DOMContentLoaded', () => {
  // PWA Service Worker Registration & Installation Prompt
  let deferredPrompt;
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('MediaScraper PWA Service Worker registrado'))
      .catch(err => console.warn('PWA Error:', err));
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

  const resultsSection = document.getElementById('resultsSection');
  const scrapedTitle = document.getElementById('scrapedTitle');
  const scrapedUrlLink = document.getElementById('scrapedUrlLink');
  const openExportModalBtn = document.getElementById('openExportModalBtn');

  let currentScrapedData = { title: 'Catálogo', url: '' };

  // Inicialización de Componentes Avanzados
  const theme = new ThemeComponent('themeToggleBtn', 'themeIcon');
  const fullscreen = new FullscreenComponent();
  const imageEditor = new ImageEditorComponent();
  async function performScrape(rawUrl) {
    const url = (rawUrl || urlInput.value || '').trim();
    if (!url) return;

    const isDeepScrape = deepScrapeToggle ? deepScrapeToggle.checked : false;

    hideBanners();
    drawer.close();
    fullscreen.close();
    imageEditor.close();
    setLoadingState(true);
    resultsSection.style.display = 'none';
    resultsSection.classList.remove('active');

    try {
      const { ok, data } = await ApiService.scrapeUrl(url, isDeepScrape);

      if (!ok) {
        showErrorBanner('Error de servidor', data?.error || 'No se pudo completar la solicitud.');
        return;
      }

      if (data.isSocialMedia) {
        showSocialWarning(data.message || 'Aún no tenemos soporte para redes sociales específicas.');
        return;
      }      currentScrapedData = {
        title: data.title || 'Contenido Extraído',
        url: data.url
      };

      if (scrapedTitle) {
        scrapedTitle.textContent = data.isDirectVideoPage 
          ? `📹 Extractor de Video Directo: ${data.title || 'Video Extraído'}`
          : `${data.title || 'Contenido Extraído'} ${isDeepScrape ? '(Scraping Profundo Activado)' : ''}`;
      }
      if (scrapedUrlLink) {
        scrapedUrlLink.innerHTML = `${data.url} <i class="ri-external-link-line"></i>`;
        scrapedUrlLink.href = data.url;
      }

      // Registrar en el historial local de búsquedas
      history.addEntry(data.url, data.title, data.stats);

      // Renderizar los elementos multimedia y la tarjeta de video principal
      gallery.setItems(data.items, data.stats, data.mainVideo, data.isDirectVideoPage);
      resultsSection.style.display = 'block';
      resultsSection.classList.add('active');

      // Auto desplazarse suavemente hacia los resultados
      setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err) {
      console.error('Error en extracción:', err);
      showErrorBanner('Error de Conexión', 'Ocurrió un fallo al comunicarse con el servidor.');
    } finally {
      setLoadingState(false);
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

  const gallery = new GalleryComponent((item) => drawer.open(item));
  
  const exportModal = new ExportModalComponent(
    () => gallery.getSelectedItems(),
    () => currentScrapedData
  );

  // Clipboard Paste Button
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
        console.warn('Clipboard read error:', err);
      }
    });
  }

  // Quick Chips
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

  // Manejo de Envío del Formulario
  if (scrapeForm) {
    scrapeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      performScrape(urlInput.value);
    });
  }



  function setLoadingState(isLoading) {
    if (isLoading) {
      scrapeBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline-flex';
    } else {
      scrapeBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnLoading) btnLoading.style.display = 'none';
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
});
