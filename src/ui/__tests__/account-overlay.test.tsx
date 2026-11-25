import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountOverlay } from '../components/AccountOverlay';

const CORREO = 'alguien@example.com';

function cuerpo(valor: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => valor,
  } as unknown as Response;
}

/** El panel pregunta por la sesión; el resto de consultas contestan sin nada. */
function conSesion(sesion: unknown): void {
  vi.stubGlobal(
    'fetch',
    async (input: unknown) =>
      String(input) === '/api/auth/session'
        ? cuerpo(sesion)
        : cuerpo({ autenticado: false }),
  );
}

/**
 * Cuentas puestas o quitadas para el test, sin depender de lo que haya dejado
 * otro archivo: `accountsEnabled` se lee en cada render y un despliegue de
 * pruebas no tiene por qué parecerse al que venga después.
 */
function cuentas(disponibles: boolean): void {
  vi.stubEnv('VITE_ACCOUNTS', disponibles ? '1' : '');
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
}

function renderOverlay(
  onClose = vi.fn(),
  onSessionChange?: (autenticado: boolean) => void,
) {
  return {
    onClose,
    ...render(
      <AccountOverlay onClose={onClose} onSessionChange={onSessionChange} />,
    ),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AccountOverlay', () => {
  it('es un diálogo modal con nombre y su marco de hoja', () => {
    cuentas(false);
    renderOverlay();

    const dialog = screen.getByRole('dialog', { name: 'Cuenta' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    // Sin cuentas el panel no pinta nada, pero la hoja sigue teniendo salida:
    // un despliegue que no las tiene no debe quedar con la puerta abierta.
    expect(screen.queryByLabelText('Correo')).toBeNull();
  });

  it('recibe el foco al abrirse, para que el teclado empiece dentro', () => {
    cuentas(false);
    renderOverlay();

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('cierra con su botón', async () => {
    cuentas(false);
    const user = userEvent.setup();
    const { onClose } = renderOverlay();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra con Escape', () => {
    cuentas(false);
    const { onClose } = renderOverlay();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra con un click fuera y no con uno dentro', () => {
    cuentas(false);
    const { onClose } = renderOverlay();
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;

    // Un click en un hueco de la hoja sube hasta el fondo, así que el fondo
    // distingue por el objetivo y no por haber recibido el evento.
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('no cierra con otra tecla', () => {
    cuentas(false);
    const { onClose } = renderOverlay();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('no deja que el tabulador se salga del diálogo', () => {
    cuentas(false);
    renderOverlay();

    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Cerrar' });

    // Desde el único botón, el tabulador vuelve al propio botón.
    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();

    // Desde el propio diálogo, Mayús+Tabulador va al último.
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
  });

  it('deja salir al tabulador cuando el foco no está dentro', () => {
    cuentas(false);
    renderOverlay();

    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Cerrar' });

    // Con el foco en el diálogo, Tabulador no da la vuelta: no está en un borde.
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).not.toHaveFocus();

    // Y con el foco fuera del todo, tampoco: perder el foco se recupera, y
    // atraparlo en un diálogo sin salida no.
    close.focus();
    close.blur();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).not.toHaveFocus();
  });

  it('enseña el acceso de la cuenta dentro de la hoja', async () => {
    cuentas(true);
    conSesion({ autenticado: false });
    renderOverlay();

    expect(
      await screen.findByRole('button', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
  });

  it('reenvía el aviso de que hay alguien dentro', async () => {
    cuentas(true);
    conSesion({ autenticado: true, email: CORREO });
    const avisos: boolean[] = [];
    renderOverlay(vi.fn(), (aviso) => avisos.push(aviso));

    await screen.findByText(CORREO);

    expect(avisos).toEqual([true]);
  });

  it('reenvía también el aviso de que no lo hay', async () => {
    cuentas(true);
    conSesion({ autenticado: false });
    const avisos: boolean[] = [];
    renderOverlay(vi.fn(), (aviso) => avisos.push(aviso));

    await screen.findByRole('button', { name: 'Entrar' });

    expect(avisos).toEqual([false]);
  });
});
