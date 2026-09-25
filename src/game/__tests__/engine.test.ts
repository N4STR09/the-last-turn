import { describe, expect, it } from 'vitest';

import { finishGame } from '../end-state';
import { createGame, resolveTurn } from '..';
import type { Difficulty, PlayingGameState } from '..';
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
        status: 'dead',
        turn: 3,
        hunger: 2,
        energy: 8,
        food: 0,
        health: 0,
        hasShelter: false,
        end: {
          condition: 'health',
          reportedCause: 'health',
          turnsSurvived: 2,
        },
      },
      actionOutcome: { type: 'repair-failed' },
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
      hunger: 12,
      energy: 6,
      end: {
        condition: 'hunger',
        reportedCause: 'hunger',
        turnsSurvived: 30,
      },
    });
    expect(result.randomEvent).toBeNull();
    expect(result.milestone).toBeNull();
  });

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
