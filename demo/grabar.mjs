// Paso 1 del video demo: graba un recorrido guiado por la invitación publicada, cuadro a cuadro
// con TIEMPO VIRTUAL (30 fps exactos sin importar cuánto tarde en dibujarse cada cuadro).
// Teléfono 412×917 a 3×: ventana de 1236×2751 px con el diseño móvil forzado por CSS.
// Salida: demo/captura/cuadros/*.jpg + marcas.json (escenas y cajas para el zoom de la edición).
// Uso: node demo/grabar.mjs [url]
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';

const URL = process.argv[2] ?? 'https://katalina-invitacion-a-mis15.pages.dev/';
const DIR = 'demo/captura';
const FPS = 30;
const DT = 1000 / FPS;
const ESC = 3;
const W = 412 * ESC, H = Math.round(917 * ESC);

await rm(`${DIR}/cuadros`, { recursive: true, force: true });
await mkdir(`${DIR}/cuadros`, { recursive: true });

const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();

// El video de fondo se reemplaza por sus cuadros (demo/captura/fondo) para sincronizarlo con el tiempo virtual
await p.route('**/__fondo/*', async (r) => {
  const archivo = r.request().url().split('/').pop();
  r.fulfill({ body: await readFile(`${DIR}/fondo/${archivo}`), contentType: 'image/jpeg' });
});

await p.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const F = innerWidth / 412;
    const css = document.createElement('style');
    css.textContent = `
      html:root{--ancho:100vw!important;--ui:min(calc(100vw / 412),calc(100svh / 820))!important}
      .home{margin:0 auto!important;border-radius:0!important;box-shadow:none!important}
      .sobre:hover{scale:1!important}
      #fondo video{display:none}
      #fondo-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      #dedo{position:fixed;left:0;top:0;width:${46 * F}px;height:${46 * F}px;margin:${-23 * F}px 0 0 ${-23 * F}px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,255,255,.8) 0 42%,rgba(255,255,255,.35) 43% 100%);
        border:${2 * F}px solid rgba(232,124,142,.95);box-shadow:0 ${4 * F}px ${16 * F}px rgba(92,64,66,.35);
        z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .3s, scale .15s;scale:1}
      #dedo.visible{opacity:1} #dedo.presionado{scale:.8}
      #dedo::after{content:'';position:absolute;inset:${-2 * F}px;border-radius:50%;border:${2 * F}px solid rgba(232,124,142,.85);opacity:0}
      #dedo.onda::after{animation:onda .6s ease-out}
      @keyframes onda{from{opacity:1;scale:1}to{opacity:0;scale:2.3}}`;
    document.head.append(css);
    document.querySelectorAll('img[sizes]').forEach((i) => (i.sizes = i.sizes.split(',').pop().trim()));
    document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager'));
    const fondo = document.getElementById('fondo');
    const img = new Image();
    img.id = 'fondo-img';
    img.src = '/__fondo/0001.jpg';
    fondo?.append(img);
    const d = document.createElement('div');
    d.id = 'dedo';
    document.body.append(d);
    addEventListener('pointermove', (e) => { d.style.translate = `${e.clientX}px ${e.clientY}px`; }, true);
    addEventListener('pointerdown', () => { d.classList.add('presionado'); d.classList.remove('onda'); void d.offsetWidth; d.classList.add('onda'); }, true);
    addEventListener('pointerup', () => d.classList.remove('presionado'), true);
    window.__dedo = (v) => d.classList.toggle('visible', v);
    addEventListener('click', (e) => { if (e.target.closest?.('.mapas a')) e.preventDefault(); }, true);
  });
});

await p.goto(URL, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
// Todas las imágenes cargadas antes de congelar el tiempo
await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))));
await p.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
// Avanza el reloj virtual; si la señal de fin no llega en 4 s (real), continúa igual
let colgados = 0;
const avanzar = (ms) =>
  new Promise((ok) => {
    const reloj = setTimeout(() => { colgados++; ok(); }, 4000);
    cdp.once('Emulation.virtualTimeBudgetExpired', () => { clearTimeout(reloj); ok(); });
    cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms });
  });

// ---------- Cuadros ----------
let cuadro = 0;
let fondoActivo = true;
const pad = (n, l = 4) => String(n).padStart(l, '0');
const pendientes = [];
let ultimo = Date.now();
async function siguienteCuadro() {
  if (fondoActivo) {
    const src = `/__fondo/${pad((cuadro % 480) + 1)}.jpg`;
    await p.evaluate(async (src) => {
      const i = document.getElementById('fondo-img');
      if (!i) return;
      i.src = src;
      await i.decode().catch(() => {});
    }, src);
  }
  await avanzar(DT);
  // Rescate: si la captura no responde en 5 s, se avanza 1 ms de reloj virtual y se reintenta
  let data;
  for (let intento = 0; !data; intento++) {
    const r = await Promise.race([
      cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true }),
      new Promise((ok) => setTimeout(() => ok(null), 5000)),
    ]);
    if (r) data = r.data;
    else {
      console.log(`  captura sin respuesta en el cuadro ${cuadro} (intento ${intento + 1})`);
      await avanzar(1);
    }
  }
  pendientes.push(writeFile(`${DIR}/cuadros/${pad(cuadro, 5)}.jpg`, Buffer.from(data, 'base64')));
  cuadro++;
  if (cuadro % 150 === 0) {
    const ahora = Date.now();
    console.log(`  ${cuadro} cuadros (${(cuadro / FPS).toFixed(0)} s de video) · ${((ahora - ultimo) / 150).toFixed(0)} ms/cuadro · avances sin señal: ${colgados}`);
    ultimo = ahora;
  }
}
const esperar = async (ms) => {
  for (let i = 0, n = Math.round(ms / DT); i < n; i++) await siguienteCuadro();
};

