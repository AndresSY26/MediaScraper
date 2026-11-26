const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler.middleware');

const app = express();

// Soporte detrás de proxies inversos (Vercel Edge / Render Load Balancer)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Cabeceras base de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configuración CORS segura (permite same-origin, desarrollo local y ALLOWED_ORIGINS)
app.use(cors((req, callback) => {
  const origin = req.header('Origin');
  if (!origin) {
    return callback(null, { origin: false });
  }

  try {
    const parsedOrigin = new URL(origin);
    const reqHost = req.get('host');
    const isSameHost = Boolean(reqHost && parsedOrigin.host === reqHost);
    const isExplicitlyAllowed = config.allowedOrigins.includes(origin);
    const isLocalDev = config.env !== 'production' && (
      parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1'
    );

    if (isSameHost || isExplicitlyAllowed || isLocalDev) {
      return callback(null, { origin: true });
    }
  } catch (e) {
    // Origen malformado
  }

  const err = new Error('Origen CORS no autorizado.');
  err.status = 403;
  return callback(err);
}));

app.use(express.json({ limit: config.maxBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.maxBodyLimit }));

// Resolución robusta del directorio público (compatible con __dirname y empaquetado serverless)
const candidatePublicDirs = [
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public')
];
const publicDir = candidatePublicDirs.find(dir => fs.existsSync(dir)) || candidatePublicDirs[0];

// Cabeceras dedicadas para Service Worker y ads.txt cuando Express sirve estáticos (Render / Local)
app.get('/sw.js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

app.get('/ads.txt', (req, res, next) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  next();
});

app.use(express.static(publicDir));

// Agregador de Rutas API
app.use(apiRoutes);

// Respuesta 404 JSON consistente para endpoints API inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}`,
    status: 404
  });
});

// Fallback a index.html para navegación raíz en caso de acceso directo
app.get('/', (req, res, next) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return next();
});

// Manejo centralizado de errores
app.use(errorHandler);

// Iniciar Servidor HTTP únicamente fuera de Vercel Serverless y cuando se ejecuta directamente
if (!process.env.VERCEL && require.main === module) {
  app.listen(config.port, () => {
    console.log('====================================================');
    console.log(` MediaScraper Server ejecutándose en: http://localhost:${config.port}`);
    console.log('====================================================');
  });
}

module.exports = app;
