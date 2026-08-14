import { ApiService } from '../services/api.service.js';
import { DEFAULT_EXPORT_PATH } from '../config/constants.js';
import { PdfReportService } from '../services/pdfReport.service.js';

/**
 * Componente Modal para Exportación Local, Descarga ZIP y Generador de PDF
 */
export class ExportModalComponent {
  constructor(getSelectedItems, getScrapedInfo) {
    this.modal = document.getElementById('exportModal');
    this.closeBtn = document.getElementById('closeExportBtn');
    this.cancelBtn = document.getElementById('cancelExportBtn');
    this.confirmBtn = document.getElementById('confirmExportBtn');
    this.exportZipBtn = document.getElementById('exportZipBtn');
    this.generatePdfBtn = document.getElementById('generatePdfBtn');

    this.targetFolderPath = document.getElementById('targetFolderPath');
    this.exportCountParagraph = document.getElementById('exportCountParagraph');
    this.exportCountText = document.getElementById('exportCountText');
    this.statusBanner = document.getElementById('exportStatusBanner');
    this.statusIcon = document.getElementById('exportStatusIcon');
    this.statusTitle = document.getElementById('exportStatusTitle');
    this.statusDesc = document.getElementById('exportStatusDesc');

    this.getSelectedItems = getSelectedItems;
    this.getScrapedInfo = getScrapedInfo;
    
    this.animFrameId = null;
    this.isCompleted = false;
    this.isDownloading = false;

    this.init();
  }

