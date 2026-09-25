import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EscalationOverlay } from '../components/EscalationOverlay';
import type { ThreatNoticeViewModel } from '../view-models/ui-types';

function createModel(
  overrides: Partial<ThreatNoticeViewModel> = {},
): ThreatNoticeViewModel {
  return {
    threat: 2,
    load: 2,
    level: 'Nivel de amenaza 2',
    message: 'Se acabó la tregua. Nadie te va a avisar cuando pare.',
    hint: 'Haz click para continuar...',
    ...overrides,
  };
}

describe('EscalationOverlay', () => {
  it('se presenta como diálogo modal etiquetado por el mensaje', () => {
    render(
      <EscalationOverlay model={createModel()} onContinue={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Se acabó la tregua. Nadie te va a avisar cuando pare.',
    });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('muestra el nivel, el mensaje y la pista de continuación', () => {
    render(
      <EscalationOverlay model={createModel()} onContinue={vi.fn()} />,
    );

    expect(screen.getByText('Nivel de amenaza 2')).toBeInTheDocument();
    expect(
      screen.getByText('Haz click para continuar...'),
    ).toBeInTheDocument();
  });

  it('mueve el foco al diálogo al abrirse', () => {
    render(
      <EscalationOverlay model={createModel()} onContinue={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('continúa con un click en el fondo', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const { container } = render(
      <EscalationOverlay model={createModel()} onContinue={onContinue} />,
    );

    await user.click(container.querySelector('.escalation-overlay')!);

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('continúa con un click dentro del propio diálogo', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<EscalationOverlay model={createModel()} onContinue={onContinue} />);

    await user.click(screen.getByText('Nivel de amenaza 2'));

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it.each(['{Enter}', ' '])('continúa con la tecla %s', async (key) => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<EscalationOverlay model={createModel()} onContinue={onContinue} />);

    await user.keyboard(key);

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('ignora el resto de teclas para que no ejecuten acciones', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<EscalationOverlay model={createModel()} onContinue={onContinue} />);

    await user.keyboard('bdrpec?');

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('expone el nivel en el atributo data para pruebas y estilos', () => {
    const { container } = render(
      <EscalationOverlay model={createModel()} onContinue={vi.fn()} />,
    );

    expect(
      container.querySelector('.escalation-overlay'),
    ).toHaveAttribute('data-threat', '2');
  });

  it('retira el listener al desmontarse', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const { unmount } = render(
      <EscalationOverlay model={createModel()} onContinue={onContinue} />,
    );

    unmount();
    await user.keyboard('{Enter}');

    expect(onContinue).not.toHaveBeenCalled();
  });
});
