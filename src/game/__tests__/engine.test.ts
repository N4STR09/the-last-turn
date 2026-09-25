import { describe, expect, it } from 'vitest';

import { finishGame } from '../end-state';
import { createGame, resolveTurn } from '..';
import type { Difficulty, GameState, PlayingGameState } from '..';
import { createCoreState } from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

function createPlayingState(
  difficulty: Difficulty,
  overrides: Partial<PlayingGameState> = {},
): PlayingGameState {
  return { ...createGame(difficulty), ...overrides };
}

describe('resolveTurn', () => {
  it('resuelve una acción en Normal sin tirar el azar de evento', () => {
    const state = createPlayingState('normal');
    const random = failIfRandomIntIsCalled();

    const result = resolveTurn(state, 'help', random);

    expect(result).toEqual({
      state: {
        ...state,
        status: 'playing',
      },
      actionOutcome: { type: 'help' },
      randomEvent: null,
      milestone: null,
    });
  });

  it('resuelve acción, evento y fin en Agonía', () => {
    const state = createPlayingState('agony');
    const random = sequenceRandomInt([1, 99]);

    const result = resolveTurn(state, 'repair', random.randomInt);

    expect(result).toEqual({
      state: {
        difficulty: 'agony',
        status: 'playing',
        turn: 3,
        hunger: 2,
        energy: 8,
        food: 0,
        health: 9,
        hasShelter: true,
      },
      actionOutcome: { type: 'repair-succeeded' },
      randomEvent: { type: 'meteorite' },
      milestone: null,
    });
    expect(random.calls).toEqual([
      { min: 1, max: 10 },
      { min: 1, max: 100 },
    ]);
  });

  it('aplica el hito exacto después del evento de Agonía', () => {
    const state = createPlayingState('agony', { turn: 15 });
    const random = sequenceRandomInt([50]);

    const result = resolveTurn(state, 'help', random.randomInt);

    expect(result.state).toEqual({
      ...state,
      status: 'playing',
    });
    expect(result.actionOutcome).toEqual({ type: 'help' });
    expect(result.randomEvent).toBeNull();
    expect(result.milestone).toEqual({ type: 'turn-15' });
    expect(random.calls).toEqual([{ min: 1, max: 100 }]);
  });

  it('aplica las penalizaciones una sola vez tras una acción multiturno', () => {
    const state = createPlayingState('agony', {
      turn: 29,
      hunger: 8,
    });
    const random = sequenceRandomInt([1, 50]);

    const result = resolveTurn(state, 'repair', random.randomInt);

    expect(result.state).toMatchObject({
      status: 'dead',
      turn: 31,
      hunger: 11,
      energy: 7,
      end: {
        condition: 'hunger',
        reportedCause: 'hunger',
        turnsSurvived: 30,
      },
    });
    expect(result.randomEvent).toBeNull();
    expect(result.milestone).toEqual({ type: 'turn-30' });
  });

  it.each(['normal', 'agony'] as const)(
    'permite una estrategia renovable hasta superar el turno 100 en %s',
    (difficulty) => {
      let state: GameState = createGame(difficulty);
      const randomInt = (min: number, max: number) =>
        max === 100 ? 50 : min;
      const renewableActions = ['forage', 'eat', 'rest'] as const;

      state = resolveTurn(state, 'repair', randomInt).state;

      for (let cycle = 0; cycle < 33; cycle += 1) {
        for (const action of renewableActions) {
          const resolution = resolveTurn(state, action, randomInt);
          expect(resolution.state.status).toBe('playing');
          state = resolution.state;
        }
      }

      expect(state.turn).toBeGreaterThan(100);
      expect(state.status).toBe('playing');
    },
  );

  it('rechaza resolver una partida terminada sin consumir azar', () => {
    const deadState = finishGame(createCoreState({ hunger: 11 }));

    expect(() =>
      resolveTurn(deadState, 'help', failIfRandomIntIsCalled()),
    ).toThrow('No se puede resolver una partida terminada.');
  });

  it('rechaza un resultado de RandomInt fuera de intervalo', () => {
    const state = createPlayingState('agony');
    const random = sequenceRandomInt([101]);

    expect(() => resolveTurn(state, 'help', random.randomInt)).toThrow(
      RangeError,
    );
  });

  it('no muta el estado de entrada', () => {
    const state = createPlayingState('agony', { food: 2 });
    const originalState = { ...state };
    const random = sequenceRandomInt([1, 50]);

    resolveTurn(state, 'forage', random.randomInt);

    expect(state).toEqual(originalState);
  });
});
