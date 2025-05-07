const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');
const httpClient = require('../utils/http-client');
const fileUtils = require('../utils/file-utils');
const urlParser = require('../utils/url-parser');
const logger = require('../utils/logger');
const config = require('../config/app.config');

class ImageService {
  /**
   * Descarga y almacena una imagen
   * @param {string} imageUrl - URL de la imagen a descargar
   * @param {string} scanId - ID único del escaneo
   * @param {string} imageId - ID único de la imagen
   * @param {string} referer - URL de referencia
   * @returns {Promise<Object>} - Información de la imagen almacenada
   */
  async downloadAndStore(imageUrl, scanId, imageId, referer) {
    try {
      // Obtener la imagen
      const imageBuffer = await this._fetchImage(imageUrl, referer);
      
      if (!imageBuffer) {
        return null;
      }
      
      // Analizar la imagen para obtener metadatos
      const metadata = await this._getImageMetadata(imageBuffer);
      
      if (!metadata || !metadata.width || !metadata.height) {
        logger.warn(`Imagen inválida o corrupta: ${imageUrl}`);
        return null;
      }
      
      // Filtrar imágenes muy pequeñas
      if (metadata.width < config.MIN_IMAGE_WIDTH || metadata.height < config.MIN_IMAGE_HEIGHT) {
        logger.debug(`Imagen demasiado pequeña ignorada: ${imageUrl} (${metadata.width}x${metadata.height})`);
        return null;
      }
      
      // Generar nombre de archivo
      const fileExtension = this._getFileExtension(imageUrl, metadata.format);
      const fileName = `${imageId}.${fileExtension}`;
      const filePath = path.join(scanId, fileName);
      
      // Almacenar la imagen
      await storageService.storeFile(imageBuffer, filePath);
      
      // Crear objeto de información de la imagen
      return {
        id: imageId,
        originalUrl: imageUrl,
        localUrl: `/api/images/${scanId}/${fileName}`,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
        filename: fileName
      };
    } catch (error) {
      logger.error(`Error al procesar imagen ${imageUrl}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Obtiene una imagen almacenada
   * @param {string} scanId - ID del escaneo
   * @param {string} fileName - Nombre del archivo
   * @returns {Promise<Buffer>} - Buffer de la imagen
   */
  async getStoredImage(scanId, fileName) {
    try {
      const filePath = path.join(scanId, fileName);
      return await storageService.getFile(filePath);
    } catch (error) {
      logger.error(`Error al obtener imagen almacenada: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Descarga una imagen desde una URL
   * @private
   */
  async _fetchImage(url, referer) {
    try {
      return await httpClient.downloadImage(url, referer);
    } catch (error) {
      logger.warn(`Error al descargar imagen ${url}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Obtiene metadatos de una imagen
   * @private
   */
  async _getImageMetadata(buffer) {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      logger.warn(`Error al obtener metadatos de imagen: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Determina la extensión de archivo basada en la URL y formato
   * @private
   */
  _getFileExtension(url, format) {
    // Si tenemos el formato de la imagen, usarlo
    if (format) {
      return format.toLowerCase();
    }
    
    // Extraer extensión de la URL
    const urlPath = new URL(url).pathname;
    const extension = path.extname(urlPath).toLowerCase().replace('.', '');
    
    if (extension && /^(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(extension)) {
      return extension;
    }
    
    // Extensión por defecto
    return 'jpg';
  }
}

module.exports = new ImageService(); 