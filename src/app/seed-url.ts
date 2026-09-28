import {
  decodeSeed,
  encodeReplayQuery,
  isReplayLink,
  parseReplayQuery,
  type ReplayLink,
} from './seed';

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
 * Escribe una partida en la barra de direcciones sin recargar y devuelve el
 * enlace completo, para poder copiarlo o compartirlo.
 *
 * `replaceState` y no `pushState`: cambiar de semilla es cambiar la partida que
 * se está jugando, no navegar a otra página, así que el botón de atrás del
 * navegador no debería deshacer el juego turno a turno.
 */
export function writeReplayLink(link: ReplayLink): string {
  const query = encodeReplayQuery(link);

  if (typeof window !== 'undefined' && window.history !== undefined) {
    window.history.replaceState(null, '', `?${query}`);
  }

  return `${window.location.origin}${window.location.pathname}?${query}`;
}

/** Si la URL actual es un enlace de partida reproducible y no solo una semilla. */
export function currentLinkIsReplay(): boolean {
  return isReplayLink(readReplayLink());
}
