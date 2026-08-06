/**
 * Middleware centralizado para manejo de errores
 */
function errorHandler(err, req, res, next) {
  console.error('[Error System]:', err.message);
  
  const status = err.status || 500;
  const message = err.message || 'Error interno en el servidor';

  res.status(status).json({
    error: message,
    status
  });
}

module.exports = errorHandler;
