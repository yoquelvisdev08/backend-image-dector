const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

async function forceRemoveDirectory(dirPath) {
  try {
    // En Windows, intentar múltiples veces con un pequeño retraso
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        // Primero eliminar todos los archivos
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            await forceRemoveDirectory(fullPath);
          } else {
            try {
              await fs.unlink(fullPath);
            } catch (err) {
              if (err.code === 'EPERM' || err.code === 'EBUSY') {
                // En Windows, forzar la eliminación
                const { execSync } = require('child_process');
                execSync(`del /f /q "${fullPath}"`);
              } else {
                throw err;
              }
            }
          }
        }
        
        // Luego intentar eliminar el directorio
        await fs.rmdir(dirPath);
        break; // Si llegamos aquí, la eliminación fue exitosa
        
      } catch (err) {
        if (attempt === 3) throw err; // En el último intento, propagar el error
        
        // Esperar un momento antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`No se pudo eliminar ${dirPath}: ${error.message}`);
    }
  }
}

async function cleanTemp(force = false) {
  try {
    const tempDir = path.join(__dirname, '../../temp');
    const now = Date.now();
    const maxAge = force ? 0 : 24 * 60 * 60 * 1000; // 0 para forzar, 24h normalmente
    let filesRemoved = 0;

    // Verificar si el directorio existe
    try {
      await fs.access(tempDir);
    } catch {
      logger.info('Directorio temp no existe, nada que limpiar');
      return;
    }

    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    
    // Mantener .gitkeep
    const filteredEntries = entries.filter(entry => entry.name !== '.gitkeep');
    
    for (const entry of filteredEntries) {
      const fullPath = path.join(tempDir, entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge || force) {
          if (entry.isDirectory()) {
            await forceRemoveDirectory(fullPath);
          } else {
            await fs.unlink(fullPath);
          }
          filesRemoved++;
        }
      } catch (error) {
        logger.warn(`Error procesando ${fullPath}: ${error.message}`);
      }
    }

    logger.info(`Limpieza completada. ${filesRemoved} elementos eliminados.`);
  } catch (error) {
    logger.error(`Error durante la limpieza: ${error.message}`);
  }
}

// Manejar argumentos de línea de comandos
if (require.main === module) {
  const force = process.argv.includes('--force');
  cleanTemp(force).catch(error => {
    logger.error('Error en script de limpieza:', error);
    process.exit(1);
  });
}

module.exports = { cleanTemp, removeDirectory: forceRemoveDirectory }; 