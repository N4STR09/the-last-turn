import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GameOverScreen } from '../screens/GameOverScreen';
import type { GameOverViewModel } from '../view-models/ui-types';

const model: GameOverViewModel = {
  difficulty: 'agony',
  reportedCause: 'hunger',
  turnsSurvived: 7,
};

describe('GameOverScreen', () => {
  it('presenta la derrota con la causa comunicada y los turnos', () => {
    render(<GameOverScreen model={model} onRestart={vi.fn()} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    );
    expect(screen.getByText('7 turnos aguantados')).toBeInTheDocument();
    expect(screen.getByText('Agonía')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Volver a jugar' }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      'hunger',
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    ],
    [
      'energy',
      'El cuerpo cedió al agotamiento. Cada paso fue el último.',
    ],
    [
      'health',
      'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
    ],
  ] as const)('traduce la causa comunicada %s', (reportedCause, message) => {
    render(
      <GameOverScreen
        model={{ ...model, reportedCause }}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('usa el singular para una partida de un turno', () => {
    render(
      <GameOverScreen
        model={{ ...model, turnsSurvived: 1 }}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText('1 turno aguantado')).toBeInTheDocument();
  });

  it('reinicia mediante un único callback', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(<GameOverScreen model={model} onRestart={onRestart} />);

    await user.click(
      screen.getByRole('button', { name: 'Volver a jugar' }),
    );

    expect(onRestart).toHaveBeenCalledOnce();
  });
});
