import { CDN_LIBRARIES } from '../config/constants.js';
import { CustomVideoPlayer } from './videoPlayer.component.js';
import { AIVisionService } from '../services/aiVision.service.js';
import { escapeHtml, loadScriptOnce, syncBodyScrollLock } from '../utils/dom.util.js';

/**
 * Componente Ventana Lateral (Side Drawer Inspector con IA Visual & Google Lens OCR bajo demanda)
 */
export class DrawerComponent {
  constructor(onOpenFullscreen, onOpenEditor) {
    this.drawer = document.getElementById('sideDrawer');
    this.overlay = document.getElementById('drawerOverlay');
    this.closeBtn = document.getElementById('closeDrawerBtn');
    this.mediaContainer = document.getElementById('drawerMediaContainer');
    this.filenameEl = document.getElementById('drawerFilename');
    this.typeEl = document.getElementById('drawerType');
    this.dimensionsEl = document.getElementById('drawerDimensions');
    this.contextEl = document.getElementById('drawerContext');
    this.altEl = document.getElementById('drawerAlt');
    this.urlInput = document.getElementById('drawerUrlInput');
    this.copyUrlBtn = document.getElementById('copyUrlBtn');
    this.downloadLink = document.getElementById('drawerDownloadLink');
    this.openFullscreenBtn = document.getElementById('openFullscreenBtn');
    this.openEditorBtn = document.getElementById('openEditorBtn');

    this.drawerOcrSection = document.getElementById('drawerOcrSection');
    this.runOcrBtn = document.getElementById('runOcrBtn');
    this.ocrResultBox = document.getElementById('ocrResultBox');
    this.ocrTextarea = document.getElementById('ocrTextarea');
    this.copyOcrTextBtn = document.getElementById('copyOcrTextBtn');

    this.onOpenFullscreen = onOpenFullscreen;
    this.onOpenEditor = onOpenEditor;
    this.currentItem = null;
    this.activePlayer = null;

    this.initEvents();
  }

  initEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.overlay) this.overlay.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawer && this.drawer.classList.contains('active')) {
        const hasHigherModal = document.querySelector('#fullscreenModal.active, #imageEditorModal.active');
        if (!hasHigherModal) {
          this.close();
        }
      }
    });

    if (this.openFullscreenBtn) {
      this.openFullscreenBtn.addEventListener('click', () => {
        if (this.currentItem && this.onOpenFullscreen) {
          if (this.activePlayer && this.activePlayer.video) {
            this.activePlayer.video.pause();
          }
          this.onOpenFullscreen(this.currentItem);
        }
      });
    }

    if (this.openEditorBtn) {
      this.openEditorBtn.addEventListener('click', () => {
        if (this.currentItem && this.currentItem.type === 'image' && this.onOpenEditor) {
          this.onOpenEditor(this.currentItem.proxyUrl, this.currentItem.filename);
        }
      });
    }

    if (this.copyUrlBtn) {
      this.copyUrlBtn.addEventListener('click', () => this.copyUrlToClipboard());
    }

    if (this.runOcrBtn) {
      this.runOcrBtn.addEventListener('click', () => this.runGoogleLensOcr());
    }

    if (this.copyOcrTextBtn) {
      this.copyOcrTextBtn.addEventListener('click', () => this.copyOcrText());
    }
  }

  destroyActivePlayer() {
    if (this.activePlayer) {
      this.activePlayer.destroy();
      this.activePlayer = null;
    }
  }

  async open(item) {
    this.destroyActivePlayer();
    this.currentItem = item;
    this.mediaContainer.innerHTML = '';
    this.dimensionsEl.textContent = 'Calculando...';

    if (this.drawerOcrSection) {
      this.drawerOcrSection.style.display = item.type === 'image' ? 'flex' : 'none';
    }
    if (this.ocrResultBox) this.ocrResultBox.style.display = 'none';
    if (this.ocrTextarea) this.ocrTextarea.value = '';
    if (this.runOcrBtn) {
      this.runOcrBtn.disabled = false;
      this.runOcrBtn.innerHTML = '<i class="ri-sparkling-fill"></i> Escanear Texto en la Imagen';
    }

    const aiTagsContainer = document.getElementById('drawerAiTagsContainer');
    if (aiTagsContainer) {
      aiTagsContainer.innerHTML = '<span class="ai-badge"><i class="ri-loader-4-line spin"></i> Analizando píxeles con IA Visual...</span>';
    }

    if (this.openEditorBtn) {
      this.openEditorBtn.style.display = item.type === 'image' ? 'inline-flex' : 'none';
    }

    if (item.type === 'video') {
      this.activePlayer = new CustomVideoPlayer(item.proxyUrl, {
        originalUrl: item.url,
        filename: item.filename
      });
      const playerElement = this.activePlayer.getElement();
      const videoTag = playerElement.querySelector('video');

      if (videoTag) {
        videoTag.addEventListener('loadedmetadata', () => {
          this.dimensionsEl.textContent = `${videoTag.videoWidth} × ${videoTag.videoHeight} px`;
        });
      }

      if (aiTagsContainer) {
        aiTagsContainer.innerHTML = '<span class="ai-badge"><i class="ri-video-line"></i> Contenido Audiovisual</span>';
      }

      this.mediaContainer.appendChild(playerElement);
    } else {
      const img = document.createElement('img');
      img.crossOrigin = 'Anonymous';
      img.src = item.proxyUrl;
      img.alt = item.filename || 'Imagen';

      img.addEventListener('load', async () => {
        if (this.currentItem !== item) return;
        this.dimensionsEl.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;

        const visualPredictions = await AIVisionService.classifyImage(img);
        if (this.currentItem !== item || !aiTagsContainer) return;

        aiTagsContainer.innerHTML = '';
        if (visualPredictions && visualPredictions.length > 0) {
          visualPredictions.forEach(pred => {
            const badge = document.createElement('span');
            badge.className = 'ai-badge';
            badge.innerHTML = `<i class="ri-brain-fill"></i> ${escapeHtml(pred.label)} (${escapeHtml(pred.confidence)})`;
            aiTagsContainer.appendChild(badge);
          });
        } else if (Array.isArray(item.aiTags) && item.aiTags.length > 0) {
          item.aiTags.forEach(tag => {
            const badge = document.createElement('span');
            badge.className = 'ai-badge';
            badge.innerHTML = `<i class="ri-sparkling-fill"></i> ${escapeHtml(tag)}`;
            aiTagsContainer.appendChild(badge);
          });
        } else {
          aiTagsContainer.innerHTML = '<span class="ai-badge"><i class="ri-image-line"></i> Imagen Web</span>';
        }
      });

      img.addEventListener('error', () => {
        this.dimensionsEl.textContent = 'No disponible';
        if (aiTagsContainer) {
          aiTagsContainer.innerHTML = '<span class="meta-val">No disponible</span>';
        }
      });

      this.mediaContainer.appendChild(img);
    }

    this.filenameEl.textContent = item.filename || '-';
    this.typeEl.textContent = `${String(item.type || '').toUpperCase()} (${item.extension || ''})`;
    this.contextEl.textContent = item.context || 'Etiqueta Web';
    this.altEl.textContent = item.alt || 'Sin descripción alt';
    this.urlInput.value = item.url || '';

    if (item.url && item.url.startsWith('data:image/')) {
      this.downloadLink.href = item.url;
      this.downloadLink.download = item.filename || 'imagen.png';
    } else {
      this.downloadLink.href = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.filename)}`;
      this.downloadLink.download = item.filename || 'archivo';
    }

    this.drawer.classList.add('active');
    this.overlay.classList.add('active');
    syncBodyScrollLock();
  }

  async runGoogleLensOcr() {
    if (!this.currentItem || this.currentItem.type !== 'image') return;

    this.runOcrBtn.disabled = true;
    this.runOcrBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Cargando motor OCR...';

    try {
      if (!window.Tesseract) {
        await loadScriptOnce(CDN_LIBRARIES.TESSERACT);
      }

      const result = await window.Tesseract.recognize(
        this.currentItem.proxyUrl,
        'spa+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const progress = Math.round((m.progress || 0) * 100);
              this.runOcrBtn.innerHTML = `<i class="ri-loader-4-line spin"></i> Escaneando texto (${progress}%)...`;
            }
          }
        }
      );

      const extractedText = (result.data?.text || '').trim();
      this.ocrResultBox.style.display = 'flex';
      this.runOcrBtn.innerHTML = '<i class="ri-check-line"></i> Escaneo Completado';
      this.ocrTextarea.value = extractedText.length > 0
        ? extractedText
        : 'No se detectó texto legible dentro de esta imagen.';
    } catch (err) {
      console.warn('Error en Google Lens OCR:', err);
      this.runOcrBtn.disabled = false;
      this.runOcrBtn.innerHTML = '<i class="ri-error-warning-line"></i> Reintentar Escaneo';
    }
  }

  copyOcrText() {
    if (!this.ocrTextarea.value) return;
    navigator.clipboard.writeText(this.ocrTextarea.value).catch(() => {});
    const originalHTML = this.copyOcrTextBtn.innerHTML;
    this.copyOcrTextBtn.innerHTML = '<i class="ri-check-line"></i> ¡Texto Copiado!';
    setTimeout(() => {
      this.copyOcrTextBtn.innerHTML = originalHTML;
    }, 1500);
  }

  close() {
    this.destroyActivePlayer();
    if (this.drawer) this.drawer.classList.remove('active');
    if (this.overlay) this.overlay.classList.remove('active');
    if (this.mediaContainer) this.mediaContainer.innerHTML = '';
    syncBodyScrollLock();
  }

  copyUrlToClipboard() {
    if (!this.urlInput.value) return;
    navigator.clipboard.writeText(this.urlInput.value).catch(() => {});
    const originalHTML = this.copyUrlBtn.innerHTML;
    this.copyUrlBtn.innerHTML = '<i class="ri-check-line"></i>';
    setTimeout(() => {
      this.copyUrlBtn.innerHTML = originalHTML;
    }, 1500);
  }
}
