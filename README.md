# Web Image Scanner Backend

Backend para escanear y analizar imágenes de sitios web con sistema de cola y caché.

## Características Implementadas

### 1. Sistema Base
- ✅ Escaneo de sitios web
- ✅ Extracción de imágenes
- ✅ Almacenamiento temporal
- ✅ API RESTful
- ✅ Manejo de errores
- ✅ Logging

### 2. Análisis de Imágenes
- ✅ Detección de calidad de imagen
- ✅ Extracción de metadatos EXIF
- ✅ Análisis de paleta de colores dominantes
- ⏳ Detección de duplicados (en desarrollo)
- ⏳ Clasificación automática de imágenes (pendiente)
- ⏳ Detección de marca de agua (pendiente)

### 3. Optimización y Rendimiento
- ✅ Sistema de cola con Bull/Redis
- ✅ Caché inteligente con TTL
- ✅ Límites configurables de profundidad
- ✅ Control de concurrencia
- ⏳ Crawling recursivo (en desarrollo)

## Requisitos

- Node.js >= 16.0.0
- Redis Server
- NPM o Yarn

## Instalación

1. Clonar el repositorio:
2. Instalar dependencias:
npm install
3. Configurar variables de entorno:
cp .env.example .env
