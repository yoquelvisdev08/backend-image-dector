/**
 * Clases de error personalizadas para la aplicación
 */

/**
 * Error base para la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error de validación
 */
class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

/**
 * Error de recurso no encontrado
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Error de tiempo de espera
 */
class TimeoutError extends AppError {
  constructor(message = 'La operación ha excedido el tiempo de espera') {
    super(message, 408, 'TIMEOUT');
  }
}

/**
 * Error de acceso denegado
 */
class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error de servicio externo
 */
class ExternalServiceError extends AppError {
  constructor(message, service = 'external') {
    super(`Error en servicio externo (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  ForbiddenError,
  ExternalServiceError
}; 