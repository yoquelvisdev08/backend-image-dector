const express = require('express');
const router = express.Router();
const scanRoutes = require('./scan.routes');
const imageRoutes = require('./image.routes');
const healthController = require('../controllers/health.controller');
const rateLimiter = require('../middleware/rate-limiter');

// Ruta de health check (sin limitador de tasa)
router.get('/health', healthController.checkHealth.bind(healthController));

// Aplicar limitador de tasa a las rutas principales
router.use('/scan', rateLimiter);
router.use('/images', rateLimiter);

// Rutas de escaneo
router.use('/scan', scanRoutes);

// Rutas de imágenes
router.use('/images', imageRoutes);

// Ruta de información de la API
router.get('/', (req, res) => {
  res.json({
    name: 'Image Scanner API',
    version: '1.0.0',
    endpoints: [
      {
        path: '/scan',
        method: 'POST',
        description: 'Escanea un sitio web y extrae imágenes'
      },
      {
        path: '/images/:scanId/:fileName',
        method: 'GET',
        description: 'Obtiene una imagen almacenada'
      },
      {
        path: '/health',
        method: 'GET',
        description: 'Verifica el estado del servidor'
      }
    ]
  });
});

module.exports = router; 