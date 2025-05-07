/**
 * Configuración del scraper
 */
module.exports = {
  // Timeout para solicitudes HTTP en milisegundos
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  
  // User Agent para solicitudes
  USER_AGENT: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  
  // Número máximo de descargas concurrentes
  DOWNLOAD_CONCURRENCY: parseInt(process.env.DOWNLOAD_CONCURRENCY || '5', 10),
  
  // Forzar uso de Puppeteer para todos los sitios
  ALWAYS_USE_PUPPETEER: process.env.ALWAYS_USE_PUPPETEER === 'true',
  
  // Lista de dominios que requieren Puppeteer
  PUPPETEER_DOMAINS: [
    'shopify.com',
    'myshopify.com',
    'squarespace.com',
    'wix.com'
  ],
  
  // Tamaño mínimo de imagen para considerar
  MIN_IMAGE_WIDTH: 100,
  MIN_IMAGE_HEIGHT: 100,
  
  // Ignorar imágenes con estas palabras en la URL
  IGNORED_PATTERNS: [
    'thumb',
    'avatar',
    'icon',
    'logo',
    'placeholder',
    'spinner',
    'loading'
  ],
  
  // Extensiones de imagen válidas
  VALID_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp']
}; 