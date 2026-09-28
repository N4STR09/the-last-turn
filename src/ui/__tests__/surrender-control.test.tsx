import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  SurrenderControl,
  type SurrenderControl as Surrender,
} from '../components/SurrenderControl';

function createSurrender(overrides: Partial<Surrender> = {}): Surrender {
  return {
    pending: false,
    ask: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    ...overrides,
  };
}

function renderControl(surrender: Surrender) {
  return render(<SurrenderControl surrender={surrender} />);
}

describe('SurrenderControl', () => {
  it('ofrece rendirse con su coste en la partida, sin acción de juego', async () => {
    const user = userEvent.setup();
    const surrender = createSurrender();
    renderControl(surrender);

    const button = screen.getByRole('button', { name: /Rendirse/ });

    expect(button).toHaveTextContent('(te lleva la partida)');
    await user.click(button);

    expect(surrender.ask).toHaveBeenCalledOnce();
  });

  it('no muestra nada hasta que se pide la confirmación', () => {
    renderControl(createSurrender());

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Rendirse/ })).toBeVisible();
  });

  it('pregunta si de verdad y explica lo que se pierde', () => {
    renderControl(createSurrender({ pending: true }));

    const dialog = screen.getByRole('dialog', { name: /¿Seguro que te rindes?/ });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(
      'Se acabó. El refugio se queda sin nadie que lo mantenga y la partida termina aquí, con el turno que llevas.',
    );
  });

  it('pone el foco en el diálogo al abrirlo', () => {
    renderControl(createSurrender({ pending: true }));

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('rinde al confirmar y se queda al cancelar', async () => {
    const user = userEvent.setup();
    const surrender = createSurrender({ pending: true });
    renderControl(surrender);

    await user.click(screen.getByRole('button', { name: 'Seguir jugando' }));
    expect(surrender.cancel).toHaveBeenCalledOnce();
    expect(surrender.confirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Rendirme' }));
    expect(surrender.confirm).toHaveBeenCalledOnce();
  });

  it('cancela con Escape, que es la vía para arrepentirse', async () => {
    const user = userEvent.setup();
    const surrender = createSurrender({ pending: true });
    renderControl(surrender);

    await user.keyboard('{Escape}');

    expect(surrender.cancel).toHaveBeenCalledOnce();
    expect(surrender.confirm).not.toHaveBeenCalled();
  });

  it('no se rinde por pulsar fuera del diálogo', async () => {
    const user = userEvent.setup();
    const surrender = createSurrender({ pending: true });
    const { container } = renderControl(surrender);

    // Una confirmación de derrota no se acepta por errar el ratón: el click
    // fuera no hace nada, ni siquiera cerrar.
    await user.click(container.querySelector('.surrender-overlay')!);

    expect(surrender.confirm).not.toHaveBeenCalled();
    expect(surrender.cancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('mantiene el foco dentro del diálogo al tabular en bucle', async () => {
    const user = userEvent.setup();
    renderControl(createSurrender({ pending: true }));

    const follow = screen.getByRole('button', { name: 'Seguir jugando' });
    const giveUp = screen.getByRole('button', { name: 'Rendirme' });

    await user.tab();
    expect(follow).toHaveFocus();
    await user.tab();
    expect(giveUp).toHaveFocus();
    // Del último botón vuelve al primero: la partida de detrás no se alcanza.
    await user.tab();
    expect(follow).toHaveFocus();
    // Y al revés, del primero al último.
    await user.tab({ shift: true });
    expect(giveUp).toHaveFocus();
  });

  it('deja que Shift+Tab desde el diálogo entre por el borde que le toca', async () => {
    const user = userEvent.setup();
    renderControl(createSurrender({ pending: true }));

    // Al abrirse el foco está en el diálogo, no en un botón. Hacia delante
    // entra por el primero, y hacia atrás por el último.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Seguir jugando' })).toHaveFocus();

    screen.getByRole('dialog').focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Rendirme' })).toHaveFocus();
  });

  it('devuelve el foco al botón al cerrar la confirmación', () => {
    const surrender = createSurrender();
    const { rerender } = renderControl(surrender);

    const trigger = screen.getByRole('button', { name: /Rendirse/ });
    // Al montar no se lo quita a nadie: el foco lo lleva la pantalla.
    expect(trigger).not.toHaveFocus();

    rerender(<SurrenderControl surrender={{ ...surrender, pending: true }} />);
    rerender(<SurrenderControl surrender={surrender} />);

    expect(trigger).toHaveFocus();
  });

  it('ignora teclas que no son Escape ni tabulador', async () => {
    const user = userEvent.setup();
    const surrender = createSurrender({ pending: true });
    renderControl(surrender);

    await user.keyboard('{Enter}');

    expect(surrender.cancel).not.toHaveBeenCalled();
    expect(surrender.confirm).not.toHaveBeenCalled();
  });
});
