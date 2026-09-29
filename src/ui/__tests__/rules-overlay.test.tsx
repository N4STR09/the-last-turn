import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RulesOverlay } from '../components/RulesOverlay';
import type { RulesViewModel } from '../view-models/ui-types';

const model: RulesViewModel = {
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
    {
      id: 'repair',
      label: 'Reparar',
      cost: '(+2 hambre, −2 energía)',
      shortcut: 'R',
      effect: 'Levanta el refugio.',
    },
  ],
  sections: [
    { title: 'Cada turno', lines: ['Cuesta hambre.', 'Cuesta energía.'] },
    { title: 'La semilla', lines: ['Puedes verla en Ajustes.'] },
  ],
};

function renderOverlay(onClose = vi.fn()) {
  return {
    onClose,
    ...render(<RulesOverlay model={model} onClose={onClose} />),
  };
}

describe('RulesOverlay', () => {
  it('es un diálogo modal con nombre y enseña la hoja entera', () => {
    const { container } = renderOverlay();

    const dialog = screen.getByRole('dialog', { name: model.title });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(model.lead)).toBeInTheDocument();
    expect(
      within(dialog).getByText(model.actionsTitle),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Explorar')).toBeInTheDocument();
    expect(within(dialog).getByText('(+1 hambre, −1 energía)')).toBeInTheDocument();
    expect(
      within(dialog).getByText('La única forma de conseguir comida.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Cada turno')).toBeInTheDocument();
    expect(within(dialog).getByText('Cuesta energía.')).toBeInTheDocument();
    expect(within(dialog).getByText('La semilla')).toBeInTheDocument();
    expect(within(dialog).getByText('Puedes verla en Ajustes.')).toBeInTheDocument();

    // Las teclas van en `kbd`, que es lo que las anuncia como teclas.
    expect(within(dialog).getByText('E').tagName).toBe('KBD');
    expect(within(dialog).getByText('R').tagName).toBe('KBD');

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(container.querySelectorAll('.rules-action')).toHaveLength(2);
  });

  it('recibe el foco al abrirse, para que el teclado empiece dentro', () => {
    renderOverlay();

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('cierra con su botón', async () => {
    const user = userEvent.setup();
    const { onClose } = renderOverlay();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra con Escape', () => {
    const { onClose } = renderOverlay();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra con un click fuera y no con uno dentro', () => {
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
    const { onClose } = renderOverlay();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('no deja que el tabulador se salga del diálogo', () => {
    renderOverlay();

    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Cerrar' });

    // Desde el último botón, el tabulador vuelve al primero.
    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();

    // Desde el propio diálogo, Mayús+Tabulador va al último.
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
  });

  it('deja salir al tabulador cuando el foco no está dentro', () => {
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
});
