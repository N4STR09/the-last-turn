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
