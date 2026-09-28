import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DifficultyScreen } from '../../ui/screens/DifficultyScreen';
import { EscalationOverlay } from '../../ui/components/EscalationOverlay';
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
    <>
      <GameScreen
        model={session.gameModel!}
        onAction={session.performAction}
        surrender={session.surrender}
      />
      {session.threatNoticeModel !== null ? (
        <EscalationOverlay
          model={session.threatNoticeModel}
          onContinue={session.dismissThreatNotice}
        />
      ) : null}
    </>
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
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sin órdenes todavía.')).toBeInTheDocument();
    // Cinco acciones y la salida. Ninguna más.
    const actions = within(screen.getByRole('group', { name: 'Acciones' }));
    expect(actions.getAllByRole('button')).toHaveLength(6);
    expect(actions.getByRole('button', { name: /Rendirse/ })).toBeVisible();
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
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(resolveTurnMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Descansas al aire libre.',
    );
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
    // El umbral 1 cae en el turno 10, así que el noveno descanso es el último
    // antes del aviso. Cada turno gasta un punto de energía y el meteorito de
    // Agonía quita uno de salud, y al noveno ya no queda nada que gastar.
    for (let rest = 0; rest < 9; rest += 1) {
      await user.click(screen.getByRole('button', { name: /^Descansar/ }));
    }

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByText('Haz click para continuar...'));

    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toBeInTheDocument();
    // Agotamiento y hambre llegan el mismo turno, y el motor dice el hambre
    // porque es el número que el jugador lleva viendo subir toda la partida.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    );
    expect(screen.getByText('10 turnos aguantados')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    // Los tres ceros de una partida recién empezada en Normal: hambre, comida y
    // el nivel de escalada, que vive en el banner. Energía y salud arrancan a 10
    // y por eso no aparecen aquí.
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('usa los atajos solo mientras la partida está activa', async () => {
    const user = userEvent.setup();
    const resolveTurnMock = vi.fn((state) => ({
      state: { ...state, turn: state.turn + 1 },
      actionOutcome: { type: 'eat-no-food' } as const,
      randomEvents: [],
      threatNotice: null,
    }));
    render(
      <SessionHarness
        options={{
          resolveTurn: resolveTurnMock,
          randomInt: () => 4,
        }}
      />,
    );

    await user.keyboard('e');
    expect(resolveTurnMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.keyboard('e');

    expect(resolveTurnMock).toHaveBeenCalledOnce();
  });

  it('abre el aviso de escalada y bloquea la partida hasta continuar', async () => {
    const user = userEvent.setup();
    const resolveTurnMock = vi.fn((state) => ({
      state: { ...state, turn: state.turn + 1, threat: 1 },
      actionOutcome: { type: 'eat-no-food' } as const,
      randomEvents: [],
      threatNotice: { threat: 1, load: 1 },
    }));
    render(
      <SessionHarness
        options={{
          resolveTurn: resolveTurnMock,
          randomInt: () => 1,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    // Con el aviso abierto, ni los botones ni los atajos deben actuar.
    await user.keyboard('ecsdr');
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    await user.click(screen.getByText('Haz click para continuar...'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    await user.keyboard('e');
    expect(resolveTurnMock).toHaveBeenCalledTimes(2);
  });

  it('no abre aviso cuando la resolución no lo trae', async () => {
    const user = userEvent.setup();
    render(<SessionHarness options={{ randomInt: () => 1 }} />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('descarta el aviso sin mover la partida', async () => {
    const user = userEvent.setup();
    render(<SessionHarness options={{ randomInt: () => 1 }} />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));

    // Ocho descansos son el turno 9. El 10 cruza el umbral 1 y ahí sí debe
    // abrirse el aviso, así que parar en el 9 es lo que demuestra que los ocho
    // anteriores no lo abrieron.
    for (let rest = 0; rest < 8; rest += 1) {
      await user.click(screen.getByRole('button', { name: /^Descansar/ }));
    }

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Y al 10 sí aparece, lo que confirma que el corte estaba en el sitio.
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('rendirse desde la sesión', () => {
  it('pide confirmación, congela la partida y termina al confirmar', async () => {
    const user = userEvent.setup();
    const resolveTurnMock = vi.fn((state) => ({
      state: { ...state, turn: state.turn + 1 },
      actionOutcome: { type: 'eat-no-food' } as const,
      randomEvents: [],
      threatNotice: null,
    }));
    render(
      <SessionHarness
        options={{
          resolveTurn: resolveTurnMock,
          randomInt: () => 4,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /Rendirse/ }));

    // La confirmación está puesta y nada se ha resuelto: rendirse no es un turno.
    expect(
      screen.getByRole('dialog', { name: /¿Seguro que te rindes?/ }),
    ).toBeInTheDocument();
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    // Con el diálogo abierto los atajos tampoco mueven la partida.
    await user.keyboard('ecsdr');
    expect(resolveTurnMock).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Rendirme' }));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Te has autoeliminado con un botón. El refugio queda intacto y tú, desinstalado.',
    );
    expect(resolveTurnMock).toHaveBeenCalledOnce();
  });

  it('conserva la partida y los atajos si el jugador se arrepiente', async () => {
    const user = userEvent.setup();
    const resolveTurnMock = vi.fn((state) => ({
      state: { ...state, turn: state.turn + 1 },
      actionOutcome: { type: 'eat-no-food' } as const,
      randomEvents: [],
      threatNotice: null,
    }));
    render(
      <SessionHarness
        options={{
          resolveTurn: resolveTurnMock,
          randomInt: () => 4,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    await user.click(screen.getByRole('button', { name: /Rendirse/ }));
    await user.click(screen.getByRole('button', { name: 'Seguir jugando' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toBeInTheDocument();

    // Al cancelar, el foco vuelve al botón que lo pidió. Mientras un botón lo
    // tenga, los atajos no disparan: es la misma regla que impide que una tecla
    // actúe sobre un campo de texto, y evita que «e» signifique explorar
    // justo después de haber cancelado.
    await user.keyboard('e');
    expect(resolveTurnMock).not.toHaveBeenCalled();

    // Al soltar el foco, el atajo vuelve a estar vivo: la partida no quedó
    // bloqueada por haber dudado.
    screen.getByRole('button', { name: /Rendirse/ }).blur();
    await user.keyboard('e');
    expect(resolveTurnMock).toHaveBeenCalledOnce();
  });
});
