# Backend Image Detector

API REST para escanear y procesar imágenes de sitios web.

## Características

- Escaneo de imágenes desde URLs
- Descarga individual y múltiple de imágenes
- Proxy de imágenes para evitar problemas CORS
- Previsualización de imágenes optimizadas
- Sistema de caché para mejorar el rendimiento
- Rate limiting para proteger la API
- Manejo de errores robusto

## Requisitos

- Node.js >= 14.x
- npm >= 6.x

## Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd backend-image-dector
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```
Editar el archivo `.env` con tus configuraciones.

## Configuración

Variables de entorno principales:
- `PORT`: Puerto del servidor (default: 3001)
- `FRONTEND_URL`: URL del frontend (default: http://localhost:5173)
- `RATE_LIMIT_WINDOW_MS`: Ventana de tiempo para rate limiting (default: 60000)
- `RATE_LIMIT_MAX`: Máximo de solicitudes por ventana (default: 30)
- `CACHE_DURATION_MS`: Duración del caché (default: 300000)

## Endpoints

### GET /api/health
Verifica el estado del servidor.
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente"
}
```

### POST /api/scan
Escanea imágenes de una URL.
```json
{
  "targetUrl": "https://ejemplo.com"
}
```

### GET /api/download
Descarga una imagen individual.
```
/api/download?url=https://ejemplo.com/imagen.jpg
```

### POST /api/download-multiple
Descarga múltiples imágenes como ZIP.
```json
{
  "urls": [
    "https://ejemplo.com/imagen1.jpg",
    "https://ejemplo.com/imagen2.jpg"
  ]
}
```

### GET /api/proxy-image
Proxy para imágenes (evita problemas CORS).
```
/api/proxy-image?url=https://ejemplo.com/imagen.jpg
```

### GET /api/preview-image
Obtiene una versión optimizada de la imagen.
```
/api/preview-image?url=https://ejemplo.com/imagen.jpg
```

## Seguridad

- Rate limiting para prevenir abusos
- Validación de URLs
- Headers de seguridad con Helmet
- CORS configurado para el frontend
- Manejo seguro de errores

## Desarrollo

Iniciar servidor en modo desarrollo:
```bash
npm start
```

## Producción

Para producción, asegúrate de:
1. Configurar `NODE_ENV=production`
2. Ajustar los límites de rate limiting
3. Configurar el caché según necesidades
4. Usar un proxy inverso (nginx, etc.)

## Licencia

MIT
