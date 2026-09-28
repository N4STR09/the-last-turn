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
    ['e', 'explore'],
    ['c', 'eat'],
    ['s', 'cure'],
    ['d', 'rest'],
    ['r', 'repair'],
  ] as const)('mapea la tecla %s a %s', (key, action) => {
    expect(shortcutActionForKey(key)).toBe(action);
  });

  it('no deja ningún atajo para rendirse ni para la ayuda que ya no existe', () => {
    // Rendirse termina la partida, así que va con confirmación y con el ratón:
    // un atajo de una sola tecla sería una derrota por accidente. Y la ayuda no
    // queda mapeada: '?' ya no significa nada y no puede quedar con mapeo.
    // 'b' y 'p' son las teclas que sobraron al quitar forraje y pesca, y tienen
    // que seguir libres para que no sean una pulsación a la nada.
    expect(shortcutActionForKey('?')).toBeNull();
    expect(shortcutActionForKey('h')).toBeNull();
    expect(shortcutActionForKey('b')).toBeNull();
    expect(shortcutActionForKey('p')).toBeNull();
    expect(shortcutActionForKey('Enter')).toBeNull();
  });

  it('activa la acción para una tecla sin modificadores', () => {
    const onAction = vi.fn();
    render(<ShortcutHarness enabled onAction={onAction} />);

    fireEvent.keyDown(document, { key: 'e' });

    expect(onAction).toHaveBeenCalledWith('explore');
  });

  it.each([
    [{ key: 'e', repeat: true }],
    [{ key: 'e', ctrlKey: true }],
    [{ key: 'e', altKey: true }],
    [{ key: 'e', metaKey: true }],
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

      fireEvent.keyDown(element, { key: 'e' });

      expect(onAction).not.toHaveBeenCalled();
    },
  );

  it('ignora los atajos cuando la pantalla no está jugando', () => {
    const onAction = vi.fn();
    render(<ShortcutHarness enabled={false} onAction={onAction} />);

    fireEvent.keyDown(document, { key: 'e' });

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
