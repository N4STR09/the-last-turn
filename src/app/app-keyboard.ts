import { useEffect } from 'react';

import type { GameAction } from '../game';

/**
 * Atajos de las cinco acciones que gastan turnos.
 *
 * Cada tecla es la inicial de su verbo, y así se leen sin mirar: explorar, comer,
 * curar, descansar, reparar. Rendirse no tiene tecla: una decisión que borra la
 * partida no debería salir de una pulsación suelta que el jugador ni ha mirado.
 * Se confirma con un botón.
 */
const shortcutActions: Readonly<Record<string, GameAction>> = {
  e: 'explore',
  c: 'eat',
  s: 'cure',
  d: 'rest',
  r: 'repair',
};

const interactiveSelector =
  'input, textarea, select, button, a, [contenteditable]';

export function shortcutActionForKey(key: string): GameAction | null {
  return shortcutActions[key.toLowerCase()] ?? null;
}

/**
 * Las mismas teclas al revés: de acción a tecla, en mayúscula.
 *
 * Están escritas a mano y no derivadas del diccionario de arriba. Derivarlas pide
 * un `Object.fromEntries` con un `as const` dentro para que TypeScript no pierda
 * los tipos, y eso se lee peor que las cinco líneas que ahorra. Lo que impide que
 * las dos listas se separen no es la derivación: es que este `Record<GameAction,
 * string>` no compila si aparece una sexta acción sin tecla, y el test comprueba
 * que cada atajo del teclado tiene aquí su vuelta.
 *
 * Es un `Record` completo y no un `Partial`, así que en la hoja de reglas no hay
 * caso «sin atajo» que dibujar. Rendirse es la única que no tiene tecla, y
 * rendirse no es una acción de `GameAction`.
 */
const shortcutKeys: Readonly<Record<GameAction, string>> = {
  explore: 'E',
  eat: 'C',
  cure: 'S',
  rest: 'D',
  repair: 'R',
};

export function shortcutKeyForAction(action: GameAction): string {
  return shortcutKeys[action];
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }

  return target.closest(interactiveSelector) !== null;
}

export function useActionShortcuts(
  enabled: boolean,
  onAction: (action: GameAction) => void,
): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      const action = shortcutActionForKey(event.key);
      if (action === null) {
        return;
      }

      event.preventDefault();
      onAction(action);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onAction]);
}
