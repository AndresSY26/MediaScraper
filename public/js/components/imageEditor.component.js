/**
 * Componente Editor de Imágenes, Conversor de Formatos y Extractor de Paleta de Colores HEX
 */
export class ImageEditorComponent {
  constructor() {
    this.modal = document.getElementById('imageEditorModal');
    this.canvas = document.getElementById('editorCanvas');
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
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        this.currentRotation = (this.currentRotation + 90) % 360;
        this.renderCanvas();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentRotation = 0;
        this.currentFilter = 'none';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        const normBtn = document.querySelector('.filter-chip[data-filter="none"]');
        if (normBtn) normBtn.classList.add('active');
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

  open(proxyUrl, filename) {
    this.filename = filename || 'edited_image';
    this.currentRotation = 0;
    this.currentFilter = 'none';
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = proxyUrl;

    img.onload = () => {
      this.currentImg = img;
      this.extractColorPalette(img);
      this.renderCanvas();
      this.modal.classList.add('active');
    };

    img.onerror = () => {
      alert('No se pudo cargar la imagen para edición.');
    };
  }

  close() {
    this.modal.classList.remove('active');
  }

  renderCanvas() {
    if (!this.currentImg || !this.canvas) return;

    const img = this.currentImg;
    const isRotatedVertical = this.currentRotation === 90 || this.currentRotation === 270;
    
    this.canvas.width = isRotatedVertical ? img.height : img.width;
    this.canvas.height = isRotatedVertical ? img.width : img.height;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply Filter
    this.ctx.filter = this.getFilterStyle(this.currentFilter);

    // Rotate Center
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
          navigator.clipboard.writeText(hex);
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
    } catch(e) {
      this.paletteContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Paleta no disponible</span>';
    }
  }

  downloadAs(mimeType, ext) {
    if (!this.canvas) return;
    const dataUrl = this.canvas.toDataURL(mimeType, 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `edited_${this.filename.split('.')[0]}.${ext}`;
    link.click();
  }
}
