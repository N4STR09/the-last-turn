import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DifficultyScreen } from '../../ui/screens/DifficultyScreen';
import { GameOverScreen } from '../../ui/screens/GameOverScreen';
import { GameScreen } from '../../ui/screens/GameScreen';
import { StartScreen } from '../../ui/screens/StartScreen';
import {
  useGameSession,
  type GameSessionOptions,
} from '../use-game-session';

function SessionHarness({
  options = {},
}: {
  readonly options?: GameSessionOptions;
}) {
  const session = useGameSession(options);

  if (session.state.screen === 'start') {
    return <StartScreen onBegin={session.showDifficulty} />;
  }

  if (session.state.screen === 'difficulty') {
    return <DifficultyScreen onSelect={session.selectDifficulty} />;
  }

  if (session.state.screen === 'dead') {
    return (
      <GameOverScreen
        model={session.gameOverModel!}
        onRestart={session.restart}
      />
    );
  }

  return (
    <GameScreen
      model={session.gameModel!}
      onAction={session.performAction}
    />
  );
}

describe('useGameSession', () => {
  it('recorre inicio, dificultad y partida con un estado nuevo', async () => {
    const user = userEvent.setup();
    render(<SessionHarness options={{ randomInt: () => 4 }} />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'La partida' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
  });

  it('resuelve una sola vez la acción y conserva el resultado', async () => {
    const user = userEvent.setup();
    const actualResolveTurn = await import('../../game/engine');
    const resolveTurnMock = vi.fn(actualResolveTurn.resolveTurn);
    render(
      <StrictMode>
        <SessionHarness
          options={{
            randomInt: () => 4,
            resolveTurn: resolveTurnMock,
          }}
        />
      </StrictMode>,
    );

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));

    expect(resolveTurnMock).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('status', { name: 'Última resolución' }),
    ).toHaveTextContent('Consultas las reglas del refugio.');
  });

  it('cambia a la pantalla final y reinicia sin conservar la partida', async () => {
    const user = userEvent.setup();
    render(
      <SessionHarness
        options={{
          randomInt: () => 99,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Agonía' }));
    for (let impact = 0; impact < 10; impact += 1) {
      await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    }

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
    );

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('usa los atajos solo mientras la partida está activa', async () => {
    const user = userEvent.setup();
    const resolveTurnMock = vi.fn((state) => ({
      state: { ...state, turn: state.turn + 1 },
      actionOutcome: { type: 'help' } as const,
      randomEvent: null,
      milestone: null,
    }));
    render(
      <SessionHarness
        options={{
          resolveTurn: resolveTurnMock,
          randomInt: () => 4,
        }}
      />,
    );

    await user.keyboard('b');
    expect(resolveTurnMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.keyboard('?');

    expect(resolveTurnMock).toHaveBeenCalledOnce();
  });
});
