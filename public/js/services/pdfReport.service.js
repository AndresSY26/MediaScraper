import { escapeHtml, sanitizeHref } from '../utils/dom.util.js';

/**
 * Servicio Generador de Catálogos y Reportes Multimedia Ejecutivos en el Navegador (Sanitizado contra XSS)
 */
export class PdfReportService {
  static generateCatalogPdf(title, pageUrl, items) {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Por favor permite las ventanas emergentes para abrir el informe catálogo.');
      return;
    }

    const safeTitle = escapeHtml(title || 'Catálogo Multimedia');
    const safePageUrl = escapeHtml(pageUrl || 'N/A');
    const safeDate = escapeHtml(new Date().toLocaleString());

    const imageCount = items.filter(i => i.type === 'image').length;
    const videoCount = items.filter(i => i.type === 'video').length;

    const ITEMS_PER_PAGE = 4;
    const itemPages = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
      itemPages.push(items.slice(i, i + ITEMS_PER_PAGE));
    }

    const pagesHTML = itemPages.map((pageItems, pageIdx) => {
      const cardsHTML = pageItems.map((item, itemIdxInPage) => {
        const globalIdx = pageIdx * ITEMS_PER_PAGE + itemIdxInPage + 1;
        const resText = (item.width && item.height)
          ? `${escapeHtml(item.width)}×${escapeHtml(item.height)} px`
          : (item.type === 'video' ? 'Video HD' : 'Imagen HD');
        const isVideo = item.type === 'video';
        const safeMediaSrc = escapeHtml(sanitizeHref(item.proxyUrl || item.url));
        const safeItemUrlHref = escapeHtml(sanitizeHref(item.url));
        const safeItemUrlText = escapeHtml(item.url || '');
        const safeFilename = escapeHtml(item.filename || `recurso_${globalIdx}`);
        const safeExt = escapeHtml(item.extension || (isVideo ? 'MP4' : 'JPG'));
        const safeType = escapeHtml(String(item.type || 'media').toUpperCase());
        const safeContext = escapeHtml(item.context || 'Origen Web');
        const safeTags = Array.isArray(item.aiTags) && item.aiTags.length > 0
          ? item.aiTags.map(t => escapeHtml(t)).join(' • ')
          : '';

        const previewMediaHTML = isVideo
          ? `
            <div class="card-media-wrapper">
              <video src="${safeMediaSrc}#t=1" preload="metadata" muted style="width: 100%; height: 100%; object-fit: cover;"></video>
              <span class="type-badge video"><i class="ri-play-circle-fill"></i> ${safeExt}</span>
              <span class="res-badge"><i class="ri-video-line"></i> ${resText}</span>
            </div>
          `
          : `
            <div class="card-media-wrapper">
              <img src="${safeMediaSrc}" alt="${safeFilename}" loading="eager" crossorigin="anonymous" />
              <span class="type-badge"><i class="ri-image-line"></i> ${safeExt}</span>
              <span class="res-badge">${resText}</span>
            </div>
          `;

        return `
          <div class="catalog-card">
            ${previewMediaHTML}
            <div class="card-details">
              <div class="card-header-row">
                <span class="item-index">#${globalIdx}</span>
                <span class="item-name" title="${safeFilename}">${safeFilename}</span>
              </div>
              <div class="card-meta-row">
                <span class="meta-pill type">${safeType} (${safeExt})</span>
                <span class="meta-pill context">${safeContext}</span>
              </div>
              ${safeTags ? `
                <div class="card-ai-tags">
                  <i class="ri-brain-line"></i> ${safeTags}
                </div>
              ` : ''}
              <div class="card-url-box">
                <span class="url-lbl">URL de Origen:</span>
                <a href="${safeItemUrlHref}" target="_blank" rel="noopener noreferrer" class="url-link">${safeItemUrlText}</a>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="pdf-page-block">
          <div class="page-header-mini">
            <span class="page-title-mini"><i class="ri-radar-fill"></i> ${safeTitle}</span>
            <span class="page-num-pill">Hoja ${pageIdx + 1} de ${itemPages.length} (4 por Hoja)</span>
          </div>
          <div class="catalog-grid-2x2">
            ${cardsHTML}
          </div>
        </div>
      `;
    }).join('');

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Catálogo Ejecutivo Multimedia - ${safeTitle}</title>
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.9.0/fonts/remixicon.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <style>
          :root {
            --bg-dark: #040711;
            --bg-surface: #0b0f19;
            --bg-card: #131927;
            --accent-indigo: #6366f1;
            --accent-cyan: #06b6d4;
            --accent-purple: #a855f7;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: rgba(255, 255, 255, 0.12);
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            padding-top: 76px;
            padding-bottom: 50px;
            min-height: 100vh;
            line-height: 1.5;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin { display: inline-block; animation: spin 0.9s linear infinite; }

          .executive-topbar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 64px;
            background: rgba(11, 15, 25, 0.9);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-color);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 32px;
          }

          .brand-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 800;
            font-size: 1.1rem;
            color: #ffffff;
          }

          .brand-icon {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            background: linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            color: #fff;
          }

          .topbar-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .topbar-btn {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 9px 18px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            text-decoration: none;
          }

          .topbar-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-2px);
          }

          .topbar-btn.primary {
            background: linear-gradient(135deg, var(--accent-indigo), var(--accent-purple));
            border-color: transparent;
            color: #ffffff;
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
          }

          .catalog-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 24px;
          }

          .catalog-header {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 28px;
            margin-bottom: 28px;
            position: relative;
            overflow: hidden;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .catalog-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan), var(--accent-purple));
          }

          .catalog-title {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 8px;
            color: #ffffff;
          }

          .catalog-meta-row {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            font-size: 0.9rem;
            color: var(--text-muted);
          }

          .header-pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            padding: 4px 14px;
            border-radius: 20px;
            font-weight: 600;
            color: var(--accent-cyan);
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          .pdf-page-block {
            break-after: page !important;
            page-break-after: always !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 32px;
          }

          .pdf-page-block:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
            margin-bottom: 0;
          }

          .page-header-mini {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
          }

          .page-title-mini {
            font-weight: 700;
            font-size: 0.9rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .page-num-pill {
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.3);
            color: var(--accent-cyan);
            font-size: 0.78rem;
            font-weight: 700;
            padding: 3px 12px;
            border-radius: 12px;
          }

          .catalog-grid-2x2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }

          .catalog-card {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .card-media-wrapper {
            position: relative;
            width: 100%;
            height: 165px;
            background: #000000;
            overflow: hidden;
          }

          .card-media-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .type-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(6, 9, 19, 0.85);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(6, 182, 212, 0.4);
            color: var(--accent-cyan);
            font-size: 0.72rem;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 20px;
            text-transform: uppercase;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .type-badge.video {
            border-color: rgba(168, 85, 247, 0.4);
            color: #c084fc;
          }

          .res-badge {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(6, 9, 19, 0.85);
            backdrop-filter: blur(10px);
            color: #ffffff;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .card-details {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
          }

          .card-header-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .item-index {
            background: linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan));
            color: #ffffff;
            font-size: 0.75rem;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 6px;
          }

          .item-name {
            font-size: 0.92rem;
            font-weight: 800;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .card-meta-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .meta-pill {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
          }

          .card-ai-tags {
            font-size: 0.75rem;
            color: var(--accent-cyan);
            font-weight: 600;
            background: rgba(6, 182, 212, 0.08);
            padding: 5px 10px;
            border-radius: 6px;
            border: 1px solid rgba(6, 182, 212, 0.2);
          }

          .card-url-box {
            font-size: 0.72rem;
            color: var(--text-muted);
            margin-top: auto;
            word-break: break-all;
          }

          .url-link {
            color: var(--accent-indigo);
            text-decoration: none;
          }

          @media print {
            .executive-topbar { display: none !important; }
            body { padding-top: 0; background-color: #040711 !important; color: #f8fafc !important; }
            .pdf-page-block { margin-bottom: 0 !important; }
          }

          @media (max-width: 768px) {
            .catalog-grid-2x2 { grid-template-columns: 1fr; }
            .executive-topbar { padding: 0 16px; height: auto; min-height: 64px; flex-wrap: wrap; gap: 8px; padding-top: 10px; padding-bottom: 10px; }
          }
        </style>
      </head>
      <body>
        <header class="executive-topbar">
          <div class="brand-logo">
            <div class="brand-icon"><i class="ri-radar-fill"></i></div>
            <span>MediaScraper Executive Catalog</span>
          </div>
          <div class="topbar-actions">
            <button id="btnDownloadPdf" onclick="downloadPDFDirectly()" class="topbar-btn primary">
              <i class="ri-file-download-fill"></i> Guardar / Descargar PDF HD
            </button>
            <button onclick="window.close()" class="topbar-btn">
              <i class="ri-close-line"></i> Cerrar
            </button>
          </div>
        </header>

        <main id="catalogContent" class="catalog-container">
          <div class="catalog-header">
            <h1 class="catalog-title">${safeTitle}</h1>
            <div class="catalog-meta-row">
              <span class="header-pill"><i class="ri-global-line"></i> ${safePageUrl}</span>
              <span class="header-pill"><i class="ri-time-line"></i> ${safeDate}</span>
              <span class="header-pill"><i class="ri-file-list-3-line"></i> ${items.length} Recursos (${imageCount} Img • ${videoCount} Vid)</span>
              <span class="header-pill"><i class="ri-layout-grid-fill"></i> Formato: 4 Elementos por Hoja</span>
            </div>
          </div>

          <div class="catalog-pages-wrapper">
            ${pagesHTML}
          </div>
        </main>

        <script>
          async function downloadPDFDirectly() {
            const btn = document.getElementById('btnDownloadPdf');
            if (!btn) return;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="ri-loader-4-line spin"></i> Generando PDF HD...';
            btn.disabled = true;

            const element = document.getElementById('catalogContent');
            if (window.html2pdf) {
              const opt = {
                margin: [0.2, 0.2, 0.2, 0.2],
                filename: 'MediaScraper_Catalogo_' + Date.now() + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#040711' },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'legacy'] }
              };

              try {
                await window.html2pdf().set(opt).from(element).save();
                btn.innerHTML = '<i class="ri-check-line"></i> ¡PDF Descargado!';
                setTimeout(() => {
                  btn.innerHTML = originalHTML;
                  btn.disabled = false;
                }, 2500);
                return;
              } catch (err) {
                console.warn('Fallback a impresion nativa:', err);
              }
            }

            window.print();
            btn.innerHTML = originalHTML;
            btn.disabled = false;
          }
        </script>
      </body>
      </html>
    `);

    reportWindow.document.close();
  }
}
