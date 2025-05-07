const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { cleanTemp } = require('../scripts/clean-temp');

class CleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  async startCleanupScheduler() {
    logger.info('Iniciando servicio de limpieza automática');
    
    // Limpiar al inicio
    await this.runCleanup();
    
    // Programar limpieza cada hora
    this.cleanupInterval = setInterval(async () => {
      await this.runCleanup();
    }, 60 * 60 * 1000); // 1 hora
  }

  async runCleanup() {
    if (this.isRunning) {
      logger.debug('Limpieza ya en progreso, saltando...');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Iniciando limpieza de archivos temporales');
      await cleanTemp();
    } catch (error) {
      logger.error('Error durante la limpieza:', error);
    } finally {
      this.isRunning = false;
    }
  }

  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Servicio de limpieza detenido');
    }
  }
}

module.exports = new CleanupService(); 