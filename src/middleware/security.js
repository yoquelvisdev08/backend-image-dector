const helmet = require('helmet');

/**
 * Configuración de seguridad para la aplicación
 */
const securityMiddleware = [
  // Configuración básica de Helmet
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
      }
    }
  }),
  
  // Middleware personalizado para encabezados adicionales
  (req, res, next) => {
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevenir MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Política de referencia
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Política de características
    res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'; geolocation 'none'");
    
    next();
  }
];

module.exports = securityMiddleware; 