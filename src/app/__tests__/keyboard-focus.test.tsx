import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  shortcutActionForKey,
  useActionShortcuts,
} from '../app-keyboard';
import { useScreenFocus } from '../screen-focus';
import type { GameAction } from '../../game';

function ShortcutHarness({
  enabled,
  onAction,
}: {
  readonly enabled: boolean;
  readonly onAction: (action: GameAction) => void;
}) {
  useActionShortcuts(enabled, onAction);

  return (
    <div>
      <h1>Partida</h1>
      <button type="button">Botón</button>
      <input aria-label="Campo" />
      <a href="#destino">Enlace</a>
    </div>
  );
}

function FocusHarness({ screen }: { readonly screen: 'start' | 'playing' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useScreenFocus(screen, containerRef);

  return (
    <div ref={containerRef}>
      <h1 tabIndex={-1}>{screen}</h1>
    </div>
  );
}

describe('useActionShortcuts', () => {
  it.each([
    ['b', 'forage'],
    ['d', 'rest'],
    ['e', 'explore'],
    ['r', 'repair'],
    ['p', 'fish'],
    ['c', 'eat'],
    ['?', 'help'],
  ] as const)('mapea la tecla %s a %s', (key, action) => {
    expect(shortcutActionForKey(key)).toBe(action);
  });

  it('activa la acción para una tecla sin modificadores', () => {
    const onAction = vi.fn();
    render(<ShortcutHarness enabled onAction={onAction} />);

    fireEvent.keyDown(document, { key: 'b' });

    expect(onAction).toHaveBeenCalledWith('forage');
  });

  it.each([
    [{ key: 'b', repeat: true }],
    [{ key: 'b', ctrlKey: true }],
    [{ key: 'b', altKey: true }],
    [{ key: 'b', metaKey: true }],
  ])('ignora repetición o modificadores: %o', (eventInit) => {
    const onAction = vi.fn();
    render(<ShortcutHarness enabled onAction={onAction} />);

    fireEvent.keyDown(document, eventInit);

    expect(onAction).not.toHaveBeenCalled();
  });

  it.each(['button', 'input', 'a']) (
    'ignora una tecla emanating de un control interactivo (%s)',
    (elementRole) => {
      const onAction = vi.fn();
      render(<ShortcutHarness enabled onAction={onAction} />);
      const element =
        elementRole === 'button'
          ? screen.getByRole('button')
          : elementRole === 'input'
            ? screen.getByRole('textbox')
            : screen.getByRole('link');

      fireEvent.keyDown(element, { key: 'b' });

      expect(onAction).not.toHaveBeenCalled();
    },
  );

  it('ignora los atajos cuando la pantalla no está jugando', () => {
    const onAction = vi.fn();
    render(<ShortcutHarness enabled={false} onAction={onAction} />);

    fireEvent.keyDown(document, { key: 'b' });

    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('useScreenFocus', () => {
  it('enfoca el encabezado al entrar y cambiar de pantalla', () => {
    const { rerender } = render(<FocusHarness screen="start" />);

    expect(screen.getByRole('heading', { name: 'start' })).toHaveFocus();

    rerender(<FocusHarness screen="playing" />);

    expect(screen.getByRole('heading', { name: 'playing' })).toHaveFocus();
  });
});
