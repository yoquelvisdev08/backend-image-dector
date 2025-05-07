const axios = require('axios');
const logger = require('./logger');
const config = require('../config/app.config');

/**
 * Cliente HTTP personalizado con funcionalidades adicionales
 */
class HttpClient {
  /**
   * Realiza una solicitud HTTP con reintentos
   * @param {Object} options - Opciones de la solicitud
   * @param {number} retries - Número de reintentos
   * @param {number} delay - Retraso entre reintentos en ms
   * @returns {Promise<Object>} - Respuesta de la solicitud
   */
  async request(options, retries = 3, delay = 1000) {
    try {
      // Configurar opciones por defecto
      const requestOptions = {
        timeout: config.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': config.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        },
        ...options
      };
      
      return await axios(requestOptions);
    } catch (error) {
      if (retries > 0) {
        logger.warn(`Error en solicitud HTTP, reintentando (${retries} intentos restantes): ${error.message}`);
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reintentar con un retraso exponencial
        return this.request(options, retries - 1, delay * 2);
      }
      
      logger.error(`Error en solicitud HTTP después de reintentos: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Descarga una imagen como buffer
   * @param {string} url - URL de la imagen
   * @param {string} referer - URL de referencia
   * @returns {Promise<Buffer>} - Buffer de la imagen
   */
  async downloadImage(url, referer) {
    try {
      const response = await this.request({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: config.IMAGE_DOWNLOAD_TIMEOUT,
        headers: {
          'User-Agent': config.USER_AGENT,
          'Referer': referer || new URL(url).origin,
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        },
        maxRedirects: 5
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Error al descargar imagen ${url}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene el HTML de una página
   * @param {string} url - URL de la página
   * @returns {Promise<string>} - HTML de la página
   */
  async getHtml(url) {
    try {
      const response = await this.request({
        method: 'GET',
        url,
        headers: {
          'User-Agent': config.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error al obtener HTML de ${url}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new HttpClient(); 