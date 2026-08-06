import { CustomVideoPlayer } from './videoPlayer.component.js';
import { AIVisionService } from '../services/aiVision.service.js';

/**
 * Componente Ventana Lateral (Side Drawer Inspector con Google Lens OCR)
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

    // Google Lens OCR DOM Elements
    this.drawerOcrSection = document.getElementById('drawerOcrSection');
    this.runOcrBtn = document.getElementById('runOcrBtn');
    this.ocrResultBox = document.getElementById('ocrResultBox');
    this.ocrTextarea = document.getElementById('ocrTextarea');
    this.copyOcrTextBtn = document.getElementById('copyOcrTextBtn');

    this.onOpenFullscreen = onOpenFullscreen;
    this.onOpenEditor = onOpenEditor;
    this.currentItem = null;

    this.initEvents();
  }

  initEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.overlay) this.overlay.addEventListener('click', () => this.close());

    if (this.openFullscreenBtn) {
      this.openFullscreenBtn.addEventListener('click', () => {
        if (this.currentItem && this.onOpenFullscreen) {
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

    // Google Lens OCR Scan Event
    if (this.runOcrBtn) {
      this.runOcrBtn.addEventListener('click', () => this.runGoogleLensOcr());
    }

    if (this.copyOcrTextBtn) {
      this.copyOcrTextBtn.addEventListener('click', () => this.copyOcrText());
    }
  }

  async open(item) {
    this.currentItem = item;
    this.mediaContainer.innerHTML = '';
    this.dimensionsEl.textContent = 'Calculando...';

    // Reset Google Lens OCR state
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
      aiTagsContainer.innerHTML = '<span class="ai-tag-badge"><i class="ri-loader-4-line spin"></i> Analizando píxeles con IA Visual...</span>';
    }

    if (this.openEditorBtn) {
      this.openEditorBtn.style.display = item.type === 'image' ? 'inline-flex' : 'none';
    }

    if (item.type === 'video') {
      const player = new CustomVideoPlayer(item.proxyUrl);
      const playerElement = player.getElement();
      const videoTag = playerElement.querySelector('video');

      videoTag.addEventListener('loadedmetadata', () => {
        this.dimensionsEl.textContent = `${videoTag.videoWidth} x ${videoTag.videoHeight} px`;
      });

      if (aiTagsContainer) {
        aiTagsContainer.innerHTML = '<span class="ai-tag-badge"><i class="ri-video-line"></i> Contenido Audiovisual</span>';
      }

      this.mediaContainer.appendChild(playerElement);
    } else {
      const img = document.createElement('img');
      img.crossOrigin = 'Anonymous';
      img.src = item.proxyUrl;
      img.alt = item.filename;

      img.addEventListener('load', async () => {
        this.dimensionsEl.textContent = `${img.naturalWidth} x ${img.naturalHeight} px`;

        // Clasificación Visual por IA en tiempo real usando TensorFlow.js & MobileNet
        const visualPredictions = await AIVisionService.classifyImage(img);

        if (aiTagsContainer) {
          aiTagsContainer.innerHTML = '';
          if (visualPredictions && visualPredictions.length > 0) {
            visualPredictions.forEach(pred => {
              const badge = document.createElement('span');
              badge.className = 'ai-tag-badge';
              badge.innerHTML = `<i class="ri-brain-fill"></i> ${pred.label} (${pred.confidence})`;
              aiTagsContainer.appendChild(badge);
            });
          } else if (item.aiTags && item.aiTags.length > 0) {
            item.aiTags.forEach(tag => {
              const badge = document.createElement('span');
              badge.className = 'ai-tag-badge';
              badge.innerHTML = `<i class="ri-sparkling-fill"></i> ${tag}`;
              aiTagsContainer.appendChild(badge);
            });
          } else {
            aiTagsContainer.innerHTML = '<span class="ai-tag-badge"><i class="ri-image-line"></i> Imagen Web</span>';
          }
        }
      });

      img.addEventListener('error', () => {
        this.dimensionsEl.textContent = 'No disponible';
        if (aiTagsContainer) {
          aiTagsContainer.innerHTML = '<span class="meta-value">No disponible</span>';
        }
      });

      this.mediaContainer.appendChild(img);
    }

    this.filenameEl.textContent = item.filename;
    this.typeEl.textContent = `${item.type.toUpperCase()} (${item.extension})`;
    this.contextEl.textContent = item.context || 'Etiqueta Web';
    this.altEl.textContent = item.alt || 'Sin descripción alt';
    this.urlInput.value = item.url;

    this.downloadLink.href = `/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(item.filename)}`;

    this.drawer.classList.add('active');
    this.overlay.classList.add('active');
  }

  async runGoogleLensOcr() {
    if (!this.currentItem || this.currentItem.type !== 'image') return;
    if (!window.Tesseract) {
      alert('La librería OCR no está lista. Por favor verifica tu conexión.');
      return;
    }

    this.runOcrBtn.disabled = true;
    this.runOcrBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Escaneando texto (Google Lens OCR)...';

    try {
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

      const extractedText = (result.data.text || '').trim();

      this.ocrResultBox.style.display = 'flex';
      this.runOcrBtn.innerHTML = '<i class="ri-check-line"></i> Escaneo Completado';

      if (extractedText.length > 0) {
        this.ocrTextarea.value = extractedText;
      } else {
        this.ocrTextarea.value = 'No se detectó texto legible dentro de esta imagen.';
      }

    } catch (err) {
      console.warn('Error en Google Lens OCR:', err);
      this.runOcrBtn.disabled = false;
      this.runOcrBtn.innerHTML = '<i class="ri-error-warning-line"></i> Reintentar Escaneo';
      alert('No se pudo completar el escaneo de texto en esta imagen.');
    }
  }

  copyOcrText() {
    if (!this.ocrTextarea.value) return;
    this.ocrTextarea.select();
    navigator.clipboard.writeText(this.ocrTextarea.value);
    const originalHTML = this.copyOcrTextBtn.innerHTML;
    this.copyOcrTextBtn.innerHTML = '<i class="ri-check-line"></i> ¡Texto Copiado!';
    setTimeout(() => {
      this.copyOcrTextBtn.innerHTML = originalHTML;
    }, 1500);
  }

  close() {
    this.drawer.classList.remove('active');
    this.overlay.classList.remove('active');
    this.mediaContainer.innerHTML = '';
  }

  copyUrlToClipboard() {
    this.urlInput.select();
    navigator.clipboard.writeText(this.urlInput.value);
    const originalHTML = this.copyUrlBtn.innerHTML;
    this.copyUrlBtn.innerHTML = '<i class="ri-check-line"></i>';
    setTimeout(() => {
      this.copyUrlBtn.innerHTML = originalHTML;
    }, 1500);
  }
}
