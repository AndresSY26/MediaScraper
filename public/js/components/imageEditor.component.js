import { syncBodyScrollLock } from '../utils/dom.util.js';

/**
 * Componente Editor de Imágenes Canvas, Conversor de Formatos y Extractor de Paleta HEX
 */
export class ImageEditorComponent {
  constructor() {
    this.modal = document.getElementById('imageEditorModal');
    this.canvas = document.getElementById('editorCanvas');
    this.loadingState = document.getElementById('editorLoadingState');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.currentImg = null;
    this.currentRotation = 0;
    this.currentFilter = 'none';
    this.paletteContainer = document.getElementById('hexPaletteContainer');

    this.initEvents();
  }

  initEvents() {
    const closeBtn = document.getElementById('closeEditorBtn');
    const rotateBtn = document.getElementById('rotateImgBtn');
    const resetBtn = document.getElementById('resetEditorBtn');
    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const downloadJpgBtn = document.getElementById('downloadJpgBtn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
        this.close();
      }
    });

    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        this.currentRotation = (this.currentRotation + 90) % 360;
        this.renderCanvas();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetFilterUI();
        this.renderCanvas();
      });
    }

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        this.renderCanvas();
      });
    });

    if (downloadPngBtn) downloadPngBtn.addEventListener('click', () => this.downloadAs('image/png', 'png'));
    if (downloadJpgBtn) downloadJpgBtn.addEventListener('click', () => this.downloadAs('image/jpeg', 'jpg'));
  }

  resetFilterUI() {
    this.currentRotation = 0;
    this.currentFilter = 'none';
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.filter === 'none');
    });
  }

  open(proxyUrl, filename) {
    this.filename = filename || 'edited_image';
    this.currentImg = null;
    this.resetFilterUI();

    if (this.paletteContainer) this.paletteContainer.innerHTML = '';
    if (this.canvas) this.canvas.style.display = 'none';
    if (this.loadingState) this.loadingState.style.display = 'flex';

    if (this.modal) {
      this.modal.classList.add('active');
      syncBodyScrollLock();
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = proxyUrl;

    img.onload = () => {
      this.currentImg = img;
      if (this.loadingState) this.loadingState.style.display = 'none';
      if (this.canvas) this.canvas.style.display = 'block';
      this.extractColorPalette(img);
      this.renderCanvas();
    };

    img.onerror = () => {
      if (this.loadingState) {
        this.loadingState.innerHTML = '<i class="ri-error-warning-line"></i> No se pudo cargar la imagen para edición.';
      }
    };
  }

  close() {
    if (this.modal) this.modal.classList.remove('active');
    syncBodyScrollLock();
  }

  renderCanvas() {
    if (!this.currentImg || !this.canvas || !this.ctx) return;

    const img = this.currentImg;
    const isRotatedVertical = this.currentRotation === 90 || this.currentRotation === 270;

    this.canvas.width = isRotatedVertical ? img.height : img.width;
    this.canvas.height = isRotatedVertical ? img.width : img.height;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = this.getFilterStyle(this.currentFilter);
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.rotate((this.currentRotation * Math.PI) / 180);
    this.ctx.drawImage(img, -img.width / 2, -img.height / 2);
    this.ctx.restore();
  }

  getFilterStyle(filter) {
    switch (filter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(100%)';
      case 'contrast': return 'contrast(160%) brightness(1.05)';
      case 'cyberpunk': return 'contrast(140%) hue-rotate(190deg) saturate(160%)';
      case 'vintage': return 'sepia(40%) contrast(110%) saturate(120%)';
      case 'invert': return 'invert(100%)';
      default: return 'none';
    }
  }

  extractColorPalette(img) {
    if (!this.paletteContainer) return;
    this.paletteContainer.innerHTML = '';

    const tempCanvas = document.createElement('canvas');
    const tCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 50;
    tempCanvas.height = 50;
    tCtx.drawImage(img, 0, 0, 50, 50);

    try {
      const imageData = tCtx.getImageData(0, 0, 50, 50).data;
      const colorCounts = {};

      for (let i = 0; i < imageData.length; i += 16) {
        const a = imageData[i + 3];
        if (a < 40) continue;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      const sortedColors = Object.keys(colorCounts)
        .sort((a, b) => colorCounts[b] - colorCounts[a])
        .slice(0, 5);

      sortedColors.forEach(hex => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch-item';
        swatch.title = `Clic para copiar ${hex}`;
        swatch.innerHTML = `
          <div class="swatch-color-box" style="background-color: ${hex};"></div>
          <span class="swatch-hex-text">${hex}</span>
        `;

        swatch.addEventListener('click', () => {
          navigator.clipboard.writeText(hex).catch(() => {});
          const hexText = swatch.querySelector('.swatch-hex-text');
          const originalHex = hexText.textContent;
          hexText.textContent = '¡Copiado!';
          swatch.classList.add('copied');
          setTimeout(() => {
            hexText.textContent = originalHex;
            swatch.classList.remove('copied');
          }, 1300);
        });

        this.paletteContainer.appendChild(swatch);
      });
    } catch (e) {
      this.paletteContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Paleta no disponible</span>';
    }
  }

  downloadAs(mimeType, ext) {
    if (!this.canvas || !this.currentImg) return;
    const dataUrl = this.canvas.toDataURL(mimeType, 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `edited_${String(this.filename || 'imagen').split('.')[0]}.${ext}`;
    link.click();
  }
}
