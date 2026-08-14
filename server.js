const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler.middleware');

const app = express();

// Middlewares Globales
app.use(cors());
app.use(express.json({ limit: config.maxBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.maxBodyLimit }));

// Archivos estáticos de la app web
app.use(express.static(path.join(__dirname, 'public')));

// Agregador de Rutas API
app.use(apiRoutes);

// Manejo centralizado de errores
app.use(errorHandler);

// Iniciar Servidor HTTP
app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` MediaScraper Server [Escalable] ejecutándose en: http://localhost:${config.port}`);
  console.log(`====================================================`);
});
