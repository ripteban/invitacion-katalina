// Paso 2 del video demo: compone el video final (1080×1920, 30 fps) a partir de la grabación.
// Usa demo/edicion.html (teléfono, fondo de seda, zoom de cámara, rótulos, tarjetas) y renderiza
// cada cuadro con Playwright; luego codifica con ffmpeg.
// Uso: node demo/editar.mjs   (requiere haber corrido demo/grabar.mjs)
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const { fps, total, ancho, marcas } = JSON.parse(await readFile('demo/captura/marcas.json', 'utf8'));
const INICIO = 1.9; // segundo del video en que empieza la grabación (mientras sube el teléfono)
const T1 = INICIO + total / fps; // fin de la grabación
const DURACION = T1 + 4.4; // + tarjeta final

const M = Object.fromEntries(marcas.map((m) => [m.nombre, { t: INICIO + m.cuadro / fps, caja: m.caja }]));
const t = (n) => M[n].t;
const centro = (n) => {
  const c = M[n].caja;
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
};
const neutro = { s: 1, x: ancho / 2, y: 1375 };
const cam = (tt, s, p = neutro) => ({ t: tt, s, x: p.x, y: p.y });

const camara = [
  cam(0, 1),
  cam(t('tocar-sobre') - 0.2, 1),
  cam(t('tocar-sobre') + 0.7, 1.3, centro('tocar-sobre')),
  cam(t('portada') - 0.25, 1.3, centro('tocar-sobre')),
  cam(t('portada') + 0.6, 1),
  cam(t('foto') + 0.2, 1),
  cam(t('foto') + 1.1, 1.3, centro('foto')),
  cam(t('sticker') - 0.2, 1.3, centro('foto')),
  cam(t('sticker') + 0.8, 1.32, centro('sticker')),
  cam(t('frase') - 0.15, 1.32, centro('sticker')),
  cam(t('frase') + 0.9, 1),
  cam(t('mapas'), 1),
  cam(t('mapas') + 0.8, 1.55, centro('mapas')),
  cam(t('transporte') - 0.1, 1.55, centro('mapas')),
  cam(t('transporte') + 0.9, 1),
  cam(t('galeria2') + 1.3, 1),
  cam(t('galeria2') + 2.1, 1.25, { x: ancho / 2, y: 1450 }),
  cam(t('cierre') - 0.1, 1.25, { x: ancho / 2, y: 1450 }),
  cam(t('cierre') + 0.9, 1),
];

const rotulos = [
  { titulo: 'Toca el sobre', sub: 'para abrir la invitación', desde: 2.5, hasta: t('portada') },
  { titulo: 'Todo cobra vida', sub: 'animaciones suaves en cada detalle', desde: t('portada'), hasta: t('foto') },
  { titulo: 'Mantén presionada una foto', sub: 'se agranda y la mueves · al soltar vuelve a su lugar', desde: t('foto'), hasta: t('sticker') },
  { titulo: 'Los stickers también', sub: 'mantén presionado y juega con ellos', desde: t('sticker'), hasta: t('frase') },
  { titulo: 'Desliza para recorrer', sub: 'mensaje, fecha, hora y lugar', desde: t('frase'), hasta: t('mapas') },
  { titulo: 'Llega sin perderte', sub: 'abre la ubicación en Google Maps o Waze', desde: t('mapas'), hasta: t('transporte') },
  { titulo: 'Transporte incluido', sub: 'punto de reunión y horario', desde: t('transporte'), hasta: t('galeria2') },
  { titulo: 'Más recuerdos', sub: 'otra galería para disfrutar', desde: t('galeria2'), hasta: t('cierre') },
  { titulo: 'Un recuerdo para siempre', sub: '', desde: t('cierre'), hasta: T1 - 0.2 },
];

const cfg = { fps, total, anchoCaptura: ancho, inicioCaptura: INICIO, T0: INICIO, T1, camara, rotulos };
const N = Math.ceil(DURACION * 30);
const OUT = 'demo/salida';
await rm(`${OUT}/cuadros`, { recursive: true, force: true });
await mkdir(`${OUT}/cuadros`, { recursive: true });

// Render en paralelo (3 pestañas)
const b = await chromium.launch();
const HILOS = 3;
let listos = 0;
async function trabajador(h) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(pathToFileURL(resolve('demo/edicion.html')).href);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate((c) => window.configurar(c), cfg);
  for (let f = h; f < N; f += HILOS) {
    await p.evaluate((tt) => window.render(tt), f / 30);
    const img = await p.screenshot({ type: 'jpeg', quality: 95 });
    await writeFile(`${OUT}/cuadros/${String(f).padStart(5, '0')}.jpg`, img);
    if (++listos % 300 === 0) console.log(`  ${listos}/${N} cuadros`);
  }
}
await Promise.all(Array.from({ length: HILOS }, (_, h) => trabajador(h)));
await b.close();
console.log(`render: ${N} cuadros (${DURACION.toFixed(1)} s)`);

// Codificación: alta calidad + versión liviana para WhatsApp (≤ 16 MB)
const comun = ['-y', '-v', 'error', '-framerate', '30', '-i', `${OUT}/cuadros/%05d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart'];
execFileSync('ffmpeg', [...comun, '-preset', 'slow', '-crf', '17', `${OUT}/demo-katalina-HD.mp4`]);
const kbps = Math.floor((15.5 * 8 * 1024) / DURACION);
execFileSync('ffmpeg', [...comun, '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-pass', '1', '-an', '-f', 'mp4', 'NUL']);
execFileSync('ffmpeg', [...comun, '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-pass', '2', `${OUT}/demo-katalina-WhatsApp.mp4`]);
await writeFile(`${OUT}/linea-de-tiempo.json`, JSON.stringify({ DURACION, T1, camara, rotulos }, null, 1));
console.log('listo:', `${OUT}/demo-katalina-HD.mp4`, `${OUT}/demo-katalina-WhatsApp.mp4`);
