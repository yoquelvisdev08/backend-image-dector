const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { getRandomUserAgent } = require('../utils/userAgents');
const { normalizeImageUrl } = require('../utils/imageUtils');

class ThanosService {
  constructor() {
    this.browser = null;
    this.maxRetries = 2;
    this.timeout = 30000; // Reducido a 30 segundos
    this.retryDelay = 1000;
    this.browserWSEndpoint = null;
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hora
  }

  // Headers específicos para sitios premium
  getPremiumHeaders(targetUrl) {
    const origin = new URL(targetUrl).origin;
    const host = new URL(targetUrl).host;
    
    return {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1',
      'Referer': 'https://www.google.com/',
      'Origin': origin,
      'Host': host
    };
  }

  // Inicializar el navegador de Puppeteer con manejo de errores mejorado
  async initBrowser() {
    if (this.browser) {
      try {
        const pages = await this.browser.pages();
        if (pages.length > 0) {
          return this.browser;
        }
      } catch (error) {
        console.log('Navegador existente no responde, creando uno nuevo...');
        this.browser = null;
      }
    }

    try {
      const launchOptions = {
        headless: 'new',
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-extensions',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--mute-audio',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--password-store=basic',
          '--disable-features=site-per-process',
          '--disable-site-isolation-trials',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-web-security',
          '--disable-features=BlockInsecurePrivateNetworkRequests',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-web-security',
          '--disable-features=BlockInsecurePrivateNetworkRequests',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-web-security',
          '--disable-features=BlockInsecurePrivateNetworkRequests'
        ],
        ignoreHTTPSErrors: true,
        timeout: this.timeout,
        pipe: true
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.browserWSEndpoint = this.browser.wsEndpoint();

      this.browser.on('disconnected', async () => {
        console.log('Navegador desconectado, intentando reconectar...');
        this.browser = null;
        await this.reconnectBrowser();
      });

      process.on('unhandledRejection', async (reason, promise) => {
        console.error('Error no manejado:', reason);
        if (this.browser) {
          await this.cleanup();
        }
      });

      return this.browser;
    } catch (error) {
      console.error('Error al inicializar el navegador:', error);
      this.browser = null;
      throw error;
    }
  }

  // Reconectar al navegador usando el endpoint guardado
  async reconnectBrowser() {
    if (this.browserWSEndpoint) {
      try {
        this.browser = await puppeteer.connect({
          browserWSEndpoint: this.browserWSEndpoint,
          defaultViewport: null
        });
        console.log('Reconexión exitosa al navegador');
        return this.browser;
      } catch (error) {
        console.error('Error al reconectar:', error);
        this.browserWSEndpoint = null;
        return this.initBrowser();
      }
    }
    return this.initBrowser();
  }

