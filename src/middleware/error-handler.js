const logger = require('../utils/logger');
const { AppError } = require('./error-classes');

/**
 * Middleware para manejo centralizado de errores
 */
function errorHandler(err, req, res, next) {
  // Registrar el error
  logger.error(`Error: ${err.message}`);
  if (err.stack) {
    logger.debug(err.stack);
  }
  
  // Determinar el código de estado HTTP
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  
  // Construir respuesta de error
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Error interno del servidor',
      code: err instanceof AppError ? err.code : 'INTERNAL_ERROR'
    }
  };
  
  // Incluir detalles adicionales en desarrollo
  if (process.env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    errorResponse.error.stack = err.stack;
  }
  
  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler; 