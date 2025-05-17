require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const mcache = require('memory-cache');
const axios = require('axios');
const cheerio = require('cheerio');
const sizeOf = require('image-size');
const path = require('path');
const ocrRoutes = require('./src/routes/ocr.routes');
const thanosService = require('./src/services/thanos.service');

// Configuración
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 30;
const CACHE_DURATION_MS = parseInt(process.env.CACHE_DURATION_MS) || 300000;

// Middleware de seguridad
app.use(helmet());

// Configuración CORS
app.use(cors({
  origin: '*' ,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsear JSON
app.use(express.json({ limit: '1mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes, por favor intenta más tarde.'
  }
});
app.use('/api/', limiter);

// Middleware de caché
const cache = (duration) => {
  return (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = mcache.get(key);
    
    if (cachedBody) {
      res.send(JSON.parse(cachedBody));
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        mcache.put(key, body, duration);
        res.sendResponse(body);
      };
      next();
    }
  };
};

// Validación de URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Función para obtener dimensiones de imagen
const getImageDimensions = async (imageUrl) => {
  try {
    // Usar axios en lugar de fetch
    const response = await axios.head(imageUrl);
    
    // Si la respuesta no es exitosa, usar dimensiones por defecto
    if (response.status !== 200) {
      return { width: 200, height: 150 };
    }
    
    const contentType = response.headers['content-type'];
    
    // Verificar si es una imagen
    if (!contentType || !contentType.startsWith('image/')) {
      return { width: 200, height: 150 };
    }
    
    // Para imágenes pequeñas, intentamos obtener dimensiones reales
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imageResponse.data);
    
    try {
      const dimensions = sizeOf(buffer);
      return {
        width: dimensions.width || 200,
        height: dimensions.height || 150
      };
    } catch (error) {
      return { width: 200, height: 150 };
    }
  } catch (error) {
    console.error('Error al obtener dimensiones de imagen:', error);
    return { width: 200, height: 150 };
  }
};

// Función mejorada para normalizar URLs
const normalizeImageUrl = (src, baseUrl, targetUrl) => {
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
    } else if (src.startsWith('../') || src.startsWith('./')) {
      // URLs relativas con ../ o ./
      return new URL(src, targetUrl).href;
    } else {
      // Otras URLs relativas
      return new URL(src, targetUrl).href;
    }
  } catch (error) {
    console.error(`Error normalizando URL: ${src}`, error);
    return null;
  }
};

// Headers mejorados para evitar bloqueos
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Connection': 'keep-alive',
  'DNT': '1'
};