  // Función de espera con timeout
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Extraer imágenes usando Puppeteer con reintentos
  async extractWithPuppeteer(url) {
    let lastError;
    let browser;
    let page;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} de ${this.maxRetries} con Puppeteer...`);
        browser = await this.initBrowser();
        page = await browser.newPage();
        
        // Configurar la página
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setDefaultNavigationTimeout(this.timeout);
        
        // Configurar interceptores de red
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font') {
            request.continue();
          } else {
            request.continue();
          }
        });

        // Navegar a la página con manejo de errores mejorado
        console.log('Navegando a la página con Puppeteer...');
        await page.goto(url, { 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: this.timeout 
        });

        // Esperar a que las imágenes lazy load se carguen
        console.log('Esperando a que las imágenes se carguen...');
        await page.evaluate(() => {
          return new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        });

        // Esperar un poco más para asegurar que todo se cargue
        await this.wait(1000);

        // Extraer todas las imágenes
        console.log('Extrayendo imágenes...');
        const images = await page.evaluate(() => {
          const imgElements = document.querySelectorAll('img');
          const backgroundImages = Array.from(document.querySelectorAll('*')).map(el => {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            return bgImage !== 'none' ? bgImage.slice(4, -1).replace(/["']/g, '') : null;
          }).filter(Boolean);

          return {
            regular: Array.from(imgElements).map(img => ({
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height
            })),
            background: backgroundImages
          };
        });

        // Cerrar la página después de usarla
        await page.close().catch(console.error);
        
        return images;
      } catch (error) {
        console.error(`Error en intento ${attempt}:`, error);
        lastError = error;
        
        if (page) {
          await page.close().catch(console.error);
        }
        
        if (attempt < this.maxRetries) {
          console.log(`Esperando ${this.retryDelay}ms antes del siguiente intento...`);
          await this.wait(this.retryDelay);
        }
      }
    }
    
    throw lastError;
  }

  // Extraer imágenes de iframes usando Puppeteer
  async extractIframeImages(page) {
    const iframeImages = [];
    const iframes = await page.$$('iframe');
    
    for (const iframe of iframes) {
      try {
        const frame = await iframe.contentFrame();
        const images = await frame.$$eval('img', imgs => 
          imgs.map(img => ({
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height
          }))
        );
        iframeImages.push(...images);
      } catch (error) {
        console.error('Error procesando iframe:', error);
      }
    }
    
    return iframeImages;
  }

  // Método principal de Thanos con caché y manejo de errores mejorado
  async snap(targetUrl) {
    console.log(`Thanos está intentando extraer imágenes de: ${targetUrl}`);
    const startTime = Date.now();

    // Verificar caché
    const cachedResult = this.cache.get(targetUrl);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < this.cacheTimeout) {
      console.log('Usando resultado en caché...');
      return cachedResult.data;
    }

    let images = [];
    let stats = {
      method: '',
      timeElapsed: 0,
      totalImages: 0,
      uniqueImages: 0,
      validImages: 0,
      errors: []
    };

    // Intentar primero con axios + cheerio (más rápido y confiable)
    console.log('Intentando con axios-cheerio...');
    try {
      const response = await axios.get(targetUrl, {
        headers: this.getPremiumHeaders(targetUrl),
        timeout: this.timeout
      });
      const $ = cheerio.load(response.data);
      
      // Extraer imágenes regulares
      $('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src) images.push({ src });
      });

      // Extraer imágenes de background
      $('*').each((_, el) => {
        const style = $(el).attr('style');
        if (style) {
          const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/g);
          if (matches) {
            matches.forEach(match => {
              const url = match.match(/url\(['"]?([^'"()]+)['"]?\)/)[1];
              images.push({ src: url });
            });
          }
        }
      });

      stats.method = 'axios-cheerio';
    } catch (error) {
      console.error('Error con axios-cheerio:', error);
      stats.errors.push(`Error con axios-cheerio: ${error.message}`);

      // Si falla axios-cheerio, intentar con Puppeteer
      console.log('Intentando con Puppeteer...');
      try {
        const puppeteerImages = await this.extractWithPuppeteer(targetUrl);
        images = [
          ...puppeteerImages.regular,
          ...puppeteerImages.background.map(src => ({ src }))
        ];
        stats.method = 'puppeteer';
      } catch (error) {
        console.error('Error con Puppeteer:', error);
        stats.errors.push(`Error con Puppeteer: ${error.message}`);
        throw new Error('Todos los métodos de extracción fallaron');
      }
    }

    // Normalizar URLs y eliminar duplicados
    const normalizedImages = images
      .map(img => ({
        ...img,
        src: normalizeImageUrl(img.src, targetUrl)
      }))
      .filter(img => img.src && !img.src.startsWith('data:'));

    const uniqueImages = [...new Map(normalizedImages.map(img => [img.src, img])).values()];

    // Filtrar imágenes muy pequeñas
    const validImages = uniqueImages.filter(img => 
      (img.width >= 100 && img.height >= 100) || 
      (!img.width && !img.height)
    );

    stats.timeElapsed = Date.now() - startTime;
    stats.totalImages = images.length;
    stats.uniqueImages = uniqueImages.length;
    stats.validImages = validImages.length;

    const result = {
      success: true,
      images: validImages,
      stats
    };

    // Guardar en caché
    this.cache.set(targetUrl, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  // Cerrar el navegador cuando se detenga el servicio
  async cleanup() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error al cerrar el navegador:', error);
      }
      this.browser = null;
      this.browserWSEndpoint = null;
    }
  }
}

module.exports = new ThanosService(); 