import { decodeSeed, encodeReplayQuery, parseReplayQuery, type ReplayLink } from './seed';

/**
 * Puente entre la semilla y la URL del navegador.
 *
 * Aquí, y solo aquí, aparece `window`. `seed.ts` es puro y esto es su único
 * consumidor, de modo que la lógica de la semilla se prueba sin jsdom y esta capa
 * se reduce a leer y escribir la barra de direcciones.
 */

/** Si la página se abrió con un enlace de partida, lo devuelve. Si no, `null`. */
export function readReplayLink(): ReplayLink | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return parseReplayQuery(window.location.search);
}

/** Si la página se abrió con una semilla suelta, la devuelve. Si no, `null`. */
export function readSeedOnly(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = new URLSearchParams(window.location.search).get('seed');
  return raw === null ? null : decodeSeed(raw);
}

/**
 * Monta el enlace completo que reproduce una partida.
 *
 * Esta función no toca `history`. La barra de direcciones se deja como está: si
 * la partida muerta metiera su enlace en la URL, recargar la página reventaría
 * la muerte en vez de empezar otra, y el jugador no ha pedido eso. El enlace sale
 * del botón de compartir, que es donde tiene sentido escribirlo, y se queda en un
 * `<details>` para poder leerlo aunque el portapapeles esté bloqueado.
 */
export function buildShareUrl(link: ReplayLink): string {
  const query = encodeReplayQuery(link);
  return `${window.location.origin}${window.location.pathname}?${query}`;
}
