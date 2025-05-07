const logger = require('./logger');

class CssParser {
  extractImageUrls(css, baseUrl) {
    const imageUrls = new Set();
    
    try {
      // Extraer URLs de background-image
      const backgroundUrls = css.match(/background-image:\s*url\(['"]?([^'"()]+)['"]?\)/g) || [];
      backgroundUrls.forEach(match => {
        const url = match.replace(/background-image:\s*url\(['"]?([^'"()]+)['"]?\)/, '$1');
        if (url) imageUrls.add(url);
      });
      
      // Extraer URLs de background con url()
      const backgroundWithUrls = css.match(/background:.*url\(['"]?([^'"()]+)['"]?\)/g) || [];
      backgroundWithUrls.forEach(match => {
        const url = match.match(/url\(['"]?([^'"()]+)['"]?\)/)[1];
        if (url) imageUrls.add(url);
      });
      
      // Extraer URLs de @import
      const importUrls = css.match(/@import\s+['"]([^'"]+)['"]/g) || [];
      importUrls.forEach(match => {
        const url = match.replace(/@import\s+['"]([^'"]+)['"]/, '$1');
        if (url && url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          imageUrls.add(url);
        }
      });
      
      return Array.from(imageUrls);
    } catch (error) {
      logger.error(`Error al extraer URLs de CSS: ${error.message}`);
      return [];
    }
  }
}

module.exports = new CssParser(); 