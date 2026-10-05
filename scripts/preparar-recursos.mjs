// Prepara los recursos maestros en src/assets a partir de:
//   figma-export/raw  (descarga cruda vía MCP de Figma)
//   entrada/          (archivos entregados por la clienta)
// Las fotos se recortan con los mismos encuadres que usa Figma, sin pérdida y a resolución nativa.
// Astro (astro:assets) genera después los WebP finales en varios anchos.
// Uso: node scripts/preparar-recursos.mjs
import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { optimize } from 'svgo';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const RAW = 'figma-export/raw';
const IN = 'entrada';
const OUT = 'src/assets';
const ESCALA = 3.2; // 3× + margen para pantallas de 430 px

async function salida(ruta) {
  await mkdir(dirname(join(OUT, ruta)), { recursive: true });
  return join(OUT, ruta);
}

/** object-fit: cover centrado */
async function cubrir(src, ruta, W, H) {
  const out = await salida(ruta);
  await sharp(src).resize(Math.round(W * ESCALA), Math.round(H * ESCALA), { fit: 'cover', kernel: 'lanczos3' }).png().toFile(out);
  console.log('cubrir', ruta);
}

/** PNG con transparencia redimensionado (sin ampliar) */
async function png(src, ruta, W, H) {
  const out = await salida(ruta);
  let p = sharp(src);
  const { width, height } = await p.metadata();
  const ancho = W ? Math.min(width, Math.round(W * ESCALA)) : width;
  const alto = Math.round(H ? (H * ancho) / W : (height * ancho) / width);
  p = p.resize(ancho, alto, { fit: 'fill', kernel: 'lanczos3' });
  await p.png({ compressionLevel: 9 }).toFile(out);
  console.log('png', ruta);
}

/** Recorta al cuadro donde alfa > 0 (sobres entregados) */
async function recortarAlfa(src, ruta) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  const out = await salida(ruta);
  await sharp(src).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png({ compressionLevel: 9 }).toFile(out);
  console.log('sobre', ruta, x0, y0, x1, y1);
}

/**
 * Reconstruye una capa de Figma con transparencia: la imagen se estira (fill) a ew×eh
 * —opcionalmente con recorte tipo Figma—, se espeja en Y, se rota (grados, horario como CSS)
 * y se centra en la caja final bw×bh (bounding box que reporta Figma). Escala 4×.
 */
