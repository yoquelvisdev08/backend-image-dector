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
- **OCR avanzado usando ocr.space con compresión automática de imágenes**

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

**Request:**
```json
{
  "targetUrl": "https://ejemplo.com"
}
```

**Response exitosa:**
```json
{
  "images": [
    {
      "id": "img-0",
      "src": "https://ejemplo.com/imagen1.jpg",
      "alt": "Descripción de la imagen",
      "width": 800,
      "height": 600,
      "top": 0,
      "selected": false
    },
    // ... más imágenes
  ],
  "url": "https://ejemplo.com"
}
```

**Campos de la respuesta:**
- `images`: Array de imágenes encontradas
  - `id`: Identificador único de la imagen
  - `src`: URL de la imagen
  - `alt`: Texto alternativo de la imagen
  - `width`: Ancho de la imagen (en píxeles)
  - `height`: Alto de la imagen (en píxeles)
  - `top`: Posición vertical aproximada en la página
  - `selected`: Estado de selección (para UI)
- `url`: URL escaneada

**Errores posibles:**
```json
{
  "errors": [
    {
      "msg": "URL inválida"
    }
  ],
  "message": "URL inválida"
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

### POST /api/ocr
Extrae texto de una imagen usando OCR (Reconocimiento Óptico de Caracteres).

**Ahora utiliza la API de [ocr.space](https://ocr.space/OCRAPI) y comprime automáticamente las imágenes a menos de 1MB en memoria antes de enviarlas. No se almacenan archivos temporales en el backend.**

**Request:**
```json
{
  "imageUrl": "https://ejemplo.com/imagen-con-texto.jpg",
  "language": "spa" // Opcional, por defecto 'spa' (español)
}
```

**Response exitosa:**
```json
{
  "success": true,
  "text": "Texto limpio y formateado",
  "lines": [
    "Primera línea",
    "Segunda línea",
    "..."
  ],
  "rawText": "Texto original sin procesar",
  "language": "spa",
  "confidence": 100,
  "stats": {
    "lineCount": 3,
    "characterCount": 40,
    "wordCount": 5
  }
}
```

**Notas importantes:**
- Si la imagen es mayor a 1MB, el backend la redimensiona y comprime automáticamente antes de enviarla a ocr.space.
- Todo el procesamiento se realiza en memoria, sin archivos temporales.
- El OCR soporta múltiples idiomas (ver documentación de ocr.space para más opciones).

**Errores posibles:**
```json
{
  "success": false,
  "error": "Error al procesar la imagen",
  "details": "Mensaje de error específico"
}
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
