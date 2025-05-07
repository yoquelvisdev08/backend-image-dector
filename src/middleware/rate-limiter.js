const rateLimit = require('express-rate-limit');
const config = require('../config/app.config');

/**
 * Middleware para limitar la tasa de solicitudes
 */
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Demasiadas solicitudes, por favor intente más tarde',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

module.exports = apiLimiter; 