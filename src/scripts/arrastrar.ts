// Fotos y stickers: mantener presionado 250 ms para levantarlos (crecen con énfasis) y moverlos;
// el scroll sigue normal. Todo queda dentro de su galería y, al soltarlo, vuelve de inmediato
// a su posición de Figma.
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

const PRESION_MS = 250;
const TOLERANCIA_PX = 10;
// Escala al levantar, para apreciar mejor la foto o el sticker
const ESCALA_FOTO = 1.3;
const ESCALA_STICKER = 1.35;

// Curva "Gentle" de Figma (resorte) muestreada, para el regreso a escala 1.
const MUESTRAS = [0, 0.101, 0.308, 0.528, 0.714, 0.852, 0.942, 0.995, 1.02, 1.028, 1.027, 1.021, 1.015, 1.01, 1.005, 1.002, 1, 1, 0.999, 0.999, 1];
const gentle = (t: number) => {
  const p = Math.min(Math.max(t, 0), 1) * (MUESTRAS.length - 1);
  const i = Math.floor(p);
  return i >= MUESTRAS.length - 1 ? 1 : MUESTRAS[i] + (MUESTRAS[i + 1] - MUESTRAS[i]) * (p - i);
};

const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

function alFrente(el: HTMLElement) {
  el.style.zIndex = String(++Draggable.zIndex);
}

/** Énfasis al levantar: crece con un pequeño rebote y se balancea una vez */
function levantar(el: HTMLElement, escala: number) {
  el.classList.add('levantada');
  el.style.willChange = 'transform';
  if (reducido) {
    gsap.to(el, { scale: escala, duration: 0.15, overwrite: 'auto' });
    return;
  }
  gsap.to(el, { scale: escala, duration: 0.45, ease: 'back.out(2.2)', overwrite: 'auto' });
  gsap.fromTo(
    el,
    { rotation: 0 },
    { keyframes: { rotation: [0, -4, 3, -1.5, 0] }, duration: 0.5, ease: 'sine.inOut', overwrite: 'auto' },
  );
}

function soltar(el: HTMLElement) {
  el.classList.remove('levantada');
  gsap.to(el, {
    scale: 1,
    duration: reducido ? 0.15 : 1.022,
    ease: reducido ? 'power2.out' : gentle,
    overwrite: 'auto',
  });
}

/** Regreso a la posición de Figma (x = y = 0) con la curva Gentle; luego recupera su capa original */
function regresar(el: HTMLElement) {
  gsap.to(el, {
    x: 0,
    y: 0,
    rotation: 0,
    duration: reducido ? 0.3 : 1.022,
    ease: reducido ? 'power2.out' : gentle,
    overwrite: 'auto',
    onComplete: () => {
      el.style.zIndex = '';
      el.style.willChange = '';
    },
  });
}

const comunes = (galeria: Element): Draggable.Vars => ({
  type: 'x,y',
  bounds: galeria,
  edgeResistance: 0.85,
  dragClickables: true,
  minimumMovement: 2,
});

/** La pista "Mantén presionado y mueve las fotos" se va tras el primer arrastre */
function ocultarPista() {
  document.querySelectorAll('.pista').forEach((p) => p.classList.add('oculta'));
}

/**
 * Fotos y stickers: se levantan solo con presión larga (250 ms sin moverse > 10 px).
 * Un toque o deslizamiento normal es scroll, así la página se recorre cómodamente.
 */
function hacerArrastrable(el: HTMLElement, galeria: Element) {
  const escala = el.classList.contains('sticker') ? ESCALA_STICKER : ESCALA_FOTO;
  let arrastrando = false;

  // Al soltar: vuelve a su tamaño y a su lugar al mismo tiempo
  const terminar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    d.disable();
    soltar(el);
    regresar(el);
  };

  const [d] = Draggable.create(el, {
    ...comunes(galeria),
    zIndexBoost: false,
    allowNativeTouchScrolling: false,
    onRelease: terminar,
  });
  d.disable();

  // Mientras la pieza está levantada se bloquea el scroll nativo (listener no pasivo).
  el.addEventListener(
    'touchmove',
    (e) => {
      if (arrastrando && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || arrastrando) return;
    const x0 = e.clientX;
    const y0 = e.clientY;

    const cancelar = () => {
      clearTimeout(t);
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', cancelar);
      removeEventListener('pointercancel', cancelar);
      removeEventListener('scroll', cancelar, true);
    };
    const mover = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > TOLERANCIA_PX) cancelar();
    };
    const t = setTimeout(() => {
      cancelar();
      // Si estaba regresando a su lugar, se detiene: la vuelve a tomar
      gsap.killTweensOf(el, 'x,y');
      arrastrando = true;
      alFrente(el);
      levantar(el, escala);
      ocultarPista();
      navigator.vibrate?.(10);
      d.enable();
      d.update(); // sincroniza x/y por si acaba de regresar a su lugar
      d.startDrag(e);
      // Si se suelta sin haber movido, Draggable puede no emitir onRelease
      addEventListener('pointerup', terminar, { once: true });
    }, PRESION_MS);

    addEventListener('pointermove', mover, { passive: true });
    addEventListener('pointerup', cancelar);
    addEventListener('pointercancel', cancelar);
    addEventListener('scroll', cancelar, { capture: true, passive: true });
  });
}

export function iniciar() {
  for (const galeria of document.querySelectorAll('.galeria')) {
    for (const el of galeria.querySelectorAll<HTMLElement>('.arrastrable')) hacerArrastrable(el, galeria);
  }
}
