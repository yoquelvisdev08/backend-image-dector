const normalizeImageUrl = (src, baseUrl) => {
  try {
    // Remover espacios y caracteres especiales
    src = src.trim().replace(/[\n\r\t]/g, '');
    
    // Si es data URL, ignorar
    if (src.startsWith('data:')) return null;
    
    // Si es una URL absoluta
    if (src.match(/^https?:\/\//i)) {
      return src;
    }
    
    // Manejar URLs relativas
    if (src.startsWith('//')) {
      // URLs protocol-relative
      return `https:${src}`;
    } else if (src.startsWith('/')) {
      // URLs root-relative
      return `${baseUrl}${src}`;
    } else {
      // Otras URLs relativas
      return new URL(src, baseUrl).href;
    }
  } catch (error) {
    console.error(`Error normalizando URL: ${src}`, error);
    return null;
  }
};

const isValidImageUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const extension = parsedUrl.pathname.split('.').pop().toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
    return validExtensions.includes(extension);
  } catch {
    return false;
  }
};

const getImageDimensions = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.startsWith('image/')) {
      return { width: 0, height: 0 };
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  } catch (error) {
    console.error('Error obteniendo dimensiones:', error);
    return { width: 0, height: 0 };
  }
};

module.exports = {
  normalizeImageUrl,
  isValidImageUrl,
  getImageDimensions
}; 