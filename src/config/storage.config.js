const path = require('path');

/**
 * Configuración del almacenamiento temporal
 */
module.exports = {
  // Ruta base para almacenamiento temporal
  TEMP_STORAGE_PATH: process.env.TEMP_STORAGE_PATH || path.join(__dirname, '../../temp'),
  
  // Tiempo de vida de los archivos en milisegundos (1 hora por defecto)
  FILE_TTL: parseInt(process.env.FILE_TTL || '3600000', 10),
  
  // Intervalo de limpieza en milisegundos (15 minutos por defecto)
  CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL || '900000', 10)
}; 