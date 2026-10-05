// QA del arrastre (mouse): fotos y stickers ignoran el arrastre rápido y se levantan con presión larga.
// Uso: node scripts/qa-arrastre.mjs [url]
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4321';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 917 } });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

await p.goto(URL, { waitUntil: 'load' });
await p.click('.sobre', { timeout: 10000 });
await p.waitForSelector('#intro', { state: 'detached', timeout: 10000 });
await p.waitForTimeout(400);

const caja = (s) => p.locator(s).first().boundingBox();
const delta = (a, b) => [Math.round(b.x - a.x), Math.round(b.y - a.y)];

// 1) Sticker: arrastre rápido NO lo mueve; presión larga sí
const s0 = await caja('.galeria .sticker >> nth=1');
await p.mouse.move(s0.x + s0.width / 2, s0.y + s0.height / 2);
await p.mouse.down();
await p.mouse.move(s0.x - 40, s0.y + 60, { steps: 5 });
await p.mouse.up();
await p.waitForTimeout(400);
console.log('sticker tras arrastre rápido', delta(s0, await caja('.galeria .sticker >> nth=1')));
await p.mouse.move(s0.x + s0.width / 2, s0.y + s0.height / 2);
await p.mouse.down();
await p.waitForTimeout(320);
await p.mouse.move(s0.x, s0.y + 60, { steps: 10 });
await p.mouse.up();
await p.waitForTimeout(1300);
console.log('sticker tras presión larga y soltar (debe volver a 0,0)', delta(s0, await caja('.galeria .sticker >> nth=1')));
console.log('pista oculta', await p.locator('.pista').evaluate((e) => e.classList.contains('oculta')));

// 2) Polaroid: arrastre rápido NO la mueve
const p0 = await caja('.polaroid >> nth=0');
await p.mouse.move(p0.x + 100, p0.y + 100);
await p.mouse.down();
await p.mouse.move(p0.x + 160, p0.y + 160, { steps: 5 });
await p.mouse.up();
await p.waitForTimeout(400);
console.log('polaroid tras arrastre rápido', delta(p0, await caja('.polaroid >> nth=0')));

// 3) Polaroid: presión larga + mover
await p.mouse.move(p0.x + 100, p0.y + 100);
await p.mouse.down();
await p.waitForTimeout(320);
const levantada = await p.locator('.polaroid >> nth=0').evaluate((e) => e.classList.contains('levantada'));
await p.mouse.move(p0.x + 80, p0.y + 140, { steps: 10 });
await p.mouse.up();
await p.waitForTimeout(1300);
console.log('levantada', levantada, 'polaroid tras presión larga y soltar (debe volver a 0,0)', delta(p0, await caja('.polaroid >> nth=0')));
console.log(
  'capa restaurada / rotación conservada',
  await p.locator('.polaroid >> nth=0').evaluate((e) => [e.style.zIndex, e.querySelector('.polaroid__marco').style.rotate]),
);

// 4) Límites: intentar sacar un sticker de la galería
const t0 = await caja('.galeria .sticker >> nth=0');
await p.mouse.move(t0.x + 20, t0.y + 20);
await p.mouse.down();
await p.waitForTimeout(320);
await p.mouse.move(t0.x + 20, t0.y + 600, { steps: 10 });
await p.mouse.up();
await p.waitForTimeout(1500);
const t1 = await caja('.galeria .sticker >> nth=0');
const g = await caja('.galeria');
console.log('sticker dentro de la galería', t1.y + t1.height <= g.y + g.height + 1);

// 5) Regreso inmediato: al soltar vuelve a su lugar (animación de ~1 s)
await p.evaluate(() => scrollTo(0, 0));
await p.waitForTimeout(1200); // deja que lo anterior regrese
const r0 = await caja('.polaroid >> nth=1');
await p.mouse.move(r0.x + 120, r0.y + 120);
await p.mouse.down();
await p.waitForTimeout(800);
const escalaLevantada = await p.locator('.polaroid >> nth=1').evaluate((e) => e.getBoundingClientRect().width / e.offsetWidth);
await p.mouse.move(r0.x + 60, r0.y + 160, { steps: 10 });
const r1 = await caja('.polaroid >> nth=1');
await p.mouse.up();
await p.waitForTimeout(1200);
const r2 = await caja('.polaroid >> nth=1');
console.log('escala al levantar ≈', escalaLevantada.toFixed(2), '| movida (antes de soltar)', delta(r0, r1), '| 1.2 s después de soltar', delta(r0, r2));

console.log('errores', errores);
await b.close();
