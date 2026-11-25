import { useSyncExternalStore } from 'react';

/**
 * El movimiento, a mano.
 *
 * La interfaz ya respeta `prefers-reduced-motion` en su hoja de estilos, y eso
 * sigue siendo lo primero: quien lo pide en el sistema no tiene que volver a
 * pedirlo dentro del juego. Esto es lo contrario, para quien no lo ha pedido
 * allí —o para quien quiere lo contrario, la doble velocidad—, y vive en un
 * ajuste del menú de ajustes.
 *
 * Los dos ajustes se guardan aquí y no en el estado de la partida porque no son
 * de la partida: no cambian qué se pinta del tablero, cambia cómo se mueve, y
 * una partida guardada no debería arrastrar consigo el gusto de quien la jugó.
 * Tampoco se guardan en el menú, que se desmonta al salir de la pantalla:
 * preferir movimiento reducido no es algo que deba reponerse cada vez que se
 * muere. Vive en memoria y se pierde al recargar, igual que el resto de la
 * sesión —no se añade Web Storage por dos ajustes—.
 *
 * Lo que se aplica son dos clases en `<html>`, no reglas leídas desde
 * JavaScript: la hoja de estilos es quien sabe qué es "sin movimiento" y quién
 * decide cómo se ven las barras al doble de velocidad, y duplicar esa lista
 * aquí la haría crecer por dos sitios. La raíz además alcanza a todo el
 * documento, incluidos los diálogos, que es donde más se notan los tirones.
 */

export interface MotionPreferences {
  /** Movimiento reducido pedido en el menú, además del que diga el sistema. */
  readonly reduced: boolean;
  /** Doble velocidad para las animaciones y las transiciones. */
  readonly fast: boolean;
}

let current: MotionPreferences = { reduced: false, fast: false };
const listeners = new Set<() => void>();

/**
 * Las preferencias de ahora, con su clase puesta en la raíz.
 *
 * El objeto solo cambia de referencia cuando cambia algo de verdad: es lo que
 * hace que `useSyncExternalStore` no vuelva a pintar por cada notificación.
 */
function apply(next: MotionPreferences): void {
  if (next.reduced === current.reduced && next.fast === current.fast) {
    return;
  }

  current = next;
  document.documentElement.classList.toggle('motion-reduced', next.reduced);
  document.documentElement.classList.toggle('motion-fast', next.fast);
  for (const listener of listeners) {
    listener();
  }
}

/** Las preferencias actuales. */
export function motionPreferences(): MotionPreferences {
  return current;
}

/** Se suscribe a los cambios y devuelve la baja. */
export function subscribeMotionPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pide o quita el movimiento reducido. */
export function setMotionReduced(reduced: boolean): void {
  apply({ ...current, reduced });
}

/** Pide o quita la doble velocidad. */
export function setMotionFast(fast: boolean): void {
  apply({ ...current, fast });
}

/**
 * Las preferencias, siguiéndolas desde el pintado.
 *
 * El tercer argumento es el de servidores, que aquí no hay: se pasa el mismo
 * lector por si algún día se renderiza antes de montar, para que la respuesta
 * sea la misma antes y después en vez de una excepción.
 */
export function useMotionPreferences(): MotionPreferences {
  return useSyncExternalStore(
    subscribeMotionPreferences,
    motionPreferences,
    motionPreferences,
  );
}
