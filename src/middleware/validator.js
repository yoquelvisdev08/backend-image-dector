const { URL } = require('url');
const logger = require('../utils/logger');

/**
 * Middleware para validar URL
 */
function validateUrl(req, res, next) {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'URL no proporcionada',
        code: 'MISSING_URL'
      }
    });
  }
  
  try {
    // Intentar parsear la URL
    let parsedUrl = url;
    
    // Añadir protocolo si no existe
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      parsedUrl = 'https://' + url;
    }
    
    new URL(parsedUrl);
    
    // Actualizar la URL en el cuerpo de la solicitud
    req.body.url = parsedUrl;
    
    next();
  } catch (error) {
    logger.warn(`URL inválida: ${url}`);
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'URL inválida',
        code: 'INVALID_URL'
      }
    });
  }
}

module.exports = {
  validateUrl
}; 