// Función para rotar User-Agents
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const getRandomUserAgent = () => {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Función para añadir delay aleatorio
const randomDelay = (min = 1000, max = 3000) => {
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
};

console.log('Montando rutas OCR en /api');
app.use('/api', (req, res, next) => {
  console.log('Petición recibida en /api:', req.method, req.originalUrl);
  next();
});
app.use('/api', ocrRoutes);

// Endpoint para verificar estado del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// Función para extraer imágenes de iframes
const extractImagesFromIframes = async ($, baseUrl) => {
  const iframeImages = [];
  const iframes = $('iframe');
  
  for (const iframe of iframes) {
    try {
      const iframeSrc = $(iframe).attr('src');
      if (iframeSrc) {
        const iframeUrl = new URL(iframeSrc, baseUrl).href;
        const iframeResponse = await axios.get(iframeUrl, { 
          headers: commonHeaders,
          timeout: 10000
        });
        const iframe$ = cheerio.load(iframeResponse.data);
        const images = iframe$('img').map((_, img) => {
          const src = iframe$(img).attr('src');
          return normalizeImageUrl(src, baseUrl, iframeUrl);
        }).get();
        iframeImages.push(...images);
      }
    } catch (error) {
      console.error('Error procesando iframe:', error);
    }
  }
  return iframeImages;
};

// Función para extraer imágenes con lazy loading
const extractLazyLoadedImages = ($) => {
  const lazyImages = [];
  
  // Buscar atributos comunes de lazy loading
  const lazySelectors = [
    'img[data-src]',
    'img[data-lazy-src]',
    'img[data-original]',
    'img[data-url]',
    'img[data-srcset]',
    'img[loading="lazy"]',
    'img.lazy',
    'img.lazyload',
    'img[data-lazy]',
    'img[data-delayed-url]'
  ];
  
  lazySelectors.forEach(selector => {
    $(selector).each((_, img) => {
      const src = $(img).attr('data-src') || 
                 $(img).attr('data-lazy-src') || 
                 $(img).attr('data-original') || 
                 $(img).attr('data-url') ||
                 $(img).attr('data-lazy') ||
                 $(img).attr('data-delayed-url');
      if (src) lazyImages.push(src);
    });
  });
  
  return lazyImages;
};

// Función para extraer imágenes de background en CSS
const extractBackgroundImages = ($) => {
  const bgImages = [];
  
  $('*').each((_, element) => {
    const style = $(element).attr('style');
    if (style) {
      const matches = style.match(/url\(['"]?([^'"()]+)['"]?\)/g);
      if (matches) {
        matches.forEach(match => {
          const url = match.match(/url\(['"]?([^'"()]+)['"]?\)/)[1];
          bgImages.push(url);
        });
      }
    }
  });
  
  return bgImages;
};

// Función para manejar sitios que bloquean scraping
const getEnhancedHeaders = (targetUrl) => {
  const origin = new URL(targetUrl).origin;
  const host = new URL(targetUrl).host;
  
  // Headers específicos para sitios que bloquean scraping
  const enhancedHeaders = {
    ...commonHeaders,
    'User-Agent': getRandomUserAgent(),
    'Referer': 'https://www.google.com/',
    'Origin': origin,
    'Host': host,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
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
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"'
  };

  // Headers específicos para Pexels
  if (host.includes('pexels.com')) {
    return {
      ...enhancedHeaders,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/search?q=pexels+photos',
      'Cookie': 'pexels_session=1; _pexels_session=1'
    };
  }

  return enhancedHeaders;
};

// Ruta mejorada para escanear imágenes
app.post('/api/scan', [
  body('targetUrl').isURL().withMessage('URL inválida')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), message: 'URL inválida' });
  }

  const { targetUrl } = req.body;
  console.log(`Solicitud de escaneo para URL: ${targetUrl}`);

  try {
    // Obtener el contenido HTML con retry y timeout
    const maxRetries = 3;
    let response;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Añadir delay aleatorio entre intentos
        if (retryCount > 0) {
          await randomDelay(2000, 5000);
        }

        const headers = getEnhancedHeaders(targetUrl);
        console.log('Usando headers:', headers);

        response = await axios({
          method: 'GET',
          url: targetUrl,
          timeout: 20000,
          headers: headers,
          maxRedirects: 5,
          validateStatus: status => status < 400,
          decompress: true,
          proxy: false,
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false,
            keepAlive: true
          })
        });
        break;
      } catch (error) {
        retryCount++;
        console.error(`Intento ${retryCount} fallido:`, error.message);
        if (retryCount === maxRetries) {
          throw new Error(`Error después de ${maxRetries} intentos: ${error.message}`);
        }
        await randomDelay(3000, 7000);
      }
    }

    const $ = cheerio.load(response.data);
    
    // Extraer imágenes de diferentes fuentes
    const regularImages = $('img').map((_, img) => $(img).attr('src')).get();
    const iframeImages = await extractImagesFromIframes($, targetUrl);
    const lazyImages = extractLazyLoadedImages($);
    const bgImages = extractBackgroundImages($);
    
    // Combinar y normalizar todas las URLs
    const allImages = [...regularImages, ...iframeImages, ...lazyImages, ...bgImages]
      .map(src => normalizeImageUrl(src, targetUrl))
      .filter(Boolean);
    
    // Eliminar duplicados
    const uniqueImages = [...new Set(allImages)];
    
    // Obtener dimensiones y filtrar imágenes muy pequeñas
    const processedImages = await Promise.all(
      uniqueImages.map(async (src) => {
        try {
          const dimensions = await getImageDimensions(src);
          return {
            src,
            ...dimensions,
            id: Math.random().toString(36).substr(2, 9)
          };
        } catch (error) {
          console.error(`Error procesando imagen ${src}:`, error);
          return null;
        }
      })
    );
    
    // Filtrar imágenes inválidas y muy pequeñas
    const validImages = processedImages
      .filter(Boolean)
      .filter(img => img.width >= 100 && img.height >= 100);
    
    res.json({ 
      images: validImages,
      stats: {
        totalFound: allImages.length,
        uniqueFound: uniqueImages.length,
        validImages: validImages.length
      }
    });
  } catch (error) {
    console.error('Error en el escaneo:', error);
    res.status(500).json({
      error: 'Error al procesar la página',
      message: error.message
    });
  }
});

// Endpoint mejorado para proxy de imágenes
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL de imagen no proporcionada' });
    }
    
    console.log(`Proxy de imagen para: ${imageUrl}`);
    
    // Corregir URLs con doble dominio
    let correctedUrl = imageUrl;
    const urlObj = new URL(imageUrl);
    const domain = urlObj.hostname;
    
    if (imageUrl.includes('//' + domain)) {
      correctedUrl = imageUrl.replace('//' + domain, '');
      console.log(`URL corregida: ${correctedUrl}`);
    }
    
    // Añadir encabezados específicos para sitios como Shopify
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Referer': new URL(correctedUrl).origin,
      'sec-fetch-dest': 'image',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'cross-site'
    };
    
    // Obtener la imagen desde la URL externa con timeout y retry
    let attempts = 0;
    const maxAttempts = 3;
    let response;
    
    while (attempts < maxAttempts) {
      try {
        response = await axios({
          method: 'GET',
          url: correctedUrl,
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: headers,
          maxRedirects: 5
        });
        break; // Si la solicitud es exitosa, salir del bucle
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de reintentar
      }
    }
    
    // Configurar los encabezados para la imagen
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cachear por 24 horas
    
    // Enviar la imagen como respuesta
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error al proxy de imagen:', error.message);
    
    // Enviar una imagen de error genérica
    res.status(404).sendFile(path.join(__dirname, 'assets', 'error-image.png'));
  }
});

