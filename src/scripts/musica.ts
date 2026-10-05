// Música de fondo. Debe iniciarse dentro del toque al sobre (gesto del usuario), si no el
// navegador la bloquea. Se pausa al salir de la pestaña / bloquear el teléfono y se retoma al volver.
const audio = document.getElementById('musica') as HTMLAudioElement | null;
const boton = document.getElementById('boton-musica') as HTMLButtonElement | null;

let quiereMusica = false; // la invitada no la ha silenciado

function actualizarBoton() {
  if (!boton) return;
  boton.setAttribute('aria-pressed', String(quiereMusica));
  boton.setAttribute('aria-label', quiereMusica ? 'Silenciar música' : 'Activar música');
}

function reproducir() {
  if (!audio) return;
  audio.play().catch(() => {
    // Bloqueada (p. ej. sin gesto): se muestra como silenciada para que la active con el botón
    quiereMusica = false;
    actualizarBoton();
  });
}

/** Llamar dentro del manejador del toque al sobre */
export function iniciarMusica() {
  if (!audio || quiereMusica) return;
  quiereMusica = true;
  actualizarBoton();
  reproducir();
}

/** Muestra el botón (cuando ya se ve la invitación) */
export function mostrarBotonMusica() {
  if (!boton) return;
  boton.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => boton.classList.add('visible')));
}

boton?.addEventListener('click', () => {
  quiereMusica = !quiereMusica;
  actualizarBoton();
  if (quiereMusica) reproducir();
  else audio?.pause();
});

document.addEventListener('visibilitychange', () => {
  if (!audio || !quiereMusica) return;
  if (document.hidden) audio.pause();
  else reproducir();
});
