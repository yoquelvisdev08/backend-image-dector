const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { URL } = require('url');
const logger = require('../utils/logger');
const imageService = require('./image.service');
const storageService = require('./storage.service');
const httpClient = require('../utils/http-client');
const urlParser = require('../utils/url-parser');
const config = require('../config/scraper.config');
const cssParser = require('../utils/css-parser');
const metadataParser = require('../utils/metadata-parser');
const reportService = require('./report.service');

class ScraperService {
  /**
   * Escanea un sitio web y extrae todas las imágenes
   * @param {string} url - URL del sitio a escanear
   * @returns {Promise<Object>} - Objeto con información del escaneo
   */
  async scanWebsite(url) {
    logger.info(`Iniciando escaneo de: ${url}`);
    
    try {
      const targetUrl = urlParser.normalizeUrl(url);
      const needsPuppeteer = this._needsPuppeteer(targetUrl.hostname);
      
      let html, stylesheets, iframeContents;
      
      if (needsPuppeteer) {
        ({ html, stylesheets, iframeContents } = await this._getContentWithPuppeteer(targetUrl.href));
      } else {
        ({ html, stylesheets } = await this._getContentWithAxios(targetUrl.href));
      }
      
      // Extraer todas las imágenes de diferentes fuentes
      const imageUrls = new Map();
      
      // 1. Imágenes del HTML principal
      const mainImages = await this._extractImageUrls(html, targetUrl);
      mainImages.forEach(url => imageUrls.set(url, { source: 'main' }));
      
      // 2. Imágenes de iframes
      if (iframeContents) {
        for (const iframeHtml of iframeContents) {
          const iframeImages = await this._extractImageUrls(iframeHtml, targetUrl);
          iframeImages.forEach(url => imageUrls.set(url, { source: 'iframe' }));
        }
      }
      
      // 3. Imágenes de CSS
      for (const css of stylesheets) {
        const cssImages = cssParser.extractImageUrls(css, targetUrl);
        cssImages.forEach(url => imageUrls.set(url, { source: 'css' }));
      }
      
      // 4. Imágenes de metadatos
      const metadataImages = metadataParser.extractImageUrls(html, targetUrl);
      metadataImages.forEach(url => imageUrls.set(url, { source: 'metadata' }));
      
      // Procesar las imágenes encontradas
      const processedImages = await this._processImages(Array.from(imageUrls.keys()), targetUrl);
      
      // Generar informe detallado
      const report = await reportService.generateReport(targetUrl.href, processedImages);
      
      return {
        url: targetUrl.href,
        images: processedImages,
        report: report,
        scannedAt: new Date().toISOString(),
        stats: {
          total: processedImages.length,
          bySource: {
            main: processedImages.filter(img => img.source === 'main').length,
            iframe: processedImages.filter(img => img.source === 'iframe').length,
            css: processedImages.filter(img => img.source === 'css').length,
            metadata: processedImages.filter(img => img.source === 'metadata').length
          }
        }
      };
    } catch (error) {
      logger.error(`Error al escanear sitio: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Determina si se debe usar Puppeteer para un dominio
   * @private
   */
  _needsPuppeteer(hostname) {
    // Si está configurado para usar siempre Puppeteer
    if (config.ALWAYS_USE_PUPPETEER) {
      return true;
    }
    
    // Verificar si el dominio está en la lista de dominios que requieren Puppeteer
    return config.PUPPETEER_DOMAINS.some(domain => hostname.includes(domain));
  }
  
  /**
   * Obtiene el HTML de una página usando Axios
   * @private
   */
  async _getContentWithAxios(url) {
    try {
      const html = await httpClient.getHtml(url);
      const stylesheets = [];
      return { html, stylesheets };
    } catch (error) {
      logger.error(`Error al obtener HTML con Axios: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene el HTML de una página usando Puppeteer
   * @private
   */
  async _getContentWithPuppeteer(url) {
    let browser = null;
    
    try {
      logger.debug(`Iniciando navegador Puppeteer para ${url}`);
      
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      
      // Configurar user agent
      await page.setUserAgent(config.USER_AGENT);
      
      // Configurar timeout
      await page.setDefaultNavigationTimeout(config.REQUEST_TIMEOUT);
      
      // Ignorar recursos que no necesitamos
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Navegar a la URL
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Esperar a que se cargue el contenido
      await page.waitForSelector('img', { timeout: 5000 }).catch(() => {
        logger.debug('No se encontraron imágenes o timeout alcanzado');
      });
      
      // Obtener el HTML
      const html = await page.content();
      
      const stylesheets = [];
      const iframeContents = [];
      
      // Extraer estilos
      const styleElements = await page.$$('style');
      for (const element of styleElements) {
        const css = await page.evaluate(el => el.textContent, element);
        stylesheets.push(css);
      }
      
      // Extraer contenido de iframes
      const iframeElements = await page.$$('iframe');
      for (const element of iframeElements) {
        const src = await page.evaluate(el => el.src, element);
        if (src) {
          const iframePage = await browser.newPage();
          await iframePage.goto(src, { waitUntil: 'networkidle2' });
          const iframeHtml = await iframePage.content();
          iframeContents.push(iframeHtml);
        }
      }
      
      return { html, stylesheets, iframeContents };
    } catch (error) {
      logger.error(`Error al obtener HTML con Puppeteer: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        logger.debug('Navegador Puppeteer cerrado');
      }
    }
  }
  
  /**
   * Extrae URLs de imágenes del HTML
   * @private
   */
  async _extractImageUrls(html, baseUrl) {
    const $ = cheerio.load(html);
    const imageUrls = new Map();
    
    // Función auxiliar para procesar URLs
    const processUrl = (url) => {
      if (!url) return null;
      try {
        // Limpiar la URL
        url = url.trim().replace(/[\n\r\s]+/g, ' ');
        
        // Ignorar URLs de datos
        if (url.startsWith('data:')) return null;
        
        // Convertir a URL absoluta
        const absoluteUrl = urlParser.resolveUrl(url, baseUrl);
        if (!absoluteUrl) return null;
        
        // Limpiar y validar la URL
        const cleanedUrl = urlParser.cleanUrl(absoluteUrl);
        if (!cleanedUrl) return null;
        
        return cleanedUrl;
      } catch (e) {
        logger.debug(`Error procesando URL ${url}: ${e.message}`);
        return null;
      }
    };

    // Extraer imágenes con varios selectores
    const imageSelectors = [
      'img[src]',
      'img[data-src]',
      'img[data-lazy-src]',
      'picture source[srcset]',
      'picture source[src]',
      '[style*="background-image"]',
      '[data-bg]',
      '[data-background]'
    ];

    imageSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $el = $(element);
        
        // Procesar diferentes atributos
        ['src', 'data-src', 'data-lazy-src', 'data-bg', 'data-background'].forEach(attr => {
          const url = processUrl($el.attr(attr));
          if (url) imageUrls.set(url, { source: 'main' });
        });
        
        // Procesar srcset
        const srcset = $el.attr('srcset');
        if (srcset) {
          const urls = urlParser.parseSrcset(srcset, baseUrl);
          urls.forEach(url => {
            const processedUrl = processUrl(url);
            if (processedUrl) imageUrls.set(processedUrl, { source: 'main' });
          });
        }
        
        // Procesar estilos inline
        const style = $el.attr('style');
        if (style) {
          const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/g);
          if (matches) {
            matches.forEach(match => {
              const url = match.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1');
              const processedUrl = processUrl(url);
              if (processedUrl) imageUrls.set(processedUrl, { source: 'css' });
            });
          }
        }
      });
    });

    return Array.from(imageUrls.keys());
  }
  
  /**
   * Procesa las imágenes encontradas
   * @private
   */
  async _processImages(imageUrls, baseUrl) {
    const processedImages = [];
    
    // Generar un ID único para este escaneo
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Procesar cada imagen en paralelo con límite de concurrencia
    const concurrencyLimit = config.DOWNLOAD_CONCURRENCY;
    const chunks = this._chunkArray(imageUrls, concurrencyLimit);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (imageUrl, index) => {
        try {
          // Generar un nombre de archivo único
          const imageId = `img_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          
          // Descargar y almacenar la imagen
          const imageInfo = await imageService.downloadAndStore(
            imageUrl, 
            scanId, 
            imageId,
            baseUrl.href
          );
          
          if (imageInfo) {
            processedImages.push(imageInfo);
          }
        } catch (error) {
          logger.warn(`Error al procesar imagen ${imageUrl}: ${error.message}`);
          // Continuar con la siguiente imagen
          return null;
        }
      });
      
      await Promise.all(promises);
    }
    
    return processedImages.filter(Boolean);
  }
  
  /**
   * Divide un array en chunks para procesamiento en paralelo
   * @private
   */
  _chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

module.exports = new ScraperService(); 