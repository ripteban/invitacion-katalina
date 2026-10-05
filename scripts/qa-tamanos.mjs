// QA de tamaños: intro cerrada, intro abierta y primer pantallazo del Home en teléfonos,
// tablets y escritorio. Guarda una captura por tamaño en qa/capturas/tamanos/.
// Uso: node scripts/qa-tamanos.mjs [url]
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const URL = process.argv[2] ?? 'http://localhost:4321';
const OUT = 'qa/capturas/tamanos';
const TAMANOS = [
  // [nombre, ancho, alto, táctil]
  ['movil-320x568', 320, 568, true],
  ['movil-360x740', 360, 740, true],
  ['movil-375x667', 375, 667, true],
  ['movil-412x917', 412, 917, true],
  ['movil-430x932', 430, 932, true],
  ['movil-540x960', 540, 960, true],
  ['movil-horizontal-844x390', 844, 390, true],
  ['tablet-768x1024', 768, 1024, true],
  ['tablet-1024x1366', 1024, 1366, true],
  ['tablet-horizontal-1180x820', 1180, 820, true],
  ['escritorio-1366x768', 1366, 768, false],
  ['escritorio-1920x1080', 1920, 1080, false],
];
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
let fallos = 0;
for (const [nombre, w, h, tactil] of TAMANOS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: tactil, hasTouch: tactil });
  await p.goto(URL, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const cerrada = await p.screenshot();
  // El contenido de la intro debe caber en pantalla
  const cabe = await p.evaluate(() => {
    const r = document.querySelector('.intro__contenedor').getBoundingClientRect();
    return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -20 && r.right <= innerWidth + 20;
  });
  // clic desde la página para controlar el tiempo exacto (la intro se retira a los 1.42 s)
  const cabeAbierta = await p.evaluate(async () => {
    document.querySelector('.sobre').click();
    await new Promise((r) => setTimeout(r, 1030));
    const r = document.querySelector('.intro__contenedor').getBoundingClientRect();
    return r.top >= -1 && r.bottom <= innerHeight + 1;
  });
  const abierta = await p.screenshot();
  await p.waitForSelector('#intro', { state: 'detached' });
  await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
  await p.waitForTimeout(900);
  const home = await p.screenshot();
  const info = await p.evaluate(() => ({
    scrollH: document.documentElement.scrollWidth > innerWidth,
    ancho: Math.round(document.getElementById('home').getBoundingClientRect().width),
    video: !document.querySelector('#fondo video').paused,
  }));
  const ok = cabe && cabeAbierta && !info.scrollH;
  if (!ok) fallos++;
  console.log(
    `${ok ? '✓' : '✗'} ${nombre.padEnd(28)} intro cabe: ${cabe}/${cabeAbierta} · tarjeta ${info.ancho}px · scroll horizontal: ${info.scrollH} · video activo: ${info.video}`,
  );
  // tira: cerrada | abierta | home, a 600 px de alto
  const alto = 600;
  const piezas = await Promise.all([cerrada, abierta, home].map((i) => sharp(i).resize({ height: alto }).toBuffer({ resolveWithObject: true })));
  let x = 0;
  const capas = piezas.map(({ data, info: m }) => {
    const c = { input: data, left: x, top: 0 };
    x += m.width + 12;
    return c;
  });
  await sharp({ create: { width: x - 12, height: alto, channels: 4, background: '#555' } }).composite(capas).png().toFile(`${OUT}/${nombre}.png`);
  await p.close();
}
await b.close();
console.log(fallos ? `${fallos} tamaño(s) con problemas` : 'todos los tamaños OK', '→', OUT);
