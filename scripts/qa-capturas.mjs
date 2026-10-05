// QA de fidelidad: captura la intro (cerrada/abierta) y el Home a 412 px @2× y las compara
// lado a lado con las referencias exportadas de Figma (qa/referencia).
// Uso: node scripts/qa-capturas.mjs [url]   (por defecto http://localhost:4321)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const URL = process.argv[2] ?? 'http://localhost:4321';
const OUT = 'qa/capturas';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 917 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle' });
// Se congela el video en el póster para comparar con Figma
await page.evaluate(() => {
  const v = document.querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
});
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${OUT}/01-intro-cerrada.png` });

await page.click('.sobre');
await page.waitForTimeout(1050);
await page.screenshot({ path: `${OUT}/02-intro-abierta.png` });

await page.waitForSelector('#intro', { state: 'detached' });
// Forzar carga de imágenes diferidas
await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
await page.waitForLoadState('networkidle');
await page.evaluate(async () => {
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
});
await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });
await browser.close();

async function ladoALado(a, b, salida) {
  const A = sharp(a), B = sharp(b);
  const [ma, mb] = await Promise.all([A.metadata(), B.metadata()]);
  const h = Math.max(ma.height, mb.height);
  await sharp({ create: { width: ma.width + mb.width + 20, height: h, channels: 4, background: '#888' } })
    .composite([{ input: await A.toBuffer(), left: 0, top: 0 }, { input: await B.toBuffer(), left: ma.width + 20, top: 0 }])
    .png()
    .toFile(salida);
}
await ladoALado('qa/referencia/01-intro-cerrada@2x.png', `${OUT}/01-intro-cerrada.png`, `${OUT}/cmp-01.png`);
await ladoALado('qa/referencia/02-intro-abierta@2x.png', `${OUT}/02-intro-abierta.png`, `${OUT}/cmp-02.png`);
await ladoALado('qa/referencia/home@2x.png', `${OUT}/home.png`, `${OUT}/cmp-home.png`);
console.log('listo:', OUT);
