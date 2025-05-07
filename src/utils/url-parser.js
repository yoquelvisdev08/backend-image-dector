/**
 * Utilidades para el manejo de URLs
 */

/**
 * Normaliza una URL asegurando que tenga el formato correcto
 * @param {string} url - URL a normalizar
 * @returns {URL} - Objeto URL normalizado
 */
function normalizeUrl(url) {
  if (!url) {
    throw new Error('URL no proporcionada');
  }
  
  // Añadir protocolo si no existe
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    return new URL(url);
  } catch (error) {
    throw new Error(`URL inválida: ${error.message}`);
  }
}

/**
 * Resuelve una URL relativa a una URL base
 * @param {string} relativeUrl - URL relativa
 * @param {URL} baseUrl - URL base
 * @returns {string} - URL absoluta
 */
function resolveUrl(relativeUrl, baseUrl) {
  if (!relativeUrl || !baseUrl) return null;
  
  try {
    // Limpiar la URL de espacios y caracteres no válidos
    relativeUrl = relativeUrl.trim()
      .replace(/\s+/g, '%20')
      .replace(/[\n\r]/g, '');
    
    // Ignorar URLs de datos y javascript
    if (relativeUrl.startsWith('data:') || 
        relativeUrl.startsWith('javascript:') ||
        relativeUrl.startsWith('about:')) {
      return null;
    }

    // Si ya es una URL absoluta válida, retornarla
    try {
      const urlObj = new URL(relativeUrl);
      return urlObj.href;
    } catch (e) {
      // No es una URL absoluta válida, continuar con el proceso
    }

    // Manejar URLs relativas al protocolo
    if (relativeUrl.startsWith('//')) {
      return `${baseUrl.protocol}${relativeUrl}`;
    }

    // Resolver URL relativa contra la base
    const resolvedUrl = new URL(relativeUrl, baseUrl.href);
    
    // Validar el protocolo
    if (!['http:', 'https:'].includes(resolvedUrl.protocol)) {
      return null;
    }

    return resolvedUrl.href;
  } catch (error) {
    logger.debug(`Error al resolver URL ${relativeUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Parsea un atributo srcset y extrae las URLs
 * @param {string} srcset - Atributo srcset
 * @param {URL} baseUrl - URL base para resolver URLs relativas
 * @returns {string[]} - Array de URLs
 */
function parseSrcset(srcset, baseUrl) {
  if (!srcset) return [];
  
  const urls = new Set();
  
  srcset.split(',').forEach(src => {
    const parts = src.trim().split(/\s+/);
    if (parts.length > 0) {
      const url = resolveUrl(parts[0], baseUrl);
      if (url) urls.add(url);
    }
  });
  
  return Array.from(urls);
}

/**
 * Extrae el nombre de archivo de una URL
 * @param {string} url - URL de la que extraer el nombre de archivo
 * @returns {string} - Nombre de archivo
 */
function extractFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Extraer el nombre de archivo
    const filename = pathname.split('/').pop();
    
    // Eliminar parámetros de consulta si existen
    return filename.split('?')[0];
  } catch (error) {
    // Si no se puede parsear la URL, devolver un nombre genérico
    return `image-${Date.now()}.jpg`;
  }
}

/**
 * Limpia una URL de parámetros de seguimiento comunes
 * @param {string} url - URL a limpiar
 * @returns {string} - URL limpia
 */
function cleanUrl(url) {
  try {
    if (!url) return null;
    
    // Convertir a objeto URL
    const urlObj = new URL(url);
    
    // Lista de extensiones de imagen válidas
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    
    // Verificar si la URL termina en una extensión de imagen válida
    const hasValidExtension = validExtensions.some(ext => 
      urlObj.pathname.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return null;
    }
    
    // Parámetros a mantener
    const validParams = [
      'w', 'width', 'h', 'height',
      'quality', 'q', 'size', 'format',
      'version', 'v', 'id'
    ];
    
    // Obtener parámetros actuales
    const params = new URLSearchParams(urlObj.search);
    const cleanParams = new URLSearchParams();
    
    // Mantener solo parámetros válidos
    for (const [key, value] of params) {
      if (validParams.includes(key.toLowerCase())) {
        cleanParams.append(key, value);
      }
    }
    
    // Reconstruir URL limpia
    urlObj.search = cleanParams.toString();
    urlObj.hash = '';
    
    // Normalizar protocolo a https cuando sea posible
    if (urlObj.protocol === 'http:' && !urlObj.hostname.includes('localhost')) {
      urlObj.protocol = 'https:';
    }
    
    return urlObj.toString();
  } catch (error) {
    logger.debug(`Error al limpiar URL ${url}: ${error.message}`);
    return null;
  }
}

module.exports = {
  normalizeUrl,
  resolveUrl,
  parseSrcset,
  extractFilename,
  cleanUrl
}; 