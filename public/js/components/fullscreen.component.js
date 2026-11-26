import { CDN_LIBRARIES } from '../config/constants.js';
import { CustomVideoPlayer } from './videoPlayer.component.js';
import { loadScriptOnce, syncBodyScrollLock } from '../utils/dom.util.js';

/**
 * Componente Visor HD en Pantalla Completa con Zoom para Imágenes y Google Lens OCR diferido
 */
export class FullscreenComponent {
  constructor() {
    this.modal = document.getElementById('fullscreenModal');
    this.closeBtn = document.getElementById('closeFullscreenBtn');
    this.container = document.getElementById('fullscreenMediaContainer');
    this.filenameEl = document.getElementById('fsFilename');
    this.zoomInBtn = document.getElementById('zoomInBtn');
    this.zoomOutBtn = document.getElementById('zoomOutBtn');
    this.zoomResetBtn = document.getElementById('zoomResetBtn');
    this.toggleNativeFSBtn = document.getElementById('toggleNativeFSBtn');

    this.fullscreenLensBtn = document.getElementById('fullscreenLensBtn');
    this.fullscreenLensPanel = document.getElementById('fullscreenLensPanel');
    this.closeLensPanelBtn = document.getElementById('closeLensPanelBtn');
    this.lensStatusText = document.getElementById('lensStatusText');
    this.fullscreenLensTextarea = document.getElementById('fullscreenLensTextarea');
    this.copyFullscreenLensBtn = document.getElementById('copyFullscreenLensBtn');

    this.currentZoom = 1;
    this.currentItem = null;
    this.activePlayer = null;
    this.initEvents();
  }

  initEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.zoomInBtn) this.zoomInBtn.addEventListener('click', () => this.zoomIn());
    if (this.zoomOutBtn) this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
    if (this.zoomResetBtn) this.zoomResetBtn.addEventListener('click', () => this.resetZoom());
    if (this.toggleNativeFSBtn) this.toggleNativeFSBtn.addEventListener('click', () => this.toggleNativeFS());

    if (this.fullscreenLensBtn) {
      this.fullscreenLensBtn.addEventListener('click', () => this.runGoogleLensOcr());
    }

    if (this.closeLensPanelBtn) {
      this.closeLensPanelBtn.addEventListener('click', () => {
        if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.remove('active');
      });
    }

    if (this.copyFullscreenLensBtn) {
      this.copyFullscreenLensBtn.addEventListener('click', () => this.copyLensText());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
        this.close();
      }
    });
  }

  destroyActivePlayer() {
    if (this.activePlayer) {
      this.activePlayer.destroy();
      this.activePlayer = null;
    }
  }

  open(item) {
    this.destroyActivePlayer();
    this.currentItem = item;
    this.container.innerHTML = '';
    this.currentZoom = 1;
    this.applyZoom();

    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.remove('active');
    if (this.fullscreenLensTextarea) this.fullscreenLensTextarea.value = '';

    if (this.filenameEl) this.filenameEl.textContent = item.filename || 'Media HD';

    const isImage = item.type === 'image';
    if (this.fullscreenLensBtn) this.fullscreenLensBtn.style.display = isImage ? 'flex' : 'none';
    if (this.zoomInBtn) this.zoomInBtn.style.display = isImage ? 'flex' : 'none';
    if (this.zoomOutBtn) this.zoomOutBtn.style.display = isImage ? 'flex' : 'none';
    if (this.zoomResetBtn) this.zoomResetBtn.style.display = isImage ? 'flex' : 'none';

    if (item.type === 'video') {
      this.activePlayer = new CustomVideoPlayer(item.proxyUrl, {
        originalUrl: item.url,
        filename: item.filename
      });
      this.container.appendChild(this.activePlayer.getElement());
    } else {
      const img = document.createElement('img');
      img.crossOrigin = 'Anonymous';
      img.src = item.proxyUrl;
      img.alt = item.filename || 'Media HD';
      this.container.appendChild(img);
    }

    this.modal.classList.add('active');
    syncBodyScrollLock();
  }

  async runGoogleLensOcr() {
    if (!this.currentItem || this.currentItem.type !== 'image') return;

    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.add('active');
    if (this.lensStatusText) {
      this.lensStatusText.style.display = 'flex';
      this.lensStatusText.innerHTML = '<i class="ri-loader-4-line spin"></i> Cargando motor OCR...';
    }
    if (this.fullscreenLensTextarea) this.fullscreenLensTextarea.value = '';

    try {
      if (!window.Tesseract) {
        await loadScriptOnce(CDN_LIBRARIES.TESSERACT);
      }

      const result = await window.Tesseract.recognize(
        this.currentItem.proxyUrl,
        'spa+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text' && this.lensStatusText) {
              const progress = Math.round((m.progress || 0) * 100);
              this.lensStatusText.innerHTML = `<i class="ri-loader-4-line spin"></i> Escaneando texto (${progress}%)...`;
            }
          }
        }
      );

      const extractedText = (result.data?.text || '').trim();
      if (this.lensStatusText) this.lensStatusText.style.display = 'none';

      this.fullscreenLensTextarea.value = extractedText.length > 0
        ? extractedText
        : 'No se detectó texto legible dentro de esta imagen.';
    } catch (err) {
      console.warn('Error en Fullscreen OCR:', err);
      if (this.lensStatusText) {
        this.lensStatusText.style.display = 'flex';
        this.lensStatusText.innerHTML = '<i class="ri-error-warning-line"></i> Error al ejecutar el escaneo OCR.';
      }
    }
  }

  copyLensText() {
    if (!this.fullscreenLensTextarea.value) return;
    navigator.clipboard.writeText(this.fullscreenLensTextarea.value).catch(() => {});
    const originalHTML = this.copyFullscreenLensBtn.innerHTML;
    this.copyFullscreenLensBtn.innerHTML = '<i class="ri-check-line"></i> ¡Texto Copiado!';
    setTimeout(() => {
      this.copyFullscreenLensBtn.innerHTML = originalHTML;
    }, 1500);
  }

  close() {
    this.destroyActivePlayer();
    if (this.modal) this.modal.classList.remove('active');
    if (this.container) this.container.innerHTML = '';
    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.remove('active');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    syncBodyScrollLock();
  }

  zoomIn() {
    if (this.currentZoom < 4) {
      this.currentZoom += 0.25;
      this.applyZoom();
    }
  }

  zoomOut() {
    if (this.currentZoom > 0.5) {
      this.currentZoom -= 0.25;
      this.applyZoom();
    }
  }

  resetZoom() {
    this.currentZoom = 1;
    this.applyZoom();
  }

  applyZoom() {
    if (this.container) {
      this.container.style.transform = `scale(${this.currentZoom})`;
    }
  }

  toggleNativeFS() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
