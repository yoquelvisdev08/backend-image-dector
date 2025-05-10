const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const getColors = require('get-image-colors');

class ImageModel {
  constructor(imageData) {
    this.originalData = imageData;
    this.processedData = null;
  }

  async process() {
    try {
      const metadata = await this.extractMetadata();
      const colors = await this.extractDominantColors();
      const format = this.detectFormat();
      const size = await this.calculateSize();
      const isResponsive = this.checkIfResponsive();
      const context = await this.extractContext();
      const filters = this.calculateFilters();
      const accessibility = this.analyzeAccessibility();

      this.processedData = {
        ...this.originalData,
        metadata: {
          ...metadata,
          colors,
          format,
          size,
          isResponsive
        },
        context,
        filters,
        accessibility
      };

      return this.processedData;
    } catch (error) {
      console.error('Error procesando imagen:', error);
      return this.originalData;
    }
  }

  async extractMetadata() {
    try {
      const response = await fetch(this.originalData.src);
      const buffer = await response.buffer();
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        orientation: metadata.orientation,
        hasAlpha: metadata.hasAlpha,
        hasProfile: metadata.hasProfile,
        isProgressive: metadata.isProgressive
      };
    } catch (error) {
      console.error('Error extrayendo metadatos:', error);
      return {};
    }
  }

  async extractDominantColors() {
    try {
      const response = await fetch(this.originalData.src);
      const buffer = await response.buffer();
      const colors = await getColors(buffer, { count: 5 });

      return colors.map(color => ({
        hex: color.hex(),
        rgb: color.rgb().join(','),
        hsl: color.hsl().join(',')
      }));
    } catch (error) {
      console.error('Error extrayendo colores:', error);
      return [];
    }
  }

  detectFormat() {
    const url = this.originalData.src.toLowerCase();
    if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'JPEG';
    if (url.endsWith('.png')) return 'PNG';
    if (url.endsWith('.gif')) return 'GIF';
    if (url.endsWith('.webp')) return 'WebP';
    if (url.endsWith('.svg')) return 'SVG';
    return 'Unknown';
  }

  async calculateSize() {
    try {
      const response = await fetch(this.originalData.src);
      const buffer = await response.buffer();
      const sizeInBytes = buffer.length;
      
      return {
        bytes: sizeInBytes,
        kilobytes: (sizeInBytes / 1024).toFixed(2),
        megabytes: (sizeInBytes / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Error calculando tamaño:', error);
      return { bytes: 0, kilobytes: '0', megabytes: '0' };
    }
  }

  checkIfResponsive() {
    const { width, height } = this.originalData;
    if (!width || !height) return false;

    // Verificar si la imagen tiene dimensiones responsivas
    const hasResponsiveWidth = width >= 300 && width <= 2000;
    const hasResponsiveHeight = height >= 200 && height <= 1500;
    const hasGoodAspectRatio = width / height >= 0.5 && width / height <= 2;

    return hasResponsiveWidth && hasResponsiveHeight && hasGoodAspectRatio;
  }

  getOptimizationSuggestions() {
    const suggestions = [];
    const { width, height, format } = this.originalData;

    // Sugerir WebP para imágenes grandes
    if (format !== 'WebP' && width > 800) {
      suggestions.push('Considerar convertir a WebP para mejor compresión');
    }

    // Sugerir redimensionar imágenes muy grandes
    if (width > 2000 || height > 1500) {
      suggestions.push('Considerar redimensionar la imagen para mejorar el rendimiento');
    }

    // Sugerir optimización para imágenes PNG
    if (format === 'PNG') {
      suggestions.push('Considerar optimizar el PNG con herramientas como pngquant');
    }

    return suggestions;
  }

  async extractContext() {
    try {
      const context = {
        nearbyText: this.originalData.nearbyText || '',
        relatedLinks: this.originalData.relatedLinks || [],
        isInCarousel: this.originalData.isInCarousel || false,
        section: this.originalData.section || '',
        isInMenu: this.originalData.isInMenu || false,
        parentElement: this.originalData.parentElement || '',
        siblings: this.originalData.siblings || []
      };

      // Determinar si está en un menú basado en el contexto
      if (this.originalData.parentElement) {
        const parentLower = this.originalData.parentElement.toLowerCase();
        context.isInMenu = parentLower.includes('nav') || 
                          parentLower.includes('menu') || 
                          parentLower.includes('header');
      }

      // Determinar si está en un carrusel
      if (this.originalData.parentElement) {
        const parentLower = this.originalData.parentElement.toLowerCase();
        context.isInCarousel = parentLower.includes('carousel') || 
                              parentLower.includes('slider') || 
                              parentLower.includes('swiper');
      }

      // Determinar la sección basada en la posición y el contexto
      if (this.originalData.top) {
        if (this.originalData.top < 300) {
          context.section = 'header';
        } else if (this.originalData.top < 800) {
          context.section = 'main';
        } else {
          context.section = 'footer';
        }
      }

      return context;
    } catch (error) {
      console.error('Error extrayendo contexto:', error);
      return {
        nearbyText: '',
        relatedLinks: [],
        isInCarousel: false,
        section: '',
        isInMenu: false,
        parentElement: '',
        siblings: []
      };
    }
  }

  calculateFilters() {
    const { width, height } = this.originalData;
    if (!width || !height) return {};

    // Calcular ratio de aspecto
    const aspectRatio = width / height;
    let orientation = 'square';
    if (aspectRatio > 1.2) orientation = 'landscape';
    else if (aspectRatio < 0.8) orientation = 'portrait';

    // Determinar ubicación en la página
    let pageLocation = 'middle';
    if (this.originalData.top < 300) pageLocation = 'top';
    else if (this.originalData.top > 800) pageLocation = 'bottom';

    // Determinar tipo de contenedor
    let containerType = 'unknown';
    if (this.originalData.parentElement) {
      const parent = this.originalData.parentElement.toLowerCase();
      if (parent.includes('header')) containerType = 'header';
      else if (parent.includes('footer')) containerType = 'footer';
      else if (parent.includes('nav')) containerType = 'navigation';
      else if (parent.includes('main')) containerType = 'main';
      else if (parent.includes('aside')) containerType = 'sidebar';
    }

    // Calcular calidad de imagen
    let quality = 'medium';
    if (width >= 1920 || height >= 1080) quality = 'high';
    else if (width <= 640 && height <= 480) quality = 'low';

    return {
      aspectRatio: parseFloat(aspectRatio.toFixed(2)),
      orientation,
      pageLocation,
      containerType,
      quality
    };
  }

  analyzeAccessibility() {
    const { alt, width, height, src } = this.originalData;
    const issues = [];
    const suggestions = [];

    // Validar texto alternativo
    if (!alt || alt === '') {
      issues.push('missing-alt');
      suggestions.push('Añadir un texto alternativo descriptivo');
    } else if (alt === 'Imagen sin descripción') {
      issues.push('generic-alt');
      suggestions.push('Reemplazar el texto genérico con una descripción específica');
    } else if (alt.length < 3) {
      issues.push('short-alt');
      suggestions.push('El texto alternativo es demasiado corto');
    }

    // Validar dimensiones
    if (!width || !height) {
      issues.push('missing-dimensions');
      suggestions.push('Especificar dimensiones de la imagen');
    }

    // Validar si es decorativa
    const isDecorative = alt === '' || alt === 'decorative' || alt === 'decorativo';
    if (isDecorative) {
      suggestions.push('Considerar usar role="presentation" para imágenes decorativas');
    }

    // Validar si tiene atributos ARIA
    const hasAria = this.originalData.hasAria || false;
    if (!hasAria && !isDecorative) {
      suggestions.push('Considerar añadir atributos ARIA para mejorar la accesibilidad');
    }

    // Validar si tiene descripción larga
    const hasLongDesc = this.originalData.hasLongDesc || false;
    if (!hasLongDesc && alt && alt.length > 100) {
      suggestions.push('Considerar usar aria-describedby para descripciones largas');
    }

    return {
      issues,
      suggestions,
      score: this.calculateAccessibilityScore(issues),
      hasAria,
      hasLongDesc,
      isDecorative
    };
  }

  calculateAccessibilityScore(issues) {
    const totalChecks = 5; // Número total de verificaciones
    const failedChecks = issues.length;
    return Math.max(0, Math.round(((totalChecks - failedChecks) / totalChecks) * 100));
  }
}

module.exports = ImageModel; 