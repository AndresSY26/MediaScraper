const config = require('../../config');

/**
 * Middleware centralizado para manejo seguro de errores HTTP
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.status || err.statusCode || 500;
  if (err.type === 'entity.too.large') {
    status = 413;
  } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
    status = 504;
  }

  if (config.env !== 'test') {
    console.error(`[Error System ${status}]:`, err.message);
  }

  const isClientError = status >= 400 && status < 500;
  const safeMessage = isClientError || status === 504 || config.env !== 'production'
    ? (err.message || 'Error en la solicitud')
    : 'Error interno en el servidor al procesar la solicitud.';

  res.status(status).json({
    error: safeMessage,
    status
  });
}

module.exports = errorHandler;
