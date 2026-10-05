// QA de peso: bytes descargados por un teléfono (412 px) en la intro y tras recorrer todo el Home.
// Uso: npm run build && npx astro preview  →  node scripts/qa-peso.mjs [url] [dpr]
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4321';
const DPR = Number(process.argv[3] ?? 3);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 917 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
const porTipo = {};
let total = 0;
const tipos = new Map();
cdp.on('Network.responseReceived', (e) => tipos.set(e.requestId, e.type));
cdp.on('Network.loadingFinished', (e) => {
  const t = tipos.get(e.requestId) ?? 'Other';
  porTipo[t] = (porTipo[t] ?? 0) + e.encodedDataLength;
  total += e.encodedDataLength;
});
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

await page.goto(URL, { waitUntil: 'networkidle' });
const intro = total;
console.log(`Intro (DPR ${DPR}): ${kb(intro)}`, Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, kb(v)])));

await page.tap('.sobre');
await page.waitForSelector('#intro', { state: 'detached' });
for (let y = 0; y < 5200; y += 400) {
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(120);
}
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
console.log(`Total tras recorrer el Home: ${kb(total)}`, Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, kb(v)])));
await b.close();
