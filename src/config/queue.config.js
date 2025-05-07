module.exports = {
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  
  // Configuración de crawling
  MAX_DEPTH: process.env.MAX_CRAWL_DEPTH || 3,
  MAX_PAGES: process.env.MAX_CRAWL_PAGES || 100,
  CONCURRENT_REQUESTS: process.env.CONCURRENT_REQUESTS || 5,
  
  // Caché
  CACHE_TTL: process.env.CACHE_TTL || 3600, // 1 hora
  MAX_CACHE_SIZE: process.env.MAX_CACHE_SIZE || 100 // MB
}; 