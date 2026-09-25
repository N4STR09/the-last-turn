import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserRandomInt } from '../browser-random';
import { createInitialAppState } from '../app-state';
import { appReducer } from '../app-reducer';
import { createGame } from '../../game';
import type {
  AppCommand,
  AppState,
} from '../app-state';
import type {
  GameResolution,
  PlayingGameState,
} from '../../game';

function createResolution(
  state: PlayingGameState['status'] extends 'playing'
    ? PlayingGameState
    : never,
): GameResolution {
  return {
    state,
    actionOutcome: { type: 'help' },
    randomEvent: null,
    milestone: null,
  };
}

describe('appReducer', () => {
  it('empieza en Inicio con partida y resolución nulas', () => {
    expect(createInitialAppState()).toEqual({
      screen: 'start',
      game: null,
      resolution: null,
    });
  });

  it('navega de Inicio a Dificultad y descarta datos', () => {
    const state: AppState = {
      screen: 'playing',
      game: createGame('normal'),
      resolution: null,
    };

    const next = appReducer(state, { type: 'show-difficulty' });

    expect(next).toEqual({
      screen: 'difficulty',
      game: null,
      resolution: null,
    });
    expect(state.game).not.toBeNull();
  });

  it('inicia una partida activa y deja la resolución vacía', () => {
    const game = createGame('agony');

    const next = appReducer(createInitialAppState(), {
      type: 'start-game',
      game,
    });

    expect(next).toEqual({
      screen: 'playing',
      game,
      resolution: null,
    });
  });

  it('elige la pantalla de partida cuando la resolución sigue activa', () => {
    const game = createGame('normal');
    const resolution = createResolution({
      ...game,
      turn: 2,
    });
    const state: AppState = {
      screen: 'playing',
      game,
      resolution: null,
    };

    const next = appReducer(state, { type: 'resolve-action', resolution });

    expect(next).toEqual({
      screen: 'playing',
      game: resolution.state,
      resolution,
    });
  });

  it('elige la pantalla final cuando la resolución termina', () => {
    const game = createGame('agony');
    const deadState = {
      ...game,
      turn: 4,
      status: 'dead' as const,
      end: {
        condition: 'hunger' as const,
        reportedCause: 'hunger' as const,
        turnsSurvived: 3,
      },
    };
    const resolution: GameResolution = {
      state: deadState,
      actionOutcome: { type: 'eat-no-food' },
      randomEvent: null,
      milestone: null,
    };

    const next = appReducer(
      {
        screen: 'playing',
        game,
        resolution: null,
      },
      { type: 'resolve-action', resolution },
    );

    expect(next).toEqual({
      screen: 'dead',
      game: deadState,
      resolution,
    });
  });

  it('reinicia descartando la partida y la resolución anteriores', () => {
    const game = createGame('normal');
    const resolution = createResolution({ ...game, turn: 2 });
    const state: AppState = {
      screen: 'dead',
      game: {
        ...game,
        status: 'dead',
        end: {
          condition: 'energy',
          reportedCause: 'energy',
          turnsSurvived: 1,
        },
      },
      resolution: {
        ...resolution,
        state: {
          ...game,
          status: 'dead',
          end: {
            condition: 'energy',
            reportedCause: 'energy',
            turnsSurvived: 1,
          },
        },
      },
    };

    const next = appReducer(state, { type: 'restart' });

    expect(next).toEqual({
      screen: 'difficulty',
      game: null,
      resolution: null,
    });
  });

  it('mantiene el reducer puro para el mismo estado y comando', () => {
    const state = createInitialAppState();
    const command: AppCommand = { type: 'show-difficulty' };

    const first = appReducer(state, command);
    const second = appReducer(state, command);

    expect(second).toEqual(first);
    expect(state).toEqual({
      screen: 'start',
      game: null,
      resolution: null,
    });
  });
});

describe('browserRandomInt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve el mínimo con un valor aleatorio cero', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(browserRandomInt(1, 6)).toBe(1);
  });

  it('devuelve el máximo con el valor inmediatamente anterior a uno', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999999999999);

    expect(browserRandomInt(1, 6)).toBe(6);
  });
});
