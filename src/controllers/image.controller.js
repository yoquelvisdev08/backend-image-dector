const imageService = require('../services/image.service');
const logger = require('../utils/logger');
const path = require('path');
const fileUtils = require('../utils/file-utils');

class ImageController {
  /**
   * Obtiene una imagen almacenada
   */
  async getImage(req, res) {
    try {
      const { scanId, fileName } = req.params;
      
      if (!scanId || !fileName) {
        return res.status(400).json({
          success: false,
          error: 'Parámetros incompletos'
        });
      }
      
      // Obtener la imagen
      const imageBuffer = await imageService.getStoredImage(scanId, fileName);
      
      // Determinar tipo de contenido
      const contentType = fileUtils.getMimeTypeFromFilename(fileName);
      
      // Enviar imagen
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // Cachear por 24 horas
      return res.send(imageBuffer);
    } catch (error) {
      logger.error(`Error al obtener imagen: ${error.message}`);
      
      return res.status(404).json({
        success: false,
        error: 'Imagen no encontrada'
      });
    }
  }
}

module.exports = new ImageController(); 