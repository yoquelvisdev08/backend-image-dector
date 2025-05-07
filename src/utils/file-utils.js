const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

/**
 * Utilidades para el manejo de archivos
 */

/**
 * Crea un directorio recursivamente si no existe
 * @param {string} dirPath - Ruta del directorio a crear
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error(`Error al crear directorio ${dirPath}: ${error.message}`);
    throw error;
  }
}

/**
 * Determina la extensión de archivo basada en el tipo MIME
 * @param {string} mimeType - Tipo MIME
 * @returns {string} - Extensión de archivo
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
  };
  
  return mimeToExt[mimeType] || 'jpg';
}

/**
 * Determina el tipo MIME basado en la extensión de archivo
 * @param {string} filename - Nombre de archivo
 * @returns {string} - Tipo MIME
 */
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  
  const extToMime = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff'
  };
  
  return extToMime[ext] || 'application/octet-stream';
}

/**
 * Genera un nombre de archivo único
 * @param {string} originalFilename - Nombre de archivo original
 * @returns {string} - Nombre de archivo único
 */
function generateUniqueFilename(originalFilename) {
  const ext = path.extname(originalFilename);
  const name = path.basename(originalFilename, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  return `${name}_${timestamp}_${random}${ext}`;
}

/**
 * Elimina un archivo si existe
 * @param {string} filePath - Ruta del archivo a eliminar
 * @returns {Promise<boolean>} - true si se eliminó, false si no existía
 */
async function removeFileIfExists(filePath) {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Verifica si un archivo existe
 * @param {string} filePath - Ruta del archivo a verificar
 * @returns {Promise<boolean>} - true si existe, false si no
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  ensureDirectoryExists,
  getExtensionFromMimeType,
  getMimeTypeFromFilename,
  generateUniqueFilename,
  removeFileIfExists,
  fileExists
}; 