// Cloudflare Pages Function: sirve /medios/* (video de fondo y música) con soporte de rangos.
// Safari en iPhone solo reproduce audio/video si el servidor responde por partes (206 Partial
// Content); los archivos estáticos de Pages responden siempre completos (200), por eso esta función.
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  // Archivo original desde los estáticos del sitio
  const original = await env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
  if (!original.ok) return original;
  const datos = await original.arrayBuffer();
  const total = datos.byteLength;

  const headers = new Headers({
    'Content-Type': original.headers.get('Content-Type') ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=604800',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  const cuerpo = (b) => (request.method === 'HEAD' ? null : b);

  const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') ?? '');
  if (!rango || (rango[1] === '' && rango[2] === '')) {
    headers.set('Content-Length', String(total));
    return new Response(cuerpo(datos), { status: 200, headers });
  }

  // bytes=a-b · bytes=a- · bytes=-n (últimos n)
  let inicio, fin;
  if (rango[1] === '') {
    inicio = Math.max(0, total - Number(rango[2]));
    fin = total - 1;
  } else {
    inicio = Number(rango[1]);
    fin = rango[2] === '' ? total - 1 : Math.min(Number(rango[2]), total - 1);
  }
  if (inicio >= total || inicio > fin) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }

  headers.set('Content-Range', `bytes ${inicio}-${fin}/${total}`);
  headers.set('Content-Length', String(fin - inicio + 1));
  return new Response(cuerpo(datos.slice(inicio, fin + 1)), { status: 206, headers });
}
