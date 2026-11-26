# ⚡ MediaScraper Pro 2.0 — Plataforma de Extracción, Inspección con IA y Curaduría Multimedia

<p align="center">
  <img src="public/assets/logo.svg" alt="MediaScraper Logo" width="120" />
</p>

<p align="center">
  <strong>Plataforma Multiplataforma de Web Scraping, Inspección Visual con Inteligencia Artificial, Edición de Imágenes, Reproductor de Video HD y Exportación de Paquetes en ZIP / PDF.</strong>
</p>

<p align="center">
  <!-- Language & Technology Badges in Image Format -->
  <img src="https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js Version" />
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-Vanilla_CSS_3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/Express.js-v4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/TensorFlow.js-AI_Vision-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="TensorFlow.js" />
  <img src="https://img.shields.io/badge/Tesseract.js-Google_Lens_OCR-412991?style=for-the-badge&logo=google&logoColor=white" alt="Google Lens OCR" />
  <img src="https://img.shields.io/badge/PWA-Progressive_Web_App-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/Version-2.0.0_Impeccable-blueviolet?style=for-the-badge" alt="Version 2.0" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT" />
</p>

---

## 📖 Tabla de Contenidos

1. [Descripción General](#-descripción-general)
2. [Características Principales](#-características-principales)
3. [Lenguajes y Tecnologías (Badges)](#-lenguajes-y-tecnologías)
4. [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
5. [Instalación y Configuración](#-instalación-y-configuración)
6. [Referencia de API Backend](#-referencia-de-api-backend)
7. [Guía de Componentes Frontend](#-guía-de-componentes-frontend)
8. [Licencia](#-licencia)

---

## 🌟 Descripción General

**MediaScraper Pro 2.0** es una suite multiplataforma de grado profesional diseñada para extraer, procesar, analizar, editar y exportar contenido audiovisual (imágenes y videos) desde cualquier sitio web o red social de manera 100% privada, local y escalable.

Desarrollado bajo el paradigma de **Diseño Impeccable 2.0**, combina un motor de scraping backend escalable en Node.js/Express con una interfaz web ultralujosa en **Obsidian Glassmorphic UI**, potentes motores de visión por computadora (**TensorFlow.js** y **Tesseract.js OCR**) y un reproductor de video HTML5 de alto rendimiento estilo YouTube.

---

## 🔥 Características Principales

### 🌐 1. Motor de Scraping Multiplataforma Escalable
- **Compatibilidad Extensa**: Soporta extracción directa en redes sociales y plataformas web (**TikTok, Instagram, YouTube, Pinterest, Twitter/X, Facebook y sitios HTML5 genéricos**).
- **Procesamiento de Fuentes**: Extrae enlaces desde etiquetas `<img>`, `srcset`, `<picture>`, meta tags (`og:image`, `twitter:image`), CSS background-images, etiquetas `<video>`, `<source>`, `.mp4`, `.webm`, `.m3u8` y `.gif`.
- **Filtro Anti-Rastreadores**: Normalización automática de URLs relativas a absolutas y depuración inteligente de píxeles transparentes o rastreadores diminutos (`< 16x16px`).

### 🎨 2. Editor de Imágenes Canvas y Extractor de Paleta HEX
- **Filtros en Tiempo Real**: Escala de grises, Sepia, Alto Contraste, Cyberpunk Neón, Vintage e Inversión.
- **Transformación de Formatos**: Conversión y descarga instantánea a formato **PNG HD** o **JPG comprimido (0.92 quality)**.
- **Extractor de Paleta `#HEX`**: Análisis de densidad de color en tiempo real para generar hasta 5 tonos dominantes formato `#1F2125` con copiado al portapapeles en 1 solo clic (`¡Copiado!`).

### 🔍 3. Panel Lateral de Inspección con IA & Google Lens OCR
- **Clasificación por IA Visual**: Clasificación automática de objetos y etiquetas visuales mediante **TensorFlow.js MobileNet** local.
- **Google Lens OCR**: Reconocimiento óptico de caracteres en imágenes con **Tesseract.js** (soporte multilingüe Español/Inglés).
- **Inspección de Metadatos**: Nombre de archivo, dimensiones en píxeles (`WIDTH x HEIGHT`), formato/extensión y texto alt.

### 🎬 4. Reproductor de Video Personalizado de Ultra-Lujo (Estilo YouTube)
- **Cápsula Flotante Responsiva**: Módulo de controles en 1 sola fila (*Single-Row Dock*) adaptado a cualquier dispositivo o panel lateral.
- **Motor de Calidad Adaptativa Estilo YouTube**:
  - Micro-pausa de amortiguación de 450 ms (`Optimizando flujo a 1080p HD...`).
  - Renderizado dinámico de fidelidad óptica (`1080p HD`, `720p HD`, `480p SD`, `360p SD`).
  - Menú con marcas de verificación activas (`1080p HD ✓`).
- **Controles Avanzados**:
  - ⏯️ Play / Pausa / Replay automático.
  - 🎚️ Barra de tiempo neón con previsualización de fotograma en hover.
  - 🔊 Slider de volumen expandible en hover.
  - 🎵 **Extractor de Audio a MP3** dedicado.
  - 🖼️ Modo Ventana Flotante (Picture-in-Picture).
  - ⛶ Pantalla Completa Nativa Multiplataforma.
- **Auto-Ocultado Inteligente**: Temporizador de inactividad de **6 segundos exactos** (`6000ms`) con suave animación de deslizamiento `cubic-bezier`.

### 📦 5. Exportación Compresiva ZIP y Catálogo Ejecutivo PDF
- **Compresión ZIP en Vivo**: Flujo de transmisión en tiempo real (*Streaming ZIP*) con barra de progreso dinamizada (`0.0 MB/s` a `100%`) y detección automática de descarga completada o cancelada.
- **Catálogo PDF de 4 Elementos por Hoja**: Generación de catálogo corporativo HD ordenado en **grilla 2x2 sin cortes a mitad de página**, conservando el tema oscuro, logos y metadata (`MediaScraper_Catalogo_XXXXXXXX.pdf`).

---

## 🛠️ Lenguajes y Tecnologías

### Lenguajes y Runtimes
| Tecnología | Insignia | Descripción |
| :--- | :---: | :--- |
| **Node.js** | <img src="https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" /> | Runtime de ejecución backend escalable. |
| **JavaScript** | <img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" /> | Lenguaje principal (Lógica Vanilla ES6+ sin bundlers). |
| **HTML5** | <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" /> | Estructura semántica, modales y etiquetas multimedia. |
| **CSS3** | <img src="https://img.shields.io/badge/CSS3-Vanilla_CSS_3-1572B6?style=for-the-badge&logo=css3&logoColor=white" /> | Sistema de diseño Impeccable Obsidian Glass. |

### Dependencias y Motores Backend / Frontend
| Librería / Motor | Insignia | Uso Principal |
| :--- | :---: | :--- |
| **Express.js** | <img src="https://img.shields.io/badge/Express.js-v4.19-000000?style=for-the-badge&logo=express&logoColor=white" /> | Framework de rutas API HTTP y Proxy de medios. |
| **TensorFlow.js** | <img src="https://img.shields.io/badge/TensorFlow.js-MobileNet-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" /> | Modelo de Inteligencia Artificial para visión por computadora. |
| **Tesseract.js** | <img src="https://img.shields.io/badge/Tesseract.js-Google_Lens_OCR-412991?style=for-the-badge&logo=google&logoColor=white" /> | Motor OCR para extracción de texto en imágenes. |
| **Archiver** | <img src="https://img.shields.io/badge/Archiver-Streaming_ZIP-00599C?style=for-the-badge" /> | Compresión streaming de paquetes de archivos. |
| **html2pdf.js** | <img src="https://img.shields.io/badge/html2pdf.js-v0.10.1-red?style=for-the-badge" /> | Generación de catálogo de reportes PDF en grilla 2x2. |
| **PWA Engine** | <img src="https://img.shields.io/badge/PWA-Service_Workers-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" /> | Instalabilidad nativa en SO y caché offline. |

---

## 📁 Arquitectura del Proyecto

```
MediaScraper/
├── api/
│   └── index.js                   # Entrypoint Serverless para Vercel (@vercel/node)
├── config/
│   ├── index.js                   # Configuración tipada de entorno, límites, CORS y /tmp
│   └── constants.js               # Constantes de validación, protocolos y dominios
├── src/
│   ├── controllers/               # Controladores HTTP (scrape, proxy, download, export)
│   ├── middlewares/               # Error handler centralizado y rate-limiter en memoria
│   ├── routes/                    # Definición modular de endpoints /api/* y /api/health
│   └── services/                  # Lógica de negocio, anti-SSRF, scraping, ZIP stream e IA
├── public/                        # Activos servidos por Vercel Edge CDN o Express (Render)
│   ├── index.html                 # Interfaz principal accesible con Skeleton Loader
│   ├── manifest.json              # Manifiesto PWA instalable
│   ├── sw.js                      # Service Worker (Network-First HTML + exclusión CDNs)
│   ├── ads.txt                    # Verificación oficial de monetización AdSense
│   ├── styles.css                 # Punto de entrada modular CSS
│   ├── css/                       # Tokens (variables, base, components, drawer, videoPlayer, responsive)
│   ├── js/
│   │   ├── app.js                 # Orquestador principal frontend
│   │   ├── config/constants.js    # URLs de librerías IA diferidas y límites de cliente
│   │   ├── utils/dom.util.js      # Sanitización anti-XSS, lazy-loader y bloqueo de scroll
│   │   ├── services/              # API cliente, IA MobileNet, Extractor WAV Web Audio y PDF
│   │   └── components/            # Galería, Reproductor HD, Drawer OCR, Editor Canvas, ZIP Modal
│   └── assets/logo.svg            # Logotipo vectorial oficial
├── tests/
│   └── server-serverless.test.js  # Suite automatizada de pruebas Serverless, SSRF, ZIP y sintaxis
├── server.js                      # Instancia Express exportable + servidor HTTP para Render/Local
├── vercel.json                    # Configuración Vercel v2 (Edge Static + Function maxDuration 60s)
├── .env.example                   # Plantilla de variables de entorno
└── package.json                   # Dependencias CommonJS estables y engines Node >=20.18.1
```

---

## 🚀 Instalación, Ejecución y Despliegue (Vercel & Render)

### Requisitos Previos
- **Node.js** `>= 20.18.1` (recomendado Node 22 LTS).
- Navegador moderno con soporte para WebGL, Web Audio API y WebAssembly.

### Ejecución Local
```bash
npm install
npm test
npm start
```
Accede en tu navegador a `http://localhost:3005`.

### Despliegue en Vercel (Serverless + Edge CDN)
1. Importa el repositorio en **Vercel** (Framework Preset: *Other*).
2. `vercel.json` sirve automáticamente `public/` desde el Edge CDN global y enruta `/api/*` hacia `api/index.js` (`module.exports = app`).
3. Configura variables opcionales desde `.env.example` (`ALLOWED_ORIGINS` si usas dominios externos adicionales).

### Despliegue en Render (Web Service Persistente)
1. Crea un **Web Service** conectado al repositorio.
2. **Build Command**: `npm install`
3. **Start Command**: `npm start` (`node server.js` detecta que no está en Vercel y levanta `app.listen(PORT)` automáticamente).
4. **Health Check Path**: `/api/health`


---

## 📡 Referencia de API Backend

### 1. `POST /api/scrape`
Analiza una URL remota y extrae todas las imágenes, videos accesibles y variantes de calidad.
- **Body**: `{ "url": "https://ejemplo.com", "isDeepScrape": false }`
- **Respuesta JSON**:
  ```json
  {
    "url": "https://ejemplo.com",
    "title": "Título de la página",
    "isDirectVideoPage": false,
    "stats": { "total": 12, "images": 10, "videos": 2 },
    "items": [
      {
        "id": "media-0",
        "url": "https://ejemplo.com/imagen.jpg",
        "proxyUrl": "/api/proxy?url=...",
        "type": "image",
        "extension": "jpg",
        "filename": "imagen.jpg",
        "width": 1920,
        "height": 1080
      }
    ],
    "mainVideo": null
  }
  ```

### 2. `GET /api/proxy`
Proxy de streaming anti-CORS con soporte para *HTTP 206 Partial Content (Range Requests)* y reescritura de manifiestos HLS (`.m3u8`).
- **Query Params**: `?url=https://...`

### 3. `POST /api/export-zip`
Empaqueta y transmite en tiempo real una colección de archivos comprimidos en un archivo ZIP sin almacenar en disco.
- **Body**: `{ "items": [{ "url": "https://...", "filename": "archivo.jpg" }] }`

### 4. `POST /api/export`
Guarda una colección de archivos seleccionados directamente en un directorio local del equipo.
- **Body**: `{ "targetDirectory": "C:\\Downloads\\ScrapedMedia", "items": [...] }`

### 5. `GET /api/download`
Fuerza la descarga directa de un archivo con encabezados `Content-Disposition: attachment` y ensamblado de transmisiones HLS a MP4.
- **Query Params**: `?url=https://...&filename=nombre.ext`

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

---

<p align="center">
  Desarrollado con ❤️ y la ingeniería de <strong>MediaScraper Team — 2026</strong>
</p>
