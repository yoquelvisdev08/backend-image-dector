const queueService = require('../services/queue.service');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

class ScanController {
  /**
   * Escanea un sitio web y extrae imágenes
   */
  async scanWebsite(req, res) {
    try {
      const { url } = req.body;
      const options = {
        depth: req.body.depth || 1,
        concurrent: req.body.concurrent || 5,
        priority: req.body.priority || 'normal'
      };

      // Verificar caché
      const cacheKey = cacheService.generateKey(url, options);
      const cachedResult = await cacheService.get(cacheKey);
      
      if (cachedResult) {
        return res.json({
          status: 'success',
          data: cachedResult,
          source: 'cache'
        });
      }

      // Añadir a la cola
      const job = await queueService.addToQueue(url, options);

      res.json({
        status: 'queued',
        jobId: job.id,
        message: 'Escaneo en proceso'
      });

    } catch (error) {
      logger.error(`Error en controlador de escaneo: ${error.message}`);
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }

  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const status = await queueService.getJobStatus(jobId);
      
      res.json({
        status: 'success',
        data: status
      });

    } catch (error) {
      logger.error(`Error al obtener estado del trabajo: ${error.message}`);
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
}

module.exports = new ScanController(); 