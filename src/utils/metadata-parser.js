const cheerio = require('cheerio');
const logger = require('./logger');

class MetadataParser {
  extractImageUrls(html, baseUrl) {
    const imageUrls = new Set();
    const $ = cheerio.load(html);
    
    try {
      // OpenGraph images
      $('meta[property="og:image"]').each((_, element) => {
        const content = $(element).attr('content');
        if (content) imageUrls.add(content);
      });
      
      // Twitter Card images
      $('meta[name="twitter:image"]').each((_, element) => {
        const content = $(element).attr('content');
        if (content) imageUrls.add(content);
      });
      
      // Schema.org / JSON-LD
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const json = JSON.parse($(element).html());
          this._extractImagesFromJsonLd(json, imageUrls);
        } catch (e) {
          logger.warn(`Error al parsear JSON-LD: ${e.message}`);
        }
      });
      
      // Otros metadatos comunes
      $('meta[property*="image"], meta[name*="image"]').each((_, element) => {
        const content = $(element).attr('content');
        if (content) imageUrls.add(content);
      });
      
      return Array.from(imageUrls);
    } catch (error) {
      logger.error(`Error al extraer URLs de metadatos: ${error.message}`);
      return [];
    }
  }
  
  _extractImagesFromJsonLd(json, imageUrls) {
    if (!json) return;
    
    if (typeof json === 'string' && json.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      imageUrls.add(json);
    } else if (Array.isArray(json)) {
      json.forEach(item => this._extractImagesFromJsonLd(item, imageUrls));
    } else if (typeof json === 'object') {
      for (const key in json) {
        if (key.toLowerCase().includes('image')) {
          const value = json[key];
          if (typeof value === 'string') {
            imageUrls.add(value);
          } else if (Array.isArray(value)) {
            value.forEach(url => {
              if (typeof url === 'string') imageUrls.add(url);
            });
          }
        }
        this._extractImagesFromJsonLd(json[key], imageUrls);
      }
    }
  }
}

module.exports = new MetadataParser(); 