// ---------- Ratón / dedo ----------
let pos = [330 * ESC, 1000 * ESC];
let presionado = false;
const raton = (type, [x, y]) =>
  cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !presionado ? 'none' : 'left', buttons: presionado ? 1 : 0, clickCount: 1, pointerType: 'mouse' });
const suave = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const suave3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
async function moverDedo([x1, y1], ms = 700) {
  const [x0, y0] = pos;
  const n = Math.max(1, Math.round(ms / DT));
  for (let i = 1; i <= n; i++) {
    const e = suave(i / n);
    pos = [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
    await raton('mouseMoved', pos);
    await siguienteCuadro();
  }
}
const dedo = (v) => ev(`window.__dedo(${v})`);
async function bajar() { presionado = true; await raton('mousePressed', pos); }
async function subir() { presionado = false; await raton('mouseReleased', pos); }
async function centro(sel) {
  const c = await p.locator(sel).first().boundingBox();
  return [c.x + c.width / 2, c.y + c.height / 2];
}
async function tocar(sel) {
  await moverDedo(await centro(sel), 750);
  await esperar(250);
  await bajar();
  await esperar(170);
  await subir();
}
async function mantenerYMover(sel, ruta) {
  const [x, y] = await centro(sel);
  await moverDedo([x, y], 800);
  await esperar(250);
  await bajar();
  await esperar(1000); // se levanta con énfasis
  for (const [dx, dy, ms] of ruta) await moverDedo([x + dx * ESC, y + dy * ESC], ms);
  await esperar(450);
  await subir();
  await esperar(1200); // regresa a su lugar
}
/** Evalúa JS directo por CDP (con tiempo límite) */
async function ev(expresion) {
  const r = await Promise.race([
    cdp.send('Runtime.evaluate', { expression: expresion, returnByValue: true }),
    new Promise((ok) => setTimeout(() => ok(null), 5000)),
  ]);
  if (!r) console.log(`  evaluación sin respuesta en el cuadro ${cuadro}: ${expresion}`);
  return r?.result?.value;
}
async function desplazar(yFigma, ms) {
  const y0 = (await ev('scrollY')) ?? 0;
  const y1 = (yFigma + 28) * ESC; // +28 = --extra (aire bajo el título)
  const n = Math.round(ms / DT);
  for (let i = 1; i <= n; i++) {
    await ev(`scrollTo(0, ${Math.round(y0 + (y1 - y0) * suave3(i / n))})`);
    await siguienteCuadro();
  }
}

// ---------- Marcas para la edición ----------
const marcas = [];
async function marca(nombre, sel) {
  console.log(`  escena: ${nombre} (cuadro ${cuadro})`);
  const caja = sel ? await p.locator(sel).first().boundingBox() : null;
  marcas.push({ nombre, cuadro, caja });
}

// ---------- Guion ----------
await raton('mouseMoved', pos);
await marca('intro', '.sobre');
await esperar(2800);
await dedo(true);
await marca('tocar-sobre', '.sobre');
await tocar('.sobre');
await esperar(300);
await dedo(false);
await esperar(1900);
fondoActivo = false; // en móvil el fondo queda oculto tras abrir
await marca('portada');
await esperar(1500);
await marca('foto', '.polaroid >> nth=0');
await dedo(true);
await mantenerYMover('.polaroid >> nth=0', [[40, 90, 900], [-30, 150, 900]]);
await marca('sticker', '.galeria .sticker >> nth=1');
await mantenerYMover('.galeria .sticker >> nth=1', [[-120, 40, 900], [-150, -60, 800]]);
await dedo(false);
await esperar(300);
await marca('frase');
await desplazar(860, 1600);
await esperar(1500);
await marca('invitacion');
await desplazar(1240, 1500);
await esperar(2000);
await marca('fecha');
await desplazar(1715, 1500);
await esperar(2300);
await marca('lugar');
await desplazar(2090, 1400);
await esperar(900);
await marca('mapas', '.mapas');
await dedo(true);
await tocar('.mapas__boton--google');
await esperar(450);
await tocar('.mapas__boton--waze');
await esperar(450);
await dedo(false);
await marca('transporte');
await desplazar(2470, 1500);
await esperar(2500);
await marca('frase2');
await desplazar(3030, 1500);
await esperar(1400);
await marca('galeria2');
await desplazar(3330, 1300);
await esperar(600);
await dedo(true);
await mantenerYMover('.galeria >> nth=1 >> .polaroid >> nth=1', [[-60, -70, 900], [30, -110, 800]]);
await dedo(false);
await marca('cierre');
await desplazar(4450, 2600);
await esperar(2800);
await marca('fin');

await Promise.all(pendientes);
await b.close();
await writeFile(`${DIR}/marcas.json`, JSON.stringify({ fps: FPS, escala: ESC, ancho: W, alto: H, total: cuadro, marcas }, null, 1));
console.log(`${cuadro} cuadros = ${(cuadro / FPS).toFixed(1)} s a ${FPS} fps (${W}×${H})`);
