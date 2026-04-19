<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# NewsGen Publisher - Generador de Artículos con IA

Generador de artículos periodísticos que usa **GNews** y **APINews** como fuentes de información, y **Gemini 2.5 Flash** como cerebro para redactar.

## Características

- 🔍 **Fuentes reales**: Usa GNews API o APINews para obtener noticias reales
- 🤖 **Redacción con Gemini**: Gemini 2.5 Flash procesa las fuentes y crea el artículo
- 📰 **Headlines o noticias de ayer**: Consulta noticias actuales o del día anterior
- 🎯 **Por tema o región**: Filtra noticias por categoría, idioma y región

## APIs de Noticias Soportadas

| Proveedor | Web | Plan Gratuito |
|-----------|-----|----------------|
| **GNews** | https://gnews.io/ | 100 requests/día |
| **APINews** (NewsAPI) | https://newsapi.org/ | 100 requests/día |

## Ejecutar Localmente

**Prerrequisitos:** Node.js

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.example .env.local
   ```
   
3. Editar `.env.local` con tus API keys:
   - **VITE_GEMINI_API_KEY** (requerido) - Obtén en [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **VITE_GNEWS_API_KEY** (recomendado) - Obtén en [GNews](https://gnews.io/)
   - **VITE_APINEWS_API_KEY** (opcional) - Obtén en [NewsAPI](https://newsapi.org/)
   - **VITE_PEXELS_API_KEY** (opcional) - Obtén en [Pexels](https://www.pexels.com/api/)

4. Ejecutar la aplicación:
   ```bash
   npm run dev
   ```

## Flujo de Trabajo

1. **Modo Tema**: Escribe un tema o palabra clave
2. **Consulta de Fuentes**: La app busca noticias relevantes en GNews/APINews
3. **Redacción**: Gemini analiza las fuentes y redacta el artículo
4. **Revisión**: Revisa, edita y personaliza el contenido
5. **Publicación**: Genera audio, imágenes y exporta

## Configuración en la App

Abre **Configuración del Proyecto** (haz clic en el logo) para:
- Agregar/editar API keys
- Elegir proveedor preferido (GNews o APINews)
- Configurar dominios confiables/bloqueados
