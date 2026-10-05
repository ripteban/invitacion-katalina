# Invitación digital · Katalina · Mis 15 Años

Sitio estático (Astro + CSS + GSAP), solo mobile, réplica 1:1 del Figma `fKAPd6dKiyFhEsiEfObYrg`.

## Uso diario

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # genera dist/ (lo que se publica)
```

## Cambiar contenido

| Qué | Dónde |
|---|---|
| Textos, fecha, hora, lugar, enlaces de Google Maps / Waze, transporte | `src/data/evento.ts` |
| Posición inicial, rotación y orden de cada polaroid / sticker | `src/data/galerias.ts` (coordenadas de Figma en px sobre 412 de ancho) |
| Reemplazar una foto | sustituir `src/assets/fotos/g1-1.png` … (cuadradas, idealmente ≥ 1000 px, sin comprimir) o editar el recorte en `scripts/preparar-recursos.mjs` y correr `npm run recursos` |
| URL pública (para la vista previa de WhatsApp) | `site` en `astro.config.mjs` |
| Imagen de vista previa de WhatsApp | `npm run dev` y luego `npm run og` → `public/og-image.jpg` |

## Cómo está hecho

- **Escala**: todo valor de Figma se multiplica por `--u = --ancho / 412` (`src/styles/tokens.css`), así se ve idéntico en cualquier pantalla. La intro usa `--ui`, que además cabe en alto.
- **Tamaños de pantalla** (`--ancho` en `tokens.css`; si se cambian, actualizar `sizes` en `Img.astro`):
  - Móvil (< 600 px, de 320 a 599): la invitación ocupa todo el ancho, igual que en Figma. El video de seda se pausa al abrir.
  - Tablet vertical: tarjeta centrada de hasta 640 px.
  - Tablet horizontal, teléfono horizontal y escritorio: tarjeta de 440–540 px con esquinas redondeadas y sombra sobre el video de seda difuminado (`Fondo.astro`).
  - Con mouse: el sobre se acerca al pasar el cursor y los botones de mapas se elevan.
- **Home**: lienzo de 4955 u de alto; cada elemento usa sus coordenadas de Figma (`.abs` con `--x --y --w --h --z`). Las secciones no crean contexto de apilamiento, así el orden de capas es el de Figma.
- **Intro** (`src/scripts/intro.ts`): clic → sobre cambia de estado con la curva *Gentle* de Figma (1022 ms) → 100 ms → el Home aparece con *Dissolve Ease Out* (300 ms).
- **Arrastre** (`src/scripts/arrastrar.ts`, GSAP Draggable, se carga después de abrir el sobre): fotos y stickers se levantan con presión larga de 250 ms (un deslizamiento normal es scroll) y crecen con énfasis (fotos 1.3×, stickers 1.35×, con rebote y balanceo); nada sale de su galería y al soltarlos regresan de inmediato a su lugar. Escalas en `ESCALA_FOTO` y `ESCALA_STICKER`. La pista "Mantén presionado y mueve las fotos" (`Pista.astro`) se oculta tras el primer arrastre.
- **Microanimaciones** (`src/styles/animaciones.css`): stickers y fotos flotan, flores se mecen, campo con brisa, tiara flota, sello late, la mano del sobre "presiona", el bus vibra. Usan `translate`/`rotate`/`scale` (no chocan con GSAP) y se desactivan con *reducir movimiento*.
- **Imágenes**: `astro:assets` genera WebP en anchos de 1× a 4× del diseño y el navegador elige según la pantalla (`Img.astro`). Fotos a calidad 90, decoraciones a 80. Los maestros en `src/assets` salen de `scripts/preparar-recursos.mjs`:
  - Fotos: recorte exacto de Figma sobre el original de mayor resolución, guardado sin pérdida (PNG) a resolución nativa (1100–1800 px), sin recomprimir.
  - Foto 1: versión natural (la de Figma era una edición retocada); su encuadre se alinea con `scripts/alinear-fotos.py` (requiere `pip install opencv-python-headless`).
  - Campo de flores: fundido con el degradado de la página para quitar la transparencia (pesa ~⅓).
- **Privacidad**: `noindex` en meta, `X-Robots-Tag` en `public/_headers` y `robots.txt` con `Disallow: /`.

## Carpetas de trabajo (no se publican)

- `entrada/` — archivos entregados (sobres, stickers, video del fondo).
- `figma-export/raw/` — descarga cruda de Figma vía MCP (ignorada en git, pesa ~35 MB).
- `qa/referencia/` — renders de Figma para comparar; `qa/capturas/` — capturas generadas por `npm run qa`.

## QA

Con `npm run dev` corriendo: `npm run qa` (comparación lado a lado con Figma, prueba de arrastre y tamaños 360–430 px). Peso: `npm run build && npx astro preview` y `npm run qa:peso`.

## Publicar en Cloudflare Pages

1. Subir el repo a GitHub (privado).
2. Cloudflare → Workers & Pages → Create → Pages → conectar el repo.
3. Preset **Astro**, build `npm run build`, salida `dist`, variable `NODE_VERSION = 22`.
4. URL pública: https://katalina-invitacion-a-mis15.pages.dev (si cambia, actualizar `site` en `astro.config.mjs`).
