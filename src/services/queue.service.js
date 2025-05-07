const Queue = require('bull');
const Redis = require('ioredis');
const config = require('../config/queue.config');
const logger = require('../utils/logger');
const scraperService = require('./scraper.service');

class QueueService {
  constructor() {
    this.scanQueue = new Queue('scan-queue', {
      redis: {
        port: config.REDIS_PORT,
        host: config.REDIS_HOST,
        password: config.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: false,
        removeOnFail: false
      }
    });

    this.setupQueueHandlers();
  }

  setupQueueHandlers() {
    this.scanQueue.on('completed', (job) => {
      logger.info(`Trabajo ${job.id} completado`);
    });

    this.scanQueue.on('failed', (job, err) => {
      logger.error(`Trabajo ${job.id} falló: ${err.message}`);
    });

    this.scanQueue.process(async (job) => {
      const { url, options } = job.data;
      logger.info(`Procesando trabajo ${job.id} para URL: ${url}`);
      
      try {
        const result = await scraperService.scanWebsite(url, options);
        return result;
      } catch (error) {
        logger.error(`Error en trabajo ${job.id}: ${error.message}`);
        throw error;
      }
    });
  }

  async addToQueue(url, options = {}) {
    try {
      const job = await this.scanQueue.add({ url, options });
      logger.info(`Trabajo ${job.id} añadido a la cola para URL: ${url}`);
      return job;
    } catch (error) {
      logger.error(`Error al añadir trabajo a la cola: ${error.message}`);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      const job = await this.scanQueue.getJob(jobId);
      if (!job) return { status: 'not_found' };

      const state = await job.getState();
      const progress = job._progress;
      const result = job.returnvalue;
      const error = job.failedReason;

      return {
        id: job.id,
        status: state,
        progress,
        result,
        error,
        timestamp: job.timestamp
      };
    } catch (error) {
      logger.error(`Error al obtener estado del trabajo: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new QueueService(); 