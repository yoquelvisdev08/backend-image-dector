require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');
const config = require('../src/config/storage.config');

/**
 * Script para limpiar manualmente archivos temporales
 */
async function cleanTempFiles() {
  const tempDir = config.TEMP_STORAGE_PATH;
  
  try {
    logger.info(`Iniciando limpieza manual de directorio: ${tempDir}`);
    
    // Verificar si el directorio existe
    try {
      await fs.access(tempDir);
    } catch (error) {
      logger.error(`El directorio ${tempDir} no existe`);
      process.exit(1);
    }
    
    // Eliminar todos los archivos excepto .gitkeep
    await deleteFilesRecursively(tempDir);
    
    logger.info('Limpieza manual completada con éxito');
    process.exit(0);
  } catch (error) {
    logger.error(`Error durante la limpieza manual: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Elimina archivos recursivamente en un directorio
 */
async function deleteFilesRecursively(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Ignorar .gitkeep
    if (entry.name === '.gitkeep') {
      continue;
    }
    
    if (entry.isDirectory()) {
      await deleteFilesRecursively(fullPath);
      
      // Eliminar directorio si está vacío
      const remainingFiles = await fs.readdir(fullPath);
      if (remainingFiles.length === 0) {
        await fs.rmdir(fullPath);
        logger.debug(`Eliminado directorio vacío: ${fullPath}`);
      }
    } else {
      await fs.unlink(fullPath);
      logger.debug(`Eliminado archivo: ${fullPath}`);
    }
  }
}

// Ejecutar limpieza
cleanTempFiles(); 