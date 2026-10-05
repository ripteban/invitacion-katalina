// QA de medios: video de fondo en autoplay, música al tocar el sobre, botón de silencio
// y pausa al ocultar la pestaña. Uso: node scripts/qa-medios.mjs [url] [navegador: msedge|webkit]
import { chromium, webkit } from 'playwright';

const URL = process.argv[2] ?? 'http://127.0.0.1:8788';
const NAV = process.argv[3] ?? 'msedge';
const b = NAV === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: NAV !== 'webkit', hasTouch: true });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const rangos = [];
p.on('response', (r) => r.url().includes('/medios/') && rangos.push(`${r.status()} ${r.url().split('/').pop()}`));

await p.goto(URL, { waitUntil: 'load' });
await p.waitForTimeout(2500);
const video = await p.evaluate(() => {
  const v = document.querySelector('#fondo video');
  return { reproduciendo: !v.paused, tiempo: +v.currentTime.toFixed(2), estado: v.readyState };
});
console.log('video de fondo:', video);

await p.tap('.sobre');
await p.waitForTimeout(3500);
const musica = await p.evaluate(() => {
  const a = document.getElementById('musica');
  const b = document.getElementById('boton-musica');
  return { sonando: !a.paused, tiempo: +a.currentTime.toFixed(2), boton: !b.hidden && b.classList.contains('visible'), aria: b.getAttribute('aria-label') };
});
console.log('música tras tocar el sobre:', musica);

await p.tap('#boton-musica');
await p.waitForTimeout(300);
console.log('tras silenciar:', await p.evaluate(() => ({ sonando: !document.getElementById('musica').paused, aria: document.getElementById('boton-musica').getAttribute('aria-label') })));
await p.tap('#boton-musica');
await p.waitForTimeout(500);
console.log('tras reactivar:', await p.evaluate(() => ({ sonando: !document.getElementById('musica').paused })));

// pestaña oculta → pausa; visible → retoma
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await p.waitForTimeout(200);
const oculta = await p.evaluate(() => !document.getElementById('musica').paused);
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
await p.waitForTimeout(500);
console.log('pestaña oculta → sonando:', oculta, '| visible de nuevo → sonando:', await p.evaluate(() => !document.getElementById('musica').paused));
console.log('respuestas de /medios:', [...new Set(rangos)].join(', '));
console.log('errores:', errores);
await p.screenshot({ path: 'qa/capturas/medios.png' });
await b.close();
