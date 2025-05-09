const sharp = require('sharp');
const ExifParser = require('exif-parser');
const logger = require('../utils/logger');

class ImageAnalyzerService {
  async analyzeImage(buffer) {
    try {
      const [
        quality,
        colors,
        classification,
        exifData,
        watermark
      ] = await Promise.all([
        this.assessQuality(buffer),
        this.extractColors(buffer),
        this.classifyImageBySize(buffer),
        this.extractExif(buffer),
        this.detectWatermark(buffer)
      ]);

      return {
        quality,
        colors,
        classification,
        exifData,
        watermark
      };
    } catch (error) {
      logger.error(`Error en análisis de imagen: ${error.message}`);
      return null;
    }
  }

  async assessQuality(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Factores de calidad
      const factors = {
        resolution: Math.min(1, (metadata.width * metadata.height) / (3840 * 2160)),
        format: this._getFormatScore(metadata.format),
        compression: this._getCompressionScore(buffer.length, metadata.width * metadata.height)
      };

      const score = Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length * 100;

      return {
        score: Math.round(score),
        assessment: this._getQualityAssessment(score),
        factors
      };
    } catch (error) {
      logger.warn(`Error al evaluar calidad: ${error.message}`);
      return { score: 0, assessment: 'unknown' };
    }
  }

  async extractColors(buffer) {
    try {
      const { data, info } = await sharp(buffer)
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colors = this._extractDominantColors(data, info.channels);

      return {
        dominant: colors.dominant,
        palette: colors.palette
      };
    } catch (error) {
      logger.warn(`Error al extraer colores: ${error.message}`);
      return { dominant: null, palette: [] };
    }
  }

  async classifyImageBySize(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      const aspectRatio = metadata.width / metadata.height;

      // Clasificación basada en dimensiones y proporción
      let type = 'unknown';
      let confidence = 0.5;

      if (metadata.width >= 1200 && aspectRatio > 2.5) {
        type = 'banner';
        confidence = 0.8;
      } else if (metadata.width <= 200 && metadata.height <= 200) {
        type = 'thumbnail';
        confidence = 0.9;
      } else if (aspectRatio === 1) {
        type = 'square';
        confidence = 0.9;
      } else if (aspectRatio >= 1.9) {
        type = 'landscape';
        confidence = 0.7;
      } else if (aspectRatio <= 0.6) {
        type = 'portrait';
        confidence = 0.7;
      }

      return {
        type,
        confidence,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
          aspectRatio
        }
      };
    } catch (error) {
      logger.warn(`Error al clasificar imagen: ${error.message}`);
      return { type: 'unknown', confidence: 0 };
    }
  }

  async detectWatermark(buffer) {
    try {
      // Convertir a escala de grises
      const grayImage = await sharp(buffer)
        .greyscale()
        .normalize()
        .toBuffer();

      // Detectar patrones repetitivos (característica común de marcas de agua)
      const patterns = await this._detectRepetitivePatterns(grayImage);
      
      // Analizar transparencia
      const transparency = await this._analyzeTransparency(buffer);
      
      // Detectar texto semi-transparente
      const textDetection = await this._detectSemiTransparentText(buffer);

      const hasWatermark = patterns.score > 0.7 || 
                          transparency.score > 0.8 || 
                          textDetection.score > 0.75;

      return {
        detected: hasWatermark,
        confidence: Math.max(patterns.score, transparency.score, textDetection.score),
        type: this._determineWatermarkType(patterns, transparency, textDetection)
      };
    } catch (error) {
      logger.warn(`Error al detectar marca de agua: ${error.message}`);
      return { detected: false, confidence: 0 };
    }
  }

  async extractExif(buffer) {
    try {
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      return {
        make: result.tags.Make,
        model: result.tags.Model,
        software: result.tags.Software,
        created: result.tags.CreateDate,
        modified: result.tags.ModifyDate,
        artist: result.tags.Artist,
        copyright: result.tags.Copyright,
        gps: result.tags.GPSInfo ? {
          latitude: result.tags.GPSLatitude,
          longitude: result.tags.GPSLongitude
        } : null
      };
    } catch (error) {
      logger.warn(`Error al extraer EXIF: ${error.message}`);
      return null;
    }
  }

  // Métodos auxiliares
  _getFormatScore(format) {
    const scores = {
      webp: 1,
      png: 0.9,
      jpeg: 0.8,
      gif: 0.7,
      other: 0.5
    };
    return scores[format] || scores.other;
  }

  _getCompressionScore(size, pixels) {
    const bpp = (size * 8) / pixels;
    return Math.min(1, 24 / bpp);
  }

  _getQualityAssessment(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  _extractDominantColors(data, channels) {
    // Implementación simple de extracción de colores
    const pixels = [];
    for (let i = 0; i < data.length; i += channels) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }

    // Agrupar colores similares
    const colorGroups = this._groupSimilarColors(pixels);
    
    // Ordenar por frecuencia
    const sortedColors = Object.entries(colorGroups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color]) => color);

    return {
      dominant: sortedColors[0],
      palette: sortedColors
    };
  }

  _groupSimilarColors(pixels) {
    const groups = {};
    pixels.forEach(pixel => {
      const key = this._getRoundedColorKey(pixel);
      groups[key] = (groups[key] || 0) + 1;
    });
    return groups;
  }

  _getRoundedColorKey(pixel) {
    // Redondear a los 16 colores más cercanos para cada canal
    const r = Math.round(pixel.r / 16) * 16;
    const g = Math.round(pixel.g / 16) * 16;
    const b = Math.round(pixel.b / 16) * 16;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  async _detectRepetitivePatterns(buffer) {
    // Implementar detección de patrones usando autocorrelación
    return { score: 0.5 }; // Placeholder
  }

  async _analyzeTransparency(buffer) {
    // Implementar análisis de transparencia
    return { score: 0.5 }; // Placeholder
  }

  async _detectSemiTransparentText(buffer) {
    // Implementar detección de texto semi-transparente
    return { score: 0.5 }; // Placeholder
  }

  _determineWatermarkType(patterns, transparency, textDetection) {
    // Determinar tipo de marca de agua basado en las detecciones
    return 'unknown';
  }
}

module.exports = new ImageAnalyzerService(); 