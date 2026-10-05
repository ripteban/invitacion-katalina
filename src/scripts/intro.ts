// Secuencia del prototipo de Figma:
// 1. Clic en el sobre → Variant2 con Smart Animate "Gentle" (1022 ms)
// 2. After delay 0.1 s → navegar a Home con Dissolve Ease Out (300 ms)
// Además: la música empieza con ese mismo toque (único momento en que el navegador lo permite).
import { iniciarMusica, mostrarBotonMusica } from './musica';

const intro = document.getElementById('intro');
const home = document.getElementById('home');
const sobre = intro?.querySelector<HTMLButtonElement>('.sobre');

const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T_ABRIR = reducido ? 300 : 1022;
const T_ESPERA = 100;
const T_DISOLVER = 300;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function abrir() {
  if (!intro || !home || !sobre || intro.classList.contains('abriendo')) return;
  sobre.disabled = true;
  intro.classList.add('abriendo');
  iniciarMusica(); // dentro del gesto: si no, Safari/Chrome bloquean el sonido
  intentarVideo();

  // Se carga el arrastre mientras corre la animación (no afecta la intro).
  const arrastre = import('./arrastrar');

  setTimeout(() => {
    window.scrollTo(0, 0);
    home.classList.add('visible');
    home.removeAttribute('inert');

    setTimeout(() => {
      intro.remove();
      document.body.classList.remove('bloqueado');
      fondoSegunPantalla();
      home.focus({ preventScroll: true });
      mostrarBotonMusica();
      arrastre.then((m) => m.iniciar());
    }, T_DISOLVER);
  }, T_ABRIR + T_ESPERA);
}

sobre?.addEventListener('click', abrir);

// Video de fondo: autoplay silenciado. En iPhone con "Ahorro de batería" Safari bloquea todo
// autoplay; en ese caso arranca con el primer toque en la pantalla.
const videoFondo = document.querySelector<HTMLVideoElement>('#fondo video');
function intentarVideo() {
  if (!videoFondo || !videoFondo.paused || !document.getElementById('intro')) return;
  videoFondo.muted = true;
  videoFondo.play().catch(() => {});
}
intentarVideo();
for (const evento of ['touchstart', 'pointerdown'] as const) {
  addEventListener(evento, intentarVideo, { once: true, passive: true });
}

// En móvil la invitación cubre toda la pantalla: el video de fondo se pausa para ahorrar batería.
// En tablet/escritorio sigue visible a los lados (también si se gira el teléfono).
const pantallaAncha = matchMedia('(min-width: 600px)');
function fondoSegunPantalla() {
  const video = document.querySelector<HTMLVideoElement>('#fondo video');
  if (!video || document.getElementById('intro')) return;
  if (pantallaAncha.matches) video.play().catch(() => {});
  else video.pause();
}
pantallaAncha.addEventListener('change', fondoSegunPantalla);
