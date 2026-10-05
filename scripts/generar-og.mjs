// Genera public/og-image.jpg (1200×630, vista previa de WhatsApp) a partir de la intro real.
// Requiere el servidor de desarrollo encendido. Uso: node scripts/generar-og.mjs [url]
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL = process.argv[2] ?? 'http://localhost:4321';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 315 }, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'load' });
await p.evaluate(async () => {
  const video = document.querySelector('#fondo video');
  // queda el póster como fondo; se espera a que cargue
  await new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = video.poster; });
  video.remove();
  // el lienzo es apaisado: se encuadra la zona baja del póster, donde están las ondas de seda
  const fondo = document.getElementById('fondo');
  fondo.style.backgroundPosition = 'center 88%';
  // velo claro detrás del nombre y el sobre para que se lean bien
  fondo.style.boxShadow = 'inset 0 0 0 100vmax rgba(255, 248, 243, 0.35)';
  const velo = document.createElement('div');
  velo.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse 34% 60% at 50% 48%, rgba(255,248,243,.85), rgba(255,248,243,0))';
  fondo.append(velo);
  document.querySelector('.intro__texto').style.display = 'none';
  // encabezado + sobre ocupando casi todo el alto del lienzo apaisado
  const intro = document.querySelector('.intro');
  intro.style.setProperty('--ui', '0.53px');
  document.querySelector('.intro__contenedor').style.top = '50%';
  await document.fonts.ready;
});
await p.waitForTimeout(800);
const png = await p.screenshot();
await b.close();
await sharp(png).resize(1200, 630).jpeg({ quality: 82, mozjpeg: true }).toFile('public/og-image.jpg');
console.log('public/og-image.jpg listo');
