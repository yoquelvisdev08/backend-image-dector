const fs = require('fs').promises;
const path = require('path');
const fileUtils = require('../utils/file-utils');
const logger = require('../utils/logger');
const config = require('../config/storage.config');

class StorageService {
  constructor() {
    this.baseDir = config.TEMP_STORAGE_PATH;
    this.init();
  }
  
  /**
   * Inicializa el servicio de almacenamiento
   */
  async init() {
    try {
      await fileUtils.ensureDirectoryExists(this.baseDir);
      logger.info(`Directorio de almacenamiento inicializado: ${this.baseDir}`);
    } catch (error) {
      logger.error(`Error al inicializar almacenamiento: ${error.message}`);
    }
  }
  
  /**
   * Almacena un archivo
   * @param {Buffer} buffer - Contenido del archivo
   * @param {string} filePath - Ruta relativa del archivo
   * @returns {Promise<string>} - Ruta completa del archivo almacenado
   */
  async storeFile(buffer, filePath) {
    const fullPath = path.join(this.baseDir, filePath);
    const dirPath = path.dirname(fullPath);
    
    try {
      // Crear directorio si no existe
      await fileUtils.ensureDirectoryExists(dirPath);
      
      // Escribir archivo
      await fs.writeFile(fullPath, buffer);
      
      // Registrar tiempo de creación para limpieza
      await this._registerFile(filePath);
      
      logger.debug(`Archivo almacenado: ${filePath}`);
      return fullPath;
    } catch (error) {
      logger.error(`Error al almacenar archivo ${filePath}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene un archivo
   * @param {string} filePath - Ruta relativa del archivo
   * @returns {Promise<Buffer>} - Contenido del archivo
   */
  async getFile(filePath) {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      // Verificar si el archivo existe
      const exists = await fileUtils.fileExists(fullPath);
      
      if (!exists) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }
      
      // Leer archivo
      return await fs.readFile(fullPath);
    } catch (error) {
      logger.error(`Error al obtener archivo ${filePath}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Elimina un archivo
   * @param {string} filePath - Ruta relativa del archivo
   * @returns {Promise<boolean>} - true si se eliminó, false si no existía
   */
  async deleteFile(filePath) {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      return await fileUtils.removeFileIfExists(fullPath);
    } catch (error) {
      logger.error(`Error al eliminar archivo ${filePath}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Registra un archivo para limpieza automática
   * @private
   */
  async _registerFile(filePath) {
    try {
      const registryPath = path.join(this.baseDir, 'file_registry.json');
      let registry = {};
      
      // Intentar leer registro existente
      try {
        const data = await fs.readFile(registryPath, 'utf8');
        registry = JSON.parse(data);
      } catch (e) {
        // Si no existe, crear nuevo
        registry = {};
      }
      
      // Registrar archivo con timestamp
      registry[filePath] = {
        createdAt: Date.now(),
        expiresAt: Date.now() + config.FILE_TTL
      };
      
      // Guardar registro actualizado
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
    } catch (error) {
      logger.warn(`Error al registrar archivo ${filePath}: ${error.message}`);
    }
  }
}

module.exports = new StorageService(); 