/**
 * Configuración del Servidor y Entorno
 */

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  requestTimeout: 20000,
  maxBodyLimit: '50mb'
};
