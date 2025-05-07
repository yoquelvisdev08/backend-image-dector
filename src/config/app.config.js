/**
 * Configuración general de la aplicación
 */
module.exports = {
  // Servidor
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: process.env.API_PREFIX || '/api',
  
  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5173'],
  
  // Límites de la API
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  
  // Configuración de imágenes
  MIN_IMAGE_WIDTH: parseInt(process.env.MIN_IMAGE_WIDTH || '100', 10),
  MIN_IMAGE_HEIGHT: parseInt(process.env.MIN_IMAGE_HEIGHT || '100', 10),
  IMAGE_DOWNLOAD_TIMEOUT: parseInt(process.env.IMAGE_DOWNLOAD_TIMEOUT || '15000', 10),
  
  // User Agent
  USER_AGENT: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}; 