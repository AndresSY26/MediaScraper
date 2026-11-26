import { PdfReportService } from '../services/pdfReport.service.js';
import { syncBodyScrollLock } from '../utils/dom.util.js';

/**
 * Componente Modal para Descarga ZIP en Streaming Real (con ReadableStream + AbortController) y Catálogo PDF
 */
export class ExportModalComponent {
  constructor(getSelectedItems, getScrapedInfo) {
    this.modal = document.getElementById('exportModal');
    this.closeBtn = document.getElementById('closeExportBtn');
    this.exportZipBtn = document.getElementById('exportZipBtn');
    this.generatePdfBtn = document.getElementById('generatePdfBtn');

    this.exportCountParagraph = document.getElementById('exportCountParagraph');
    this.exportCountText = document.getElementById('exportCountText');
    this.statusBanner = document.getElementById('exportStatusBanner');
    this.statusTitle = document.getElementById('exportStatusTitle');
    this.statusDesc = document.getElementById('exportStatusDesc');

    this.getSelectedItems = getSelectedItems;
    this.getScrapedInfo = getScrapedInfo;

    this.abortController = null;
    this.isCompleted = false;
    this.isDownloading = false;

    this.init();
  }

  init() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.handleUserCancel());

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.handleUserCancel();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
        this.handleUserCancel();
      }
    });

    if (this.exportZipBtn) {
      this.exportZipBtn.addEventListener('click', () => {
        if (this.isCompleted) {
          this.close();
        } else {
          this.exportAsZip();
        }
      });
    }

    if (this.generatePdfBtn) {
      this.generatePdfBtn.addEventListener('click', () => this.generatePdfReport());
    }
  }

  open() {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) return;

    this.isCompleted = false;
    this.isDownloading = false;
    this.abortActiveDownload();

    const modalTitle = this.modal ? this.modal.querySelector('.modal-title') : null;
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="ri-download-cloud-fill"></i> Descargar Archivos Seleccionados';
    }

    if (this.exportCountParagraph) {
      this.exportCountParagraph.innerHTML = `Has seleccionado <strong id="exportCountText" style="color: var(--accent-cyan);">${selectedItems.length} archivos</strong> para descargar.`;
    } else if (this.exportCountText) {
      this.exportCountText.textContent = `${selectedItems.length} archivos`;
    }

    if (this.exportZipBtn) {
      this.exportZipBtn.innerHTML = '<i class="ri-file-zip-line"></i> Descargar Paquete ZIP Ahora';
      this.exportZipBtn.disabled = false;
      this.exportZipBtn.style.background = 'var(--accent-gradient)';
    }

    if (this.generatePdfBtn) {
      this.generatePdfBtn.style.display = 'inline-flex';
    }

    if (this.statusBanner) this.statusBanner.style.display = 'none';

    const progressBox = document.getElementById('exportProgressBox');
    const progressBar = document.getElementById('modalProgressBar');
    if (progressBox) progressBox.style.display = 'none';
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.style.background = 'var(--accent-gradient)';
    }

    if (this.modal) {
      this.modal.classList.add('active');
      syncBodyScrollLock();
    }
  }

  abortActiveDownload() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  handleUserCancel() {
    if (this.isDownloading && !this.isCompleted) {
      this.abortActiveDownload();
      this.isDownloading = false;

      if (this.exportZipBtn) {
        this.exportZipBtn.disabled = false;
        this.exportZipBtn.innerHTML = '<i class="ri-file-zip-line"></i> Reintentar Descarga ZIP';
      }

      if (this.statusBanner) {
        this.statusBanner.className = 'banner error-banner';
        if (this.statusTitle) this.statusTitle.textContent = 'Descarga Cancelada';
        if (this.statusDesc) this.statusDesc.textContent = 'La transmisión del paquete ZIP fue detenida.';
        this.statusBanner.style.display = 'flex';
      }
      return;
    }
    this.close();
  }

  close() {
    this.abortActiveDownload();
    this.isDownloading = false;
    if (this.modal) this.modal.classList.remove('active');
    syncBodyScrollLock();
  }

  async exportAsZip() {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0 || this.isDownloading) return;

    const progressBox = document.getElementById('exportProgressBox');
    const progressTitle = document.getElementById('modalProgressTitle');
    const progressDesc = document.getElementById('modalProgressDesc');
    const progressBar = document.getElementById('modalProgressBar');
    const progressPath = document.getElementById('modalProgressPath');
    const progressPercent = document.getElementById('modalProgressPercent');
    const modalTitle = this.modal ? this.modal.querySelector('.modal-title') : null;

    if (this.statusBanner) this.statusBanner.style.display = 'none';
    if (progressBox) {
      progressBox.style.display = 'block';
      if (progressTitle) progressTitle.textContent = `MediaScraper_Paquete_${selectedItems.length}_Archivos.zip`;
      if (progressPath) progressPath.innerHTML = '<i class="ri-file-zip-line"></i> Compresión ZIP en tiempo real';
      if (progressBar) progressBar.style.width = '12%';
      if (progressPercent) {
        progressPercent.textContent = 'Conectando...';
        progressPercent.style.color = 'var(--accent-cyan)';
      }
      if (progressDesc) {
        progressDesc.textContent = `Solicitando y empaquetando ${selectedItems.length} archivos en el servidor...`;
      }
    }

    this.isDownloading = true;
    this.abortController = new AbortController();
    if (this.exportZipBtn) {
      this.exportZipBtn.disabled = true;
      this.exportZipBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Generando Paquete ZIP...';
    }

    try {
      const startTime = performance.now();
      const response = await fetch('/api/export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        let serverMsg = 'Ocurrió un problema durante la compresión del archivo ZIP.';
        try {
          const errJson = await response.json();
          if (errJson?.error) serverMsg = errJson.error;
        } catch (e) {}
        throw new Error(serverMsg);
      }

      let blob;
      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const chunks = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.byteLength;
            const mbReceived = (receivedBytes / (1024 * 1024)).toFixed(2);
            const elapsedSec = Math.max(0.2, (performance.now() - startTime) / 1000);
            const speedMB = ((receivedBytes / (1024 * 1024)) / elapsedSec).toFixed(1);
            const visualPct = Math.min(96, 20 + Math.round(Math.log1p(receivedBytes / 65536) * 18));

            if (progressBar) progressBar.style.width = `${visualPct}%`;
            if (progressPercent) progressPercent.textContent = `${mbReceived} MB`;
            if (progressDesc) {
              progressDesc.textContent = `Recibiendo flujo ZIP (${mbReceived} MB) • ⚡ ${speedMB} MB/s`;
            }
          }
        }
        blob = new Blob(chunks, { type: 'application/zip' });
      } else {
        blob = await response.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MediaScraper_Descarga_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);

      this.isCompleted = true;
      this.isDownloading = false;
      this.abortController = null;

      if (modalTitle) {
        modalTitle.innerHTML = '<i class="ri-checkbox-circle-fill" style="color: var(--accent-emerald);"></i> ¡Descarga Completada con Éxito!';
      }

      if (this.exportCountParagraph) {
        this.exportCountParagraph.innerHTML = `Tus <strong style="color: var(--accent-emerald);">${selectedItems.length} archivos</strong> se han comprimido y descargado correctamente.`;
      }

      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
      }

      if (progressPercent) {
        const finalMB = (blob.size / (1024 * 1024)).toFixed(2);
        progressPercent.textContent = `100% (${finalMB} MB)`;
        progressPercent.style.color = 'var(--accent-emerald)';
      }

      if (progressPath) {
        progressPath.innerHTML = '<span style="color: var(--accent-emerald); font-weight: 800;"><i class="ri-checkbox-circle-line"></i> Paquete ZIP guardado en tu navegador</span>';
      }

      if (this.exportZipBtn) {
        this.exportZipBtn.disabled = false;
        this.exportZipBtn.innerHTML = '<i class="ri-check-double-line"></i> ¡Listo! Cerrar Ventana';
        this.exportZipBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }

      if (this.generatePdfBtn) {
        this.generatePdfBtn.style.display = 'none';
      }

      if (this.statusBanner) {
        this.statusBanner.className = 'banner warning-banner';
        this.statusBanner.style.background = 'rgba(16, 185, 129, 0.15)';
        this.statusBanner.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        this.statusBanner.style.color = '#34d399';
        if (this.statusTitle) this.statusTitle.textContent = '¡Archivo ZIP Descargado!';
        if (this.statusDesc) this.statusDesc.textContent = 'El paquete comprimido se guardó correctamente en tus descargas.';
        this.statusBanner.style.display = 'flex';
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.isDownloading = false;
      this.abortController = null;
      if (progressBox) progressBox.style.display = 'none';
      if (this.exportZipBtn) {
        this.exportZipBtn.disabled = false;
        this.exportZipBtn.innerHTML = '<i class="ri-file-zip-line"></i> Reintentar Descarga ZIP';
      }
      if (this.statusBanner) {
        this.statusBanner.className = 'banner error-banner';
        if (this.statusTitle) this.statusTitle.textContent = 'Error al Generar ZIP';
        if (this.statusDesc) this.statusDesc.textContent = err.message || 'Ocurrió un problema durante la compresión del archivo ZIP.';
        this.statusBanner.style.display = 'flex';
      }
    }
  }

  generatePdfReport() {
    const selectedItems = this.getSelectedItems();
    const info = this.getScrapedInfo ? this.getScrapedInfo() : { title: 'Catálogo', url: 'N/A' };
    PdfReportService.generateCatalogPdf(info.title, info.url, selectedItems);
  }
}
