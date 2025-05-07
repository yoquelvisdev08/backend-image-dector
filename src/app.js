require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const apiRoutes = require('./routes/api.routes');
const errorHandler = require('./middleware/error-handler');
const logger = require('./utils/logger');
const cleanupService = require('./services/cleanup.service');
const config = require('./config/app.config');
const securityMiddleware = require('./middleware/security');
const cleanTemp = require('./scripts/clean-temp');

// Crear directorio de logs si no existe
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Inicializar la aplicación Express
const app = express();
const PORT = config.PORT || 3001;

// Configuración de middleware
app.use(helmet()); // Seguridad
app.use(compression()); // Compresión de respuestas

// Configuración de CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173'];

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configuración de logging
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, '../logs/access.log'), 
  { flags: 'a' }
);

app.use(morgan('combined', { stream: accessLogStream }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Parseo de JSON y formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas estáticas para archivos temporales (solo para desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use('/temp', express.static(path.join(__dirname, '../temp')));
}

// Rutas de la API
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(apiPrefix, apiRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejo de errores
app.use(errorHandler);

// Iniciar el servidor
const server = app.listen(PORT, () => {
  logger.info(`Servidor iniciado en el puerto ${PORT} en modo ${config.NODE_ENV}`);
  
  // Iniciar servicio de limpieza
  cleanupService.startCleanupScheduler();
});

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
  logger.info('Recibida señal SIGTERM. Iniciando apagado graceful...');
  
  try {
    // Limpiar archivos temporales
    await cleanTemp();
    
    // Cerrar servidor
    server.close(() => {
      logger.info('Servidor HTTP cerrado.');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error durante el apagado:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('Recibida señal SIGINT. Iniciando apagado graceful...');
  
  try {
    // Limpiar archivos temporales
    await cleanTemp();
    
    // Cerrar servidor
    server.close(() => {
      logger.info('Servidor HTTP cerrado.');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error durante el apagado:', error);
    process.exit(1);
  }
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
});

module.exports = app; // Para pruebas 