async function capa(src, ruta, { bw, bh, ew, eh, recorte, rot = 0, espejoY = false }) {
  const S = 4;
  const W = Math.round(ew * S), H = Math.round(eh * S);
  let img = sharp(src).ensureAlpha();
  if (recorte) {
    const { width: sw, height: sh } = await img.metadata();
    const { l, t, w, h } = recorte;
    const s = sw / (ew * w);
    const left = Math.round(-l * ew * s), top = Math.round(-t * eh * s);
    const ancho = Math.round(ew * s), alto = Math.round(eh * s);
    // extender con transparencia si el recorte se sale de la imagen
    img = sharp(await img.extend({ right: Math.max(0, left + ancho - sw), bottom: Math.max(0, top + alto - sh), background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer())
      .extract({ left, top, width: ancho, height: alto });
  }
  let buf = await img.resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  if (espejoY) buf = await sharp(buf).flip().png().toBuffer();
  if (rot) buf = await sharp(buf).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(buf).metadata();
  const CW = Math.round(bw * S), CH = Math.round(bh * S);
  const lienzo = sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  // si la pieza rotada es mayor que la caja, se recorta centrada
  const ox = Math.round((CW - m.width) / 2), oy = Math.round((CH - m.height) / 2);
  const pieza = await sharp(buf)
    .extract({ left: Math.max(0, -ox), top: Math.max(0, -oy), width: Math.min(m.width, CW), height: Math.min(m.height, CH) })
    .toBuffer();
  await lienzo.composite([{ input: pieza, left: Math.max(0, ox), top: Math.max(0, oy) }]).png({ compressionLevel: 9 }).toFile(await salida(ruta));
  console.log('capa', ruta);
}

async function svg(src, ruta) {
  const out = await salida(ruta);
  const { data } = optimize(await readFile(src, 'utf8'), {
    multipass: true,
    plugins: ['preset-default'],
  });
  // Figma agrega preserveAspectRatio="none" y estilos en línea; se quitan.
  await writeFile(out, data.replace(/ preserveAspectRatio="none"/, '').replace(/ style="display:block"/, ''));
  console.log('svg', ruta);
}

// ---------- Intro ----------
// Fondo de la intro: video entregado (31 MB) → 720×1280 H.264 sin audio; póster = cuadro del segundo 1.
// El original trae una franja negra de 4 px en el borde en algunos cuadros (y el póster de Figma también):
// se recortan 8 px por lado manteniendo 9:16.
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${IN}/Fondo.mp4`, '-an', '-vf', 'crop=1064:1892,scale=720:1280:flags=lanczos',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart',
  'public/medios/fondo-intro.mp4']);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '1', '-i', `${IN}/Fondo.mp4`, '-frames:v', '1', '-vf', 'crop=1064:1892', '-q:v', '2', await salida('intro/poster.jpg')]);
console.log('video public/medios/fondo-intro.mp4 + intro/poster.jpg');
// Música de fondo (entrada/musica.mp3): sin el silencio final, volumen de fondo (-21 LUFS), fundidos
// de entrada/salida incluidos (en iPhone el volumen no se controla desde la página) y AAC para iPhone y
// Android. Al cambiar la canción, ajustar MUSICA_FIN (segundo donde empieza el silencio final).
const MUSICA_FIN = 160.0;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${IN}/musica.mp3`, '-af',
  `atrim=0:${MUSICA_FIN},asetpts=N/SR/TB,loudnorm=I=-21:TP=-2:LRA=9,afade=t=in:d=2.5,afade=t=out:st=${MUSICA_FIN - 3}:d=3`,
  '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'public/medios/musica.m4a']);
console.log('música public/medios/musica.m4a');
await recortarAlfa(`${IN}/1.png`, 'sobre/cerrado-sobre.png');
await recortarAlfa(`${IN}/2.png`, 'sobre/abierto-sobre.png');
await png(`${RAW}/cerrado-sello.png`, 'sobre/cerrado-sello.png', 72.524, 75.505);
await png(`${RAW}/abierto-sello.png`, 'sobre/abierto-sello.png', 72.524, 75.505);
// Flores del sobre y tiara: se reconstruyen desde el original (las exportaciones de Figma vienen sin transparencia)
await capa(`${RAW}/cerrado-flores-izq.png`, 'sobre/cerrado-flores-izq.png', { bw: 132.751, bh: 130.981, ew: 132.751, eh: 130.981 });
await capa(`${RAW}/abierto-flores-izq.png`, 'sobre/abierto-flores-izq.png', { bw: 132.751, bh: 130.981, ew: 132.751, eh: 130.981 });
await capa(`${RAW}/cerrado-flores-der.png`, 'sobre/cerrado-flores-der.png', { bw: 105.09, bh: 127.163, ew: 60.641, eh: 111.806, rot: 152.76, espejoY: true });
await capa(`${RAW}/abierto-flores-der.png`, 'sobre/abierto-flores-der.png', { bw: 111.111, bh: 134.448, ew: 64.115, eh: 118.212, rot: 152.76, espejoY: true });
await capa(`${RAW}/tiara-src.png`, 'comun/tiara.png', {
  bw: 189.56, bh: 112.995, ew: 177.437, eh: 80.62, rot: -11,
  recorte: { l: -0.0145, t: -0.5649, w: 1, h: 2.2009 },
});

// ---------- Fotos de polaroid (227.948 × 227.948) ----------
// Maestros sin pérdida (PNG) a la resolución nativa del recorte (~1100–1800 px): sin reducir ni
// recomprimir aquí; astro:assets genera los WebP finales. Fuentes = originales de mayor resolución.
async function fotoNativa(src, ruta, { x, y, lado }) {
  const img = sharp(src);
  const { width: sw, height: sh } = await img.metadata();
  const left = Math.max(0, Math.round(x)), top = Math.max(0, Math.round(y));
  // si el encuadre de Figma se pasa unos px del borde, se recorta al borde (cuadrado)
  const l = Math.min(Math.round(lado), sw - left, sh - top);
  await img.extract({ left, top, width: l, height: l }).png({ compressionLevel: 9 }).toFile(await salida(ruta));
  console.log('foto', ruta, `${l}×${l} px (${(l / F).toFixed(2)}× diseño)`);
}
/** Encuadre de Figma (porcentajes) → cuadro en px de la fuente */
async function encuadre(src, { l = 0, t = 0, w = 1 } = {}, cubrirCentro = false) {
  const { width: sw, height: sh } = await sharp(src).metadata();
  if (cubrirCentro) {
    const lado = Math.min(sw, sh);
    return { x: (sw - lado) / 2, y: (sh - lado) / 2, lado };
  }
  const s = sw / (F * w);
  return { x: -l * F * s, y: -t * F * s, lado: F * s };
}
const F = 227.948;
const recortes = JSON.parse(await readFile('scripts/recortes-fotos.json', 'utf8'));
// Foto 1: versión natural de la clienta (encuadre de Figma alineado con scripts/alinear-fotos.py)
await fotoNativa(recortes['g1-1'].src, 'fotos/g1-1.png', recortes['g1-1']);
await fotoNativa(`${RAW}/g1-2.png`, 'fotos/g1-2.png', await encuadre(`${RAW}/g1-2.png`, { l: 0, t: -0.7917, w: 1 }));
await fotoNativa(`${RAW}/g2-1.png`, 'fotos/g2-1.png', await encuadre(`${RAW}/g2-1.png`, {}, true));
await fotoNativa(`${RAW}/g2-2.png`, 'fotos/g2-2.png', await encuadre(`${RAW}/g2-2.png`, { l: -0.0638, t: -0.4253, w: 1.1275 }));
await fotoNativa(`${RAW}/g2-3.png`, 'fotos/g2-3.png', await encuadre(`${RAW}/g2-3.png`, { l: -0.0054, t: -0.2787, w: 1 }));
await fotoNativa(`${RAW}/g2-4.png`, 'fotos/g2-4.png', await encuadre(`${RAW}/g2-4.png`, { l: 0.0001, t: 0, w: 1 }));
await fotoNativa(`${RAW}/g2-5.png`, 'fotos/g2-5.png', await encuadre(`${RAW}/g2-5.png`, { l: -0.1334, t: -0.4398, w: 1.2544 }));
// Punto de reunión (foto entregada, entrada/punto-reunion.jpg): encuadre del recuadro 304.15×171,
// maestro sin pérdida a 4× (1217 px de ancho), sin ampliar si la foto es más chica.
{
  const { width: sw } = await sharp(`${IN}/punto-reunion.jpg`).metadata();
  const ancho = Math.min(sw, Math.round(304.15 * 4));
  await sharp(`${IN}/punto-reunion.jpg`)
    .resize(ancho, Math.round((ancho * 171) / 304.15), { fit: 'cover', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(await salida('fotos/punto-reunion.png'));
  console.log(`foto fotos/punto-reunion.png ${ancho} px`);
}

// ---------- Stickers ----------
await png(`${RAW}/lirio.png`, 'stickers/lirio.png', 160.239);
await png(`${RAW}/corazones.png`, 'stickers/corazones.png', 160.239);
await png(`${IN}/Circular Flower Image.png`, 'stickers/tulipan.png');
await png(`${IN}/pastel.png`, 'stickers/pastel.png');
await png(`${IN}/cereza.png`, 'stickers/cerezas.png');
await png(`${IN}/sobre.png`, 'stickers/sobre.png');
await png(`${IN}/cafe.png`, 'stickers/taza.png');

// ---------- Decoraciones ----------
await cubrir(`${RAW}/cerezo-esquina.png`, 'decoraciones/cerezo-esquina.png', 203.459, 131.231);
{
  // Campo de flores: h 134.09 %, top −34.07 %
  const W = 412.015, H = 204.92;
  const img = sharp(`${RAW}/campo-flores.png`);
  const { width: sw, height: sh } = await img.metadata();
  const s = sw / W;
  const top = Math.round(0.3407 * H * s);
  const campo = await img
    .extract({ left: 0, top, width: sw, height: Math.min(Math.round(H * s), sh - top) })
    .resize(Math.round(W * ESCALA), Math.round(H * ESCALA), { fit: 'fill' })
    .png()
    .toBuffer();
  // Debajo del campo solo está el degradado de la página (#FFF8F3 → #FFDBD8 en 4955 + 28 de alto;
  // el campo empieza en y = 987 + 28). Se funde con ese mismo degradado para quitar la transparencia:
  // se ve idéntico y el WebP pesa mucho menos. Si cambia --extra en index.astro, actualizar aquí.
  const ALTO_PAGINA = 4955 + 28, Y0 = 987 + 28;
  const ancho = Math.round(W * ESCALA), alto = Math.round(H * ESCALA);
  const fondo = Buffer.alloc(ancho * alto * 3);
  const c0 = [0xff, 0xf8, 0xf3], c1 = [0xff, 0xdb, 0xd8];
  for (let fila = 0; fila < alto; fila++) {
    const t = (Y0 + fila / ESCALA) / ALTO_PAGINA;
    const c = c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
    for (let x = 0; x < ancho; x++) fondo.set(c, (fila * ancho + x) * 3);
  }
  await sharp(fondo, { raw: { width: ancho, height: alto, channels: 3 } })
    .composite([{ input: campo }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(await salida('decoraciones/campo-flores.png'));
  console.log('png decoraciones/campo-flores.png (sin transparencia)');
}
await png(`${RAW}/cerezo-a.png`, 'decoraciones/cerezo-a.png', 146.017);
await png(`${RAW}/cerezo-b.png`, 'decoraciones/cerezo-b.png', 151.974);
await png(`${RAW}/loto.png`, 'decoraciones/loto.png', 410.279);
await png(`${RAW}/rosas.png`, 'decoraciones/rosas.png', 303.169);
await copyFile(`${RAW}/x-gmaps-pin@4x.png`, await salida('iconos/gmaps-pin.png'));

// ---------- SVG ----------
await svg(`${RAW}/katalina.svg`, 'svg/katalina.svg');
await svg(`${RAW}/mis15.svg`, 'svg/mis-15-anos.svg');
await svg(`${RAW}/mano.svg`, 'svg/mano.svg');
await svg(`${RAW}/separador.svg`, 'svg/separador.svg');
await svg(`${RAW}/gmaps-texto.svg`, 'svg/gmaps-texto.svg');
await svg(`${RAW}/waze-icono.svg`, 'svg/waze-icono.svg');
await svg(`${RAW}/waze-texto.svg`, 'svg/waze-texto.svg');
await svg(`${RAW}/bus.svg`, 'svg/bus.svg');
