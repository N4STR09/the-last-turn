import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserRandomInt } from '../browser-random';
import { createInitialAppState } from '../app-state';
import { appReducer } from '../app-reducer';
import { createGame } from '../../game';
import type { AppCommand, AppState } from '../app-state';
import type {
  FinishedGameState,
  GameResolution,
  GameState,
  PlayingGameState,
  ThreatNotice,
} from '../../game';

function createResolution(
  state: GameState,
  overrides: Partial<GameResolution> = {},
): GameResolution {
  return {
    state,
    actionOutcome: { type: 'eat-no-food' },
    randomEvents: [],
    threatNotice: null,
    ...overrides,
  };
}

/**
 * Estado de partida viva. La confirmación de rendirse se deja explícita en
 * false porque forma parte de la variante: si mañana se Adds un campo más, este
 * helper avisa en vez de dejar que el estado sea medio falso.
 */
function playingState(
  game: PlayingGameState,
  resolution: GameResolution | null = null,
  threatNotice: ThreatNotice | null = null,
  surrenderPending = false,
): AppState {
  return {
    screen: 'playing',
    game,
    resolution,
    threatNotice,
    surrenderPending,
  };
}

function deadStateFrom(game: GameState): FinishedGameState {
  return {
    ...game,
    turn: 4,
    status: 'dead',
    end: {
      condition: 'hunger',
      reportedCause: 'hunger',
      turnsSurvived: 3,
    },
  };
}

const notice: ThreatNotice = { threat: 1, load: 1 };

describe('appReducer', () => {
  it('empieza en Inicio con partida, resolución y aviso nulos', () => {
    expect(createInitialAppState()).toEqual({
      screen: 'start',
      game: null,
      resolution: null,
      threatNotice: null,
    });
  });

  it('navega de Inicio a Dificultad y descarta datos', () => {
    const state = playingState(createGame('normal'));

    const next = appReducer(state, { type: 'show-difficulty' });

    expect(next).toEqual({
      screen: 'difficulty',
      game: null,
      resolution: null,
      threatNotice: null,
    });
    expect(state.game).not.toBeNull();
  });

  it('inicia una partida activa y deja la resolución y el aviso vacíos', () => {
    const game = createGame('agony');

    const next = appReducer(createInitialAppState(), {
      type: 'start-game',
      game,
    });

    expect(next).toEqual({
      screen: 'playing',
      game,
      resolution: null,
      threatNotice: null,
      surrenderPending: false,
    });
  });

  it('elige la pantalla de partida cuando la resolución sigue activa', () => {
    const game = createGame('normal');
    const resolution = createResolution({ ...game, turn: 2 });

    const next = appReducer(playingState(game), {
      type: 'resolve-action',
      resolution,
    });

    expect(next).toEqual({
      screen: 'playing',
      game: resolution.state,
      resolution,
      threatNotice: null,
      surrenderPending: false,
    });
  });

  it('abre el aviso de escalada que trae la resolución', () => {
    const game = createGame('normal');
    const resolution = createResolution(
      { ...game, turn: 10, threat: 1 },
      { threatNotice: notice },
    );

    const next = appReducer(playingState(game), {
      type: 'resolve-action',
      resolution,
    });

    expect(next.threatNotice).toEqual(notice);
    expect(next.screen).toBe('playing');
  });

  it('descarta el aviso sin tocar la partida ni la resolución', () => {
    const playing: PlayingGameState = {
      ...createGame('normal'),
      turn: 10,
      threat: 1,
    };
    const resolution = createResolution(playing, { threatNotice: notice });
    const state = playingState(playing, resolution, notice);

    const next = appReducer(state, { type: 'dismiss-threat-notice' });

    expect(next).toEqual({ ...state, threatNotice: null });
  });

  it('ignora el descarte cuando no hay ningún aviso abierto', () => {
    const state = playingState(createGame('normal'));

    expect(appReducer(state, { type: 'dismiss-threat-notice' })).toBe(state);
  });

  it.each(['dead', 'difficulty'] as const)(
    'ignora el descarte fuera de la partida viva en %s',
    (screen) => {
      const game = createGame('normal');
      const state: AppState =
        screen === 'dead'
          ? {
              screen: 'dead',
              game: deadStateFrom(game),
              resolution: createResolution(deadStateFrom(game)),
              threatNotice: null,
            }
          : {
              screen: 'difficulty',
              game: null,
              resolution: null,
              threatNotice: null,
            };

      expect(appReducer(state, { type: 'dismiss-threat-notice' })).toBe(state);
    },
  );

  it('elige la pantalla final cuando la resolución termina', () => {
    const game = createGame('agony');
    const deadState = deadStateFrom(game);
    const resolution: GameResolution = {
      state: deadState,
      actionOutcome: { type: 'eat-no-food' },
      randomEvents: [],
      threatNotice: notice,
    };

    const next = appReducer(playingState(game), {
      type: 'resolve-action',
      resolution,
    });

    expect(next).toEqual({
      screen: 'dead',
      game: deadState,
      resolution,
      threatNotice: null,
    });
  });

  it('reinicia descartando la partida, la resolución y el aviso', () => {
    const game = createGame('normal');
    const resolution = createResolution(game, { threatNotice: notice });
    const state = playingState(game, resolution, notice);

    const next = appReducer(state, { type: 'restart' });

    expect(next).toEqual({
      screen: 'difficulty',
      game: null,
      resolution: null,
      threatNotice: null,
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
      threatNotice: null,
    });
  });

  it('devuelve el estado intacto ante un comando desconocido', () => {
    const state = createInitialAppState();
    const command = { type: 'nunca-existe' } as unknown as AppCommand;

    expect(appReducer(state, command)).toBe(state);
  });
});

