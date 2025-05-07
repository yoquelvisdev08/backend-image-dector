const winston = require('winston');
const path = require('path');

// Configuración de niveles de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Configuración de colores para la consola
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Añadir colores a winston
winston.addColors(colors);

// Determinar nivel de log basado en el entorno
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : process.env.LOG_LEVEL || 'info';
};

// Formato personalizado para los logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Formato para la consola con colores
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Transportes para los logs
const transports = [
  // Consola
  new winston.transports.Console({
    format: consoleFormat
  }),
  // Archivo de logs
  new winston.transports.File({
    filename: process.env.LOG_FILE || path.join(__dirname, '../../logs/app.log'),
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  // Archivo de logs de errores
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Crear el logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports
});

module.exports = logger; 