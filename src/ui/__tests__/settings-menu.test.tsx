import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  SettingsMenu,
  type SettingsControl,
} from '../components/SettingsMenu';
import type { RulesViewModel } from '../view-models/ui-types';

const rules: RulesViewModel = {
  title: 'Cómo se juega',
  lead: 'Nunca se gana: se aguanta.',
  actionsTitle: 'Las cinco acciones',
  actions: [
    {
      id: 'explore',
      label: 'Explorar',
      cost: '(+1 hambre, −1 energía)',
      shortcut: 'E',
      effect: 'La única forma de conseguir comida.',
    },
  ],
  sections: [{ title: 'Cada turno', lines: ['Cuesta hambre y energía.'] }],
};

function createSettings(
  overrides: Partial<SettingsControl> = {},
): SettingsControl {
  return {
    overlay: 'none',
    seedLabel: 'K3F9Z',
    rules,
    open: vi.fn(),
    showRules: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

function renderMenu(settings: SettingsControl) {
  return render(<SettingsMenu settings={settings} />);
}

describe('SettingsMenu', () => {
  it('deja el engranaje a la vista y el menú cerrado', () => {
    renderMenu(createSettings());

    expect(screen.getByRole('button', { name: 'Ajustes' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Ajustes')).toBeNull();
  });

  it('pide abrir el menú al pulsar el engranaje', async () => {
    const user = userEvent.setup();
    const settings = createSettings();
    renderMenu(settings);

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));

    expect(settings.open).toHaveBeenCalledOnce();
    expect(settings.close).not.toHaveBeenCalled();
  });

  it('vuelve a cerrarlo con el mismo botón', async () => {
    const user = userEvent.setup();
    const settings = createSettings({ overlay: 'settings' });
    renderMenu(settings);

    const toggle = screen.getByRole('button', { name: 'Ajustes' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);

    expect(settings.close).toHaveBeenCalledOnce();
    expect(settings.open).not.toHaveBeenCalled();
  });

  it('ofrece las dos opciones y pide la ayuda', async () => {
    const user = userEvent.setup();
    const settings = createSettings({ overlay: 'settings' });
    renderMenu(settings);

    expect(screen.getByText('Ajustes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Información' }));

    expect(settings.showRules).toHaveBeenCalledOnce();
  });

  it('no enseña la semilla hasta que se pide', async () => {
    const user = userEvent.setup();
    renderMenu(createSettings({ overlay: 'settings' }));

    expect(screen.queryByText('K3F9Z')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Mostrar la semilla' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(screen.getByText('K3F9Z')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ocultar la semilla' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('vuelve a esconderla con el mismo botón', async () => {
    const user = userEvent.setup();
    renderMenu(createSettings({ overlay: 'settings' }));

    await user.click(screen.getByRole('button', { name: 'Mostrar la semilla' }));
    await user.click(screen.getByRole('button', { name: 'Ocultar la semilla' }));

    expect(screen.queryByText('K3F9Z')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mostrar la semilla' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('cierra con Escape, y solo cuando hay algo que cerrar', () => {
    const open = createSettings({ overlay: 'settings' });
    const closed = createSettings();
    const { unmount } = renderMenu(open);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Ajustes' }), {
      key: 'Escape',
    });
    expect(open.close).toHaveBeenCalledOnce();

    unmount();
    renderMenu(closed);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ajustes' }), {
      key: 'Escape',
    });
    expect(closed.close).not.toHaveBeenCalled();
  });

  it('no cierra con una tecla que no sea Escape', () => {
    const settings = createSettings({ overlay: 'settings' });
    renderMenu(settings);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Ajustes' }), {
      key: 'Enter',
    });

    expect(settings.close).not.toHaveBeenCalled();
  });
});
