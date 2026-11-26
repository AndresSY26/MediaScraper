/**
 * Limitador de tasa ligero en memoria compatible con Serverless y servidores persistentes
 */
function createRateLimiter({ windowMs = 60000, max = 30, message = 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' } = {}) {
  const hits = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 30000));

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimiterMiddleware(req, res, next) {
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TEST !== 'true') {
      return next();
    }

    const now = Date.now();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(clientIp);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(clientIp, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: message,
        status: 429,
        retryAfter: retryAfterSec
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
