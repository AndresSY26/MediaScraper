const scriptCache = new Map();

/**
 * Escapa caracteres especiales HTML para prevenir vulnerabilidades DOM/Stored XSS
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valida que un enlace destinado a href/src use únicamente protocolos seguros
 */
export function sanitizeHref(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/api/')) return trimmed;
  if (trimmed.startsWith('data:image/')) return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (e) {
    // URL inválida
  }
  return '#';
}

/**
 * Extrae la URL original si una cadena ya viene envuelta en /api/proxy?url=...
 */
export function unwrapProxyUrl(urlOrProxy) {
  if (!urlOrProxy || typeof urlOrProxy !== 'string') return '';
  let current = urlOrProxy.trim();
  for (let i = 0; i < 3; i++) {
    if (current.startsWith('/api/proxy') || current.includes('/api/proxy?')) {
      try {
        const parsed = new URL(current, window.location.origin);
        const inner = parsed.searchParams.get('url');
        if (inner) {
          current = inner.trim();
          continue;
        }
      } catch (e) {
        break;
      }
    }
    break;
  }
  return current;
}

/**
 * Carga diferida (lazy-load) idempotente de scripts CDN pesados para no bloquear el renderizado inicial
 */
export function loadScriptOnce(src) {
  if (!src) return Promise.reject(new Error('URL de script vacía'));
  if (scriptCache.has(src)) {
    return scriptCache.get(src);
  }

  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing && existing.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    script.onerror = () => {
      scriptCache.delete(src);
      script.remove();
      reject(new Error(`No se pudo cargar la librería externa: ${src}`));
    };

    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

/**
 * Controla el bloqueo de scroll del documento cuando hay un modal o drawer abierto
 */
export function syncBodyScrollLock() {
  const hasOpenOverlay = Boolean(
    document.querySelector('.modal-backdrop.active, .fullscreen-modal.active, .side-drawer.active')
  );
  document.body.classList.toggle('modal-open', hasOpenOverlay);
}
