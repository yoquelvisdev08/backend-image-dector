const logger = require('../utils/logger');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/storage.config');

class HealthController {
  /**
   * Verifica el estado del servidor
   */
  async checkHealth(req, res) {
    try {
      // Información básica
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: {
          total: Math.round(os.totalmem() / (1024 * 1024)) + ' MB',
          free: Math.round(os.freemem() / (1024 * 1024)) + ' MB',
          usage: Math.round((process.memoryUsage().rss / (1024 * 1024)) * 100) / 100 + ' MB'
        }
      };
      
      // Verificar almacenamiento
      try {
        const tempDir = config.TEMP_STORAGE_PATH;
        await fs.access(tempDir);
        
        // Obtener información de almacenamiento
        const files = await this._countFiles(tempDir);
        
        health.storage = {
          status: 'ok',
          path: tempDir,
          files: files
        };
      } catch (error) {
        health.storage = {
          status: 'error',
          error: error.message
        };
      }
      
      return res.json(health);
    } catch (error) {
      logger.error(`Error en health check: ${error.message}`);
      
      return res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  }
  
  /**
   * Cuenta archivos en un directorio recursivamente
   * @private
   */
  async _countFiles(dir) {
    let count = 0;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          count += await this._countFiles(fullPath);
        } else {
          count++;
        }
      }
    } catch (error) {
      logger.warn(`Error al contar archivos en ${dir}: ${error.message}`);
    }
    
    return count;
  }
}

module.exports = new HealthController(); 