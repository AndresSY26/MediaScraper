import { CustomVideoPlayer } from './videoPlayer.component.js';

/**
 * Componente Visor HD en Pantalla Completa con Zoom y Google Lens OCR
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

    // Google Lens Fullscreen DOM Elements
    this.fullscreenLensBtn = document.getElementById('fullscreenLensBtn');
    this.fullscreenLensPanel = document.getElementById('fullscreenLensPanel');
    this.closeLensPanelBtn = document.getElementById('closeLensPanelBtn');
    this.lensStatusText = document.getElementById('lensStatusText');
    this.fullscreenLensTextarea = document.getElementById('fullscreenLensTextarea');
    this.copyFullscreenLensBtn = document.getElementById('copyFullscreenLensBtn');

    this.currentZoom = 1;
    this.currentItem = null;
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
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });
  }

  open(item) {
    this.currentItem = item;
    this.container.innerHTML = '';
    this.currentZoom = 1;
    this.applyZoom();

    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.remove('active');
    if (this.fullscreenLensTextarea) this.fullscreenLensTextarea.value = '';

    if (this.filenameEl) this.filenameEl.textContent = item.filename;
    if (this.fullscreenLensBtn) {
      this.fullscreenLensBtn.style.display = item.type === 'image' ? 'flex' : 'none';
    }

    if (item.type === 'video') {
      const player = new CustomVideoPlayer(item.proxyUrl);
      this.container.appendChild(player.getElement());
    } else {
      const img = document.createElement('img');
      img.crossOrigin = 'Anonymous';
      img.src = item.proxyUrl;
      img.alt = item.filename;
      this.container.appendChild(img);
    }

    this.modal.classList.add('active');
  }

  async runGoogleLensOcr() {
    if (!this.currentItem || this.currentItem.type !== 'image') return;
    if (!window.Tesseract) {
      alert('La librería Google Lens OCR no está disponible.');
      return;
    }

    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.add('active');
    if (this.lensStatusText) {
      this.lensStatusText.style.display = 'block';
      this.lensStatusText.innerHTML = '<i class="ri-loader-4-line spin"></i> Escaneando texto en HD...';
    }
    if (this.fullscreenLensTextarea) this.fullscreenLensTextarea.value = '';

    try {
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

      const extractedText = (result.data.text || '').trim();

      if (this.lensStatusText) {
        this.lensStatusText.style.display = 'none';
      }

      if (extractedText.length > 0) {
        this.fullscreenLensTextarea.value = extractedText;
      } else {
        this.fullscreenLensTextarea.value = 'No se detectó texto legible dentro de esta imagen.';
      }

    } catch (err) {
      console.warn('Error en Google Lens Fullscreen OCR:', err);
      if (this.lensStatusText) {
        this.lensStatusText.style.display = 'block';
        this.lensStatusText.innerHTML = '<i class="ri-error-warning-line"></i> Error en escaneo.';
      }
    }
  }

  copyLensText() {
    if (!this.fullscreenLensTextarea.value) return;
    this.fullscreenLensTextarea.select();
    navigator.clipboard.writeText(this.fullscreenLensTextarea.value);
    const originalHTML = this.copyFullscreenLensBtn.innerHTML;
    this.copyFullscreenLensBtn.innerHTML = '<i class="ri-check-line"></i> ¡Texto Copiado!';
    setTimeout(() => {
      this.copyFullscreenLensBtn.innerHTML = originalHTML;
    }, 1500);
  }

  close() {
    this.modal.classList.remove('active');
    this.container.innerHTML = '';
    if (this.fullscreenLensPanel) this.fullscreenLensPanel.classList.remove('active');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
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
    this.container.style.transform = `scale(${this.currentZoom})`;
  }

  toggleNativeFS() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