  init() {
    if (this.targetFolderPath) this.targetFolderPath.value = DEFAULT_EXPORT_PATH;

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.handleUserCancel());
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.handleUserCancel());
    if (this.confirmBtn) this.confirmBtn.addEventListener('click', () => this.confirmExport());
    
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
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    // Reset Modal UI elements
    const modalTitle = this.modal ? this.modal.querySelector('.modal-title') : null;
    if (modalTitle) {
      modalTitle.innerHTML = `<i class="ri-download-cloud-fill"></i> Descargar Archivos Seleccionados`;
    }

    if (this.exportCountParagraph) {
      this.exportCountParagraph.innerHTML = `Has seleccionado <strong id="exportCountText" style="color: var(--accent-cyan);">${selectedItems.length} archivos</strong> para descargar.`;
    } else if (this.exportCountText) {
      this.exportCountText.textContent = `${selectedItems.length} archivos`;
    }

    if (this.exportZipBtn) {
      this.exportZipBtn.innerHTML = `<i class="ri-file-zip-line"></i> Descargar Paquete ZIP Ahora`;
      this.exportZipBtn.disabled = false;
      this.exportZipBtn.style.background = 'var(--accent-gradient)';
    }

    if (this.generatePdfBtn) {
      this.generatePdfBtn.style.display = 'inline-flex';
    }

    if (this.statusBanner) this.statusBanner.style.display = 'none';
    
    const progressBox = document.getElementById('exportProgressBox');
    if (progressBox) progressBox.style.display = 'none';

    if (this.confirmBtn) this.confirmBtn.disabled = false;
    if (this.modal) this.modal.classList.add('active');
  }

  handleUserCancel() {
    if (this.isDownloading && !this.isCompleted) {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.isDownloading = false;

      if (this.statusBanner) {
        this.statusBanner.className = 'banner warning-banner';
        this.statusBanner.style.background = 'rgba(244, 63, 94, 0.15)';
        this.statusBanner.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        this.statusBanner.style.color = '#f87171';
        if (this.statusTitle) this.statusTitle.textContent = 'Proceso Cancelado';
        if (this.statusDesc) this.statusDesc.textContent = 'La descarga fue cancelada por el usuario.';
        this.statusBanner.style.display = 'flex';
      }
      return;
    }
    this.close();
  }

  close() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.isDownloading = false;
    if (this.modal) this.modal.classList.remove('active');
  }

  /**
   * Realista simulador de porcentaje 0% -> 100% con aceleración natural
   */
  simulateProgress(totalItems, onProgress, onFinish) {
    let startTime = performance.now();
    const duration = Math.max(1800, totalItems * 120);

    const step = (now) => {
      const elapsed = now - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      
      const easedRatio = 1 - Math.pow(1 - progressRatio, 3);
      const currentPct = Math.min(Math.floor(easedRatio * 100), 99);
      const itemsProcessed = Math.min(Math.ceil((currentPct / 100) * totalItems), totalItems);
      const speedMB = (9.4 + Math.sin(elapsed / 120) * 3.1).toFixed(1);

      onProgress({
        percent: currentPct,
        processed: itemsProcessed,
        speed: speedMB
      });

      if (progressRatio < 1 && this.isDownloading) {
        this.animFrameId = requestAnimationFrame(step);
      } else if (this.isDownloading) {
        onProgress({ percent: 100, processed: totalItems, speed: '0.0' });
        if (onFinish) onFinish();
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  async confirmExport() {
    const targetDir = this.targetFolderPath ? this.targetFolderPath.value.trim() : '';
    const selectedItems = this.getSelectedItems();
    const progressBox = document.getElementById('exportProgressBox');
    const progressTitle = document.getElementById('modalProgressTitle');
    const progressDesc = document.getElementById('modalProgressDesc');
    const progressBar = document.getElementById('modalProgressBar');
    const progressPath = document.getElementById('modalProgressPath');
    const progressPercent = document.getElementById('modalProgressPercent');

    if (progressBox) {
      progressBox.style.display = 'block';
      if (progressTitle) progressTitle.textContent = `Guardando en PC (${selectedItems.length} archivos)...`;
      if (progressPath) progressPath.innerHTML = `<i class="ri-folder-shared-line"></i> ${targetDir}`;
    }

    this.isDownloading = true;
    if (this.confirmBtn) this.confirmBtn.disabled = true;

    this.simulateProgress(
      selectedItems.length,
      (info) => {
        if (progressBar) progressBar.style.width = `${info.percent}%`;
        if (progressPercent) progressPercent.textContent = `${info.percent}%`;
        if (progressDesc) {
          progressDesc.textContent = `Guardando ${info.processed}/${selectedItems.length} archivos • ⚡ ${info.speed} MB/s`;
        }
      },
      async () => {
        try {
          const { ok, data } = await ApiService.exportSelectedItems(targetDir, selectedItems);

          if (ok && data.success) {
            this.isCompleted = true;
            this.isDownloading = false;

            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100% ¡Completado!';
            
            if (this.statusBanner) {
              this.statusBanner.className = 'banner warning-banner';
              this.statusBanner.style.background = 'var(--success-bg)';
              this.statusBanner.style.borderColor = 'var(--success-color)';
              this.statusBanner.style.color = 'var(--success-color)';
              if (this.statusTitle) this.statusTitle.textContent = '¡Descarga a Carpeta Exitosa!';
              if (this.statusDesc) this.statusDesc.textContent = `Se guardaron ${data.savedCount} archivo(s) en: ${data.targetDirectory}`;
              this.statusBanner.style.display = 'flex';
            }
          } else {
            this.isDownloading = false;
            if (progressBox) progressBox.style.display = 'none';
            if (this.statusBanner) {
              this.statusBanner.className = 'banner error-banner';
              if (this.statusTitle) this.statusTitle.textContent = 'Error en la Descarga';
              if (this.statusDesc) this.statusDesc.textContent = data.error || 'No se pudieron guardar los archivos.';
              this.statusBanner.style.display = 'flex';
            }
            if (this.confirmBtn) this.confirmBtn.disabled = false;
          }
        } catch (err) {
          this.isDownloading = false;
          if (progressBox) progressBox.style.display = 'none';
          if (this.statusBanner) {
            this.statusBanner.className = 'banner error-banner';
            if (this.statusTitle) this.statusTitle.textContent = 'Fallo de Red';
            if (this.statusDesc) this.statusDesc.textContent = 'Ocurrió un error al contactar al servidor para guardar los archivos.';
            this.statusBanner.style.display = 'flex';
          }
          if (this.confirmBtn) this.confirmBtn.disabled = false;
        }
      }
    );
  }

  async exportAsZip() {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) return;

    const progressBox = document.getElementById('exportProgressBox');
    const progressTitle = document.getElementById('modalProgressTitle');
    const progressDesc = document.getElementById('modalProgressDesc');
    const progressBar = document.getElementById('modalProgressBar');
    const progressPath = document.getElementById('modalProgressPath');
    const progressPercent = document.getElementById('modalProgressPercent');
    const modalTitle = this.modal ? this.modal.querySelector('.modal-title') : null;

    if (progressBox) {
      progressBox.style.display = 'block';
      if (progressTitle) progressTitle.textContent = `MediaScraper_Paquete_${selectedItems.length}_Archivos.zip`;
      if (progressPath) progressPath.innerHTML = `<i class="ri-file-zip-line"></i> Compresión ZIP en vivo`;
    }

    this.isDownloading = true;

    this.simulateProgress(
      selectedItems.length,
      (info) => {
        if (progressBar) progressBar.style.width = `${info.percent}%`;
        if (progressPercent) progressPercent.textContent = `${info.percent}%`;
        if (progressDesc) {
          progressDesc.textContent = `Comprimiendo ${info.processed}/${selectedItems.length} archivos • ⚡ ${info.speed} MB/s`;
        }
      },
      async () => {
        try {
          const response = await fetch('/api/export-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: selectedItems })
          });

          if (!response.ok) throw new Error('Error al comprimir');

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `MediaScraper_Descarga_${Date.now()}.zip`;
          a.click();
          window.URL.revokeObjectURL(url);

          this.isCompleted = true;
          this.isDownloading = false;

          // UPDATE MODAL HEADER & UI TO COMPLETED STATE
          if (modalTitle) {
            modalTitle.innerHTML = `<i class="ri-checkbox-circle-fill" style="color: var(--accent-emerald);"></i> ¡Descarga Completada con Éxito!`;
          }

          if (this.exportCountParagraph) {
            this.exportCountParagraph.innerHTML = `Tus <strong style="color: var(--accent-emerald);">${selectedItems.length} archivos</strong> se han comprimido y descargado correctamente.`;
          } else if (this.exportCountText) {
            this.exportCountText.textContent = `${selectedItems.length} archivos`;
          }

          if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
          }

          if (progressPercent) {
            progressPercent.textContent = '100% ¡Guardado!';
            progressPercent.style.color = 'var(--accent-emerald)';
          }

          if (progressPath) {
            progressPath.innerHTML = `<span style="color: var(--accent-emerald); font-weight: 800;"><i class="ri-checkbox-circle-line"></i> Paquete ZIP listo en tu equipo</span>`;
          }

          // UPDATE BUTTON TO LISTO / CERRAR
          if (this.exportZipBtn) {
            this.exportZipBtn.innerHTML = `<i class="ri-check-double-line"></i> ¡Listo! Cerrar Ventana`;
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
            if (this.statusDesc) this.statusDesc.textContent = 'La descarga en ZIP finalizó y se guardó en tu navegador.';
            this.statusBanner.style.display = 'flex';
          }

        } catch(err) {
          this.isDownloading = false;
          if (progressBox) progressBox.style.display = 'none';
          if (this.statusBanner) {
            this.statusBanner.className = 'banner error-banner';
            if (this.statusTitle) this.statusTitle.textContent = 'Error al Generar ZIP';
            if (this.statusDesc) this.statusDesc.textContent = 'Ocurrió un problema durante la compresión del archivo ZIP.';
            this.statusBanner.style.display = 'flex';
          }
        }
      }
    );
  }

  generatePdfReport() {
    const selectedItems = this.getSelectedItems();
    const info = this.getScrapedInfo ? this.getScrapedInfo() : { title: 'Catálogo', url: 'N/A' };
    PdfReportService.generateCatalogPdf(info.title, info.url, selectedItems);
  }
}
