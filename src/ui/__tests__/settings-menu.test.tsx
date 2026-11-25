import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SettingsMenu,
  type SettingsControl,
} from '../components/SettingsMenu';
import { setMotionFast, setMotionReduced } from '../../app/motion';
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
    signedIn: false,
    open: vi.fn(),
    showRules: vi.fn(),
    openAccount: vi.fn(),
    close: vi.fn(),
    onAccountSessionChange: vi.fn(),
    ...overrides,
  };
}

function renderMenu(settings: SettingsControl) {
  return render(<SettingsMenu settings={settings} />);
}

afterEach(() => {
  // Los ajustes de movimiento son de la página entera y no del menú, así que
  // se quedan puestos en la raíz: se quitan aquí para que un test no arrastre
  // el suyo al siguiente.
  setMotionReduced(false);
  setMotionFast(false);
  vi.unstubAllEnvs();
});

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

  it('ofrece el movimiento reducido y lo aplica en la raíz', async () => {
    const user = userEvent.setup();
    renderMenu(createSettings({ overlay: 'settings' }));

    const toggle = screen.getByRole('button', { name: 'Movimiento reducido' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Movimiento reducido' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.classList.contains('motion-reduced')).toBe(
      true,
    );

    await user.click(
      screen.getByRole('button', { name: 'Movimiento reducido' }),
    );

    expect(
      screen.getByRole('button', { name: 'Movimiento reducido' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.classList.contains('motion-reduced')).toBe(
      false,
    );
  });

  it('ofrece la doble velocidad por separado del movimiento reducido', async () => {
    const user = userEvent.setup();
    renderMenu(createSettings({ overlay: 'settings' }));

    const toggle = screen.getByRole('button', { name: 'Velocidad x2' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Velocidad x2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.classList.contains('motion-fast')).toBe(
      true,
    );
    expect(document.documentElement.classList.contains('motion-reduced')).toBe(
      false,
    );
  });

  it('ofrece el perfil cuando hay alguien dentro', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    const user = userEvent.setup();
    const settings = createSettings({
      overlay: 'settings',
      signedIn: true,
    });
    renderMenu(settings);

    await user.click(screen.getByRole('button', { name: 'Perfil' }));

    expect(settings.openAccount).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
  });

  it('ofrece el inicio de sesión cuando no lo hay', () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    renderMenu(createSettings({ overlay: 'settings' }));

    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Perfil' })).toBeNull();
  });

  it('no ofrece la cuenta donde no la hay', () => {
    vi.stubEnv('VITE_ACCOUNTS', '');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    renderMenu(createSettings({ overlay: 'settings', signedIn: true }));

    expect(screen.queryByRole('button', { name: 'Perfil' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Iniciar sesión' }),
    ).toBeNull();
  });

  it('es un grupo etiquetado, para que el lector salte al panel entero', () => {
    renderMenu(createSettings({ overlay: 'settings' }));

    const panel = screen.getByRole('group', { name: 'Ajustes' });

    expect(panel).toHaveAttribute('id', 'settings-menu');
    expect(screen.getByText('Ajustes')).toHaveAttribute(
      'id',
      'settings-heading',
    );
  });

  it('no roba el foco al montar, que sigue en el encabezado de la pantalla', () => {
    renderMenu(createSettings());

    expect(screen.getByRole('button', { name: 'Ajustes' })).not.toHaveFocus();
  });

  it('devuelve el foco al engranaje cuando el menú se cierra', () => {
    const { rerender } = renderMenu(createSettings({ overlay: 'settings' }));
    // El foco queda en una entrada, como si se hubiera llegado con el
    // tabulador. Ese botón va a desaparecer con el panel.
    screen.getByRole('button', { name: 'Información' }).focus();

    rerender(<SettingsMenu settings={createSettings({ overlay: 'none' })} />);

    expect(screen.getByRole('button', { name: 'Ajustes' })).toHaveFocus();
  });

  it('devuelve el foco al engranaje al cerrar una hoja abierta desde el menú', () => {
    const { rerender } = renderMenu(createSettings({ overlay: 'rules' }));
    // El foco está dentro de la hoja, que es quien lo recibe al abrirse. La
    // hoja no la pinta este componente, así que se representa con un elemento
    // suelto que va a seguir existiendo al cerrar.
    const dentroDeLaHoja = document.createElement('button');
    document.body.append(dentroDeLaHoja);
    dentroDeLaHoja.focus();

    try {
      rerender(<SettingsMenu settings={createSettings({ overlay: 'none' })} />);

      expect(screen.getByRole('button', { name: 'Ajustes' })).toHaveFocus();
    } finally {
      dentroDeLaHoja.remove();
    }
  });

  it('no toca el foco al pasar de una capa a otra, que es de la siguiente', () => {
    const { rerender } = renderMenu(createSettings({ overlay: 'settings' }));

    rerender(<SettingsMenu settings={createSettings({ overlay: 'rules' })} />);

    // Quien recibe el foco al abrirse la hoja es la hoja, con su propio
    // efecto: si el menú se lo devolviera al engranaje, se lo quitaría.
    expect(screen.getByRole('button', { name: 'Ajustes' })).not.toHaveFocus();
  });
});