// Ruta para descargar múltiples imágenes como ZIP
app.post('/api/download-multiple', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron URLs de imágenes válidas' });
    }
    
    console.log(`Descargando ${urls.length} imágenes como ZIP`);
    
    // Crear un archivo ZIP en memoria
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 5 } // Nivel de compresión
    });
    
    // Manejar errores del archivador
    archive.on('error', (err) => {
      console.error('Error en el archivador:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al crear el archivo ZIP', details: err.message });
      }
    });
    
    // Configurar los encabezados para la descarga
    res.setHeader('Content-Disposition', `attachment; filename="imagenes-${Date.now()}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    
    // Pipe el archivo ZIP a la respuesta
    archive.pipe(res);
    
    // Descargar cada imagen y añadirla al ZIP
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        console.log(`Descargando imagen ${i + 1}/${urls.length}: ${url}`);
        
        // Obtener la imagen
        const response = await axios({
          method: 'GET',
          url,
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // Extraer el nombre del archivo de la URL
        let fileName = path.basename(url);
        if (!fileName || fileName.length < 3) {
          fileName = `imagen-${i + 1}.jpg`;
        }
        
        // Añadir la imagen al ZIP
        archive.append(Buffer.from(response.data), { name: fileName });
        
        console.log(`Imagen ${i + 1}/${urls.length} añadida al ZIP: ${fileName}`);
      } catch (imgError) {
        console.error(`Error al descargar la imagen ${i + 1}:`, imgError.message);
        // Continuar con la siguiente imagen en caso de error
      }
    }
    
    // Finalizar el archivo ZIP
    console.log('Finalizando archivo ZIP...');
    await archive.finalize();
    console.log('Archivo ZIP enviado correctamente');
    
  } catch (error) {
    console.error('Error al crear el archivo ZIP:', error.message);
    // Si aún no se ha enviado una respuesta, enviar un error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error al crear el archivo ZIP', 
        details: error.message 
      });
    }
  }
});

// Endpoint para obtener una versión optimizada de una imagen para previsualización
app.get('/api/preview-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL de imagen no proporcionada' });
    }
    
    console.log(`Generando previsualización para: ${imageUrl}`);
    
    // Obtener la imagen desde la URL externa
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 10000, // Reducir el timeout para responder más rápido
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Configurar los encabezados para la imagen
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cachear por 24 horas
    
    // Enviar la imagen como respuesta
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error al generar previsualización:', error.message);
    
    // Enviar una imagen de error genérica
    res.status(500).sendFile(path.join(__dirname, 'assets', 'error-image.png'));
  }
});

// Endpoint para descargar una imagen individual
app.get('/api/download', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Se requiere una URL de imagen' });
  }

  try {
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Obtener el nombre del archivo de la URL
    const urlObj = new URL(imageUrl);
    const filename = path.basename(urlObj.pathname).split('?')[0] || 'imagen.jpg';

    // Configurar headers para la descarga
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', response.headers['content-type']);
    
    // Transmitir la imagen al cliente
    response.data.pipe(res);
  } catch (error) {
    console.error('Error al descargar la imagen:', error);
    res.status(500).json({ error: 'Error al descargar la imagen' });
  }
});

// Endpoint premium para extracción de imágenes (Thanos)
app.post('/api/thanos', [
  body('targetUrl').isURL().withMessage('URL inválida')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), message: 'URL inválida' });
  }

  const { targetUrl } = req.body;
  console.log(`Solicitud premium (Thanos) para URL: ${targetUrl}`);

  try {
    const result = await thanosService.snap(targetUrl);
    res.json(result);
  } catch (error) {
    console.error('Error en Thanos:', error);
    res.status(500).json({
      error: 'Error al procesar la página',
      message: error.message,
      stats: {
        method: 'failed',
        timeElapsed: 0,
        totalImages: 0,
        uniqueImages: 0,
        validImages: 0,
        errors: [error.message]
      }
    });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Aceptando solicitudes de: ${FRONTEND_URL}`);
});

// Manejo de señales para cierre limpio
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido. Cerrando servidor...');
  process.exit(0);
}); 