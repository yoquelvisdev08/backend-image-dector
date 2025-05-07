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

// Configuración
const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 30;
const CACHE_DURATION_MS = parseInt(process.env.CACHE_DURATION_MS) || 300000;

// Middleware de seguridad
app.use(helmet());

// Configuración CORS
app.use(cors({
  origin: FRONTEND_URL,
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

// Endpoint para verificar estado del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

// Ruta para escanear imágenes de una URL
app.post('/api/scan', [
  body('targetUrl').isURL().withMessage('URL inválida')
], async (req, res) => {
  // Validar entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), message: 'URL inválida' });
  }

  const { targetUrl } = req.body;
  console.log(`Solicitud de escaneo para URL: ${targetUrl}`);

  try {
    // Obtener el contenido HTML de la URL
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // Asegurarse de que no se use caché
      cache: false
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const baseUrl = new URL(targetUrl).origin;
    
    // Extraer todas las imágenes
    const images = [];
    let imageIndex = 0;

    $('img').each((i, element) => {
      let src = $(element).attr('src');
      if (!src) return;

      // Convertir URLs relativas a absolutas
      if (src.startsWith('/')) {
        src = baseUrl + src;
      } else if (!src.startsWith('http')) {
        try {
          src = new URL(src, targetUrl).href;
        } catch (e) {
          console.error(`Error al procesar URL de imagen: ${src}`, e);
          return;
        }
      }

      // Ignorar imágenes data:image
      if (src.startsWith('data:')) return;

      // Obtener atributos
      const alt = $(element).attr('alt') || 'Imagen sin descripción';
      const width = parseInt($(element).attr('width') || '0', 10) || 0;
      const height = parseInt($(element).attr('height') || '0', 10) || 0;

      // Añadir la imagen a la lista
      images.push({
        id: `img-${imageIndex++}`,
        src,
        alt,
        width: width || 200, // Valor por defecto si no se puede determinar
        height: height || 150, // Valor por defecto si no se puede determinar
        top: i * 10, // Posición aproximada
        selected: false
      });
    });

    console.log(`Imágenes encontradas en ${targetUrl}: ${images.length}`);

    // Corregir las URLs de las imágenes antes de devolverlas
    const correctedImages = images.map(img => {
      // Corregir URLs con doble dominio
      if (img.src.includes('//' + targetUrl.host)) {
        img.src = img.src.replace('//' + targetUrl.host, '');
      }
      
      // Asegurarse de que las URLs relativas sean absolutas
      if (img.src.startsWith('/')) {
        img.src = targetUrl.origin + img.src;
      }
      
      return img;
    });
    
    // Devolver las imágenes corregidas
    return res.json({ 
      images: correctedImages,
      url: targetUrl.toString() 
    });
  } catch (error) {
    console.error(`Error al escanear ${targetUrl}:`, error.message);
    res.status(500).json({ 
      message: `Error al escanear la URL: ${error.message}`,
      error: error.message
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