describe('rendirse', () => {
  it('abre la confirmación sin tocar la partida', () => {
    const game = createGame('normal');
    const state = playingState(game);

    const next = appReducer(state, { type: 'ask-surrender' });

    expect(next).toEqual({ ...state, surrenderPending: true });
  });

  it('cierra la confirmación si el jugador sigue jugando', () => {
    const game = createGame('normal');
    const state = playingState(game, null, null, true);

    const next = appReducer(state, { type: 'cancel-surrender' });

    expect(next).toEqual({ ...state, surrenderPending: false });
  });

  it('termina la partida declarando la rendición y sin resolución', () => {
    const playing: PlayingGameState = {
      ...createGame('agony'),
      turn: 12,
      hunger: 4,
      energy: 3,
      food: 1,
      hasShelter: true,
      threat: 2,
    };
    const resolution = createResolution(playing);

    const next = appReducer(playingState(playing, resolution, null, true), {
      type: 'surrender',
    });

    expect(next).toEqual({
      screen: 'dead',
      game: {
        ...playing,
        status: 'dead',
        end: {
          condition: 'surrender',
          reportedCause: 'surrender',
          turnsSurvived: 11,
        },
      },
      // No hubo turno que resolver, así que no hay resolución que conservar.
      resolution: null,
      threatNotice: null,
    });
  });

  it('no acepta rendirse con el aviso de escalada abierto', () => {
    const game = createGame('normal');
    const state = playingState(game, null, notice);

    expect(appReducer(state, { type: 'ask-surrender' })).toBe(state);
    expect(appReducer(state, { type: 'surrender' })).toBe(state);
  });

  it('ignora el descarte de una confirmación que no está puesta', () => {
    const state = playingState(createGame('normal'));

    expect(appReducer(state, { type: 'cancel-surrender' })).toBe(state);
  });

  it.each(['dead', 'difficulty'] as const)(
    'ignora rendirse fuera de la partida viva en %s',
    (screen) => {
      const game = createGame('normal');
      const state: AppState =
        screen === 'dead'
          ? {
              screen: 'dead',
              game: deadStateFrom(game),
              resolution: createResolution(deadStateFrom(game)),
              threatNotice: null,
            }
          : {
              screen: 'difficulty',
              game: null,
              resolution: null,
              threatNotice: null,
            };

      expect(appReducer(state, { type: 'ask-surrender' })).toBe(state);
      expect(appReducer(state, { type: 'cancel-surrender' })).toBe(state);
      expect(appReducer(state, { type: 'surrender' })).toBe(state);
    },
  );
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
