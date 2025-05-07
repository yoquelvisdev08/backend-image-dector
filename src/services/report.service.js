const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const config = require('../config/storage.config');
const { v4: uuidv4 } = require('uuid');
const imageAnalyzer = require('./image-analyzer.service');
const { removeDirectory } = require('../scripts/clean-temp');

class ReportService {
  async generateReport(url, images) {
    let scanDir = null;
    
    try {
      const scanId = `scan_${Date.now()}_${uuidv4().substring(0, 8)}`;
      const siteName = new URL(url).hostname.replace(/[^a-z0-9]/gi, '_');
      scanDir = path.join(config.TEMP_STORAGE_PATH, siteName, scanId);
      const imagesDir = path.join(scanDir, 'images');
      
      await fs.mkdir(imagesDir, { recursive: true });
      
      // Analizar imágenes y generar informe
      const imageReports = await Promise.all(
        images.map(img => this._analyzeImage(img, imagesDir))
      );
      
      // Generar estadísticas
      const stats = this._generateStats(imageReports);
      
      // Crear informe completo
      const report = {
        scanId,
        url,
        timestamp: new Date().toISOString(),
        summary: {
          totalImages: images.length,
          totalSize: stats.totalSize,
          averageSize: stats.averageSize,
          formatDistribution: stats.formatDistribution,
          qualityDistribution: stats.qualityDistribution,
          dominantColors: stats.dominantColors
        },
        images: imageReports,
        metadata: {
          scanDuration: stats.scanDuration,
          toolVersion: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version
        }
      };
      
      // Guardar informe
      const reportPath = path.join(scanDir, 'report.json');
      await fs.writeFile(
        reportPath, 
        JSON.stringify(report, null, 2)
      );
      
      logger.info(`Informe generado: ${reportPath}`);
      return report;
      
    } catch (error) {
      if (scanDir) {
        await this._cleanupOnError(scanDir);
      }
      logger.error(`Error al generar informe: ${error.message}`);
      throw error;
    }
  }
  
  async _analyzeImage(image, imagesDir) {
    try {
      const imageBuffer = await fs.readFile(image.path);
      const metadata = await sharp(imageBuffer).metadata();
      
      // Usar el nuevo servicio de análisis
      const analysis = await imageAnalyzer.analyzeImage(imageBuffer);
      
      return {
        id: image.id,
        originalUrl: image.originalUrl,
        localPath: path.relative(config.TEMP_STORAGE_PATH, image.path),
        format: metadata.format,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
          aspectRatio: metadata.width / metadata.height
        },
        size: {
          bytes: imageBuffer.length,
          formatted: this._formatBytes(imageBuffer.length)
        },
        quality: analysis.quality,
        colors: analysis.colors,
        metadata: {
          exif: analysis.exifData,
          watermark: analysis.watermark,
          classification: analysis.classification
        }
      };
    } catch (error) {
      logger.warn(`Error al analizar imagen ${image.id}: ${error.message}`);
      return null;
    }
  }
  
  _generateStats(imageReports) {
    const validReports = imageReports.filter(Boolean);
    
    const totalSize = validReports.reduce((sum, img) => sum + img.size.bytes, 0);
    
    const formatDist = validReports.reduce((acc, img) => {
      acc[img.format] = (acc[img.format] || 0) + 1;
      return acc;
    }, {});
    
    const qualityDist = validReports.reduce((acc, img) => {
      acc[img.quality.assessment] = (acc[img.quality.assessment] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalSize: this._formatBytes(totalSize),
      averageSize: this._formatBytes(totalSize / validReports.length),
      formatDistribution: formatDist,
      qualityDistribution: qualityDist,
      scanDuration: Date.now() - parseInt(validReports[0]?.id.split('_')[1], 10)
    };
  }
  
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  async _saveImage(buffer, imagesDir, index) {
    try {
      const filename = `img_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
      const imagePath = path.join(imagesDir, filename);
      
      // Cerrar el buffer después de usarlo
      await sharp(buffer)
        .jpeg({ quality: 85 })
        .toFile(imagePath);
      
      return imagePath;
    } catch (error) {
      logger.error(`Error al guardar imagen: ${error.message}`);
      throw error;
    }
  }

  async _cleanupOnError(directory) {
    try {
      await removeDirectory(directory);
    } catch (error) {
      logger.warn(`Error al limpiar directorio temporal ${directory}: ${error.message}`);
    }
  }
}

module.exports = new ReportService(); 