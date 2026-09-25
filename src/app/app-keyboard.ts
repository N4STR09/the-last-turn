import { useEffect } from 'react';

import type { GameAction } from '../game';

const shortcutActions: Readonly<Record<string, GameAction>> = {
  b: 'forage',
  d: 'rest',
  e: 'explore',
  r: 'repair',
  p: 'fish',
  c: 'eat',
  '?': 'help',
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
