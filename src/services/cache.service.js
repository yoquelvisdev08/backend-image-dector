const NodeCache = require('node-cache');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config/queue.config');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.CACHE_TTL,
      checkperiod: 120,
      useClones: false
    });

    this.stats = {
      hits: 0,
      misses: 0,
      size: 0
    };
  }

  generateKey(url, options = {}) {
    const data = JSON.stringify({ url, options });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async get(key) {
    const value = this.cache.get(key);
    if (value) {
      this.stats.hits++;
      logger.debug(`Cache hit para key: ${key}`);
      return value;
    }
    
    this.stats.misses++;
    logger.debug(`Cache miss para key: ${key}`);
    return null;
  }

  async set(key, value, ttl = config.CACHE_TTL) {
    try {
      const valueSize = Buffer.from(JSON.stringify(value)).length;
      
      // Verificar límite de tamaño
      if (this.stats.size + valueSize > config.MAX_CACHE_SIZE * 1024 * 1024) {
        this.evictOldest();
      }
      
      this.cache.set(key, value, ttl);
      this.stats.size += valueSize;
      
      logger.debug(`Valor cacheado para key: ${key}`);
    } catch (error) {
      logger.error(`Error al cachear valor: ${error.message}`);
    }
  }

  evictOldest() {
    const keys = this.cache.keys();
    if (keys.length === 0) return;

    // Eliminar el 20% más antiguo
    const keysToRemove = Math.ceil(keys.length * 0.2);
    keys.slice(0, keysToRemove).forEach(key => {
      this.cache.del(key);
    });
  }

  getStats() {
    return {
      ...this.stats,
      items: this.cache.getStats().keys,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }
}

module.exports = new CacheService(); 