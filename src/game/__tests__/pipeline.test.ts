import { describe, expect, it } from 'vitest';

import { resolveAction } from '../actions';
import { applyDifficulty } from '../difficulty';
import { finishGame } from '../end-state';
import { resolveRandomEvent } from '../events';
import type { GameCoreState } from '..';
import {
  createCoreState,
} from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

describe('resolveRandomEvent', () => {
  it('no consume azar en Normal', () => {
    const state = createCoreState({ difficulty: 'normal' });

    const result = resolveRandomEvent(
      state,
      failIfRandomIntIsCalled(),
    );

    expect(result).toEqual({ state, event: null });
  });

  it.each([
    [1, 'storm', { hasShelter: false }],
    [10, 'storm', { hasShelter: false }],
    [11, null, {}],
    [50, null, {}],
    [51, 'raccoon', { food: 0 }],
    [59, 'raccoon', { food: 0 }],
    [60, null, {}],
    [98, null, {}],
    [99, 'meteorite', { health: 7 }],
    [100, null, {}],
  ] as const)(
    'resuelve la tirada de evento %i como %s',
    (value, eventType, changes) => {
      const state = createCoreState({
        difficulty: 'agony',
        food: 4,
        health: 8,
        hasShelter: true,
      });
      const random = sequenceRandomInt([value]);

      const result = resolveRandomEvent(state, random.randomInt);

      expect(result.event).toEqual(
        eventType === null ? null : { type: eventType },
      );
      expect(result.state).toEqual({ ...state, ...changes });
      expect(random.calls).toEqual([{ min: 1, max: 100 }]);
    },
  );

  it('deja al jugador vivo tras un meteorito con salud inicial', () => {
    const state = createCoreState({ difficulty: 'agony', health: 10 });
    const random = sequenceRandomInt([99]);

    const result = resolveRandomEvent(state, random.randomInt);

    expect(result).toEqual({
      state: { ...state, health: 9 },
      event: { type: 'meteorite' },
    });
  });

  it('mantiene mortal un meteorito cuando la salud ya es crítica', () => {
    const state = createCoreState({ difficulty: 'agony', health: 1 });
    const random = sequenceRandomInt([99]);

    const result = resolveRandomEvent(state, random.randomInt);

    expect(result).toEqual({
      state: { ...state, health: 0 },
      event: { type: 'meteorite' },
    });
  });
});

describe('applyDifficulty', () => {
  it.each([
    [14, 0, 10, null],
    [15, 1, 9, { type: 'turn-15' }],
    [16, 0, 10, null],
    [20, 0, 10, null],
    [29, 0, 10, null],
    [30, 1, 9, { type: 'turn-30' }],
    [31, 0, 10, null],
    [40, 0, 10, null],
  ] as const)(
    'aplica el hito y la penalización del turno %i',
    (turn, hunger, energy, milestone) => {
      const state = createCoreState({ turn });

      const result = applyDifficulty(state);

      expect(result).toEqual({
        state: createCoreState({ turn, hunger, energy }),
        milestone,
      });
    },
  );

  it('aplica una penalización al cruzar un hito con una acción multiturno', () => {
    const state = createCoreState({ turn: 16 });

    const result = applyDifficulty(state, 14);

    expect(result).toEqual({
      state: createCoreState({ turn: 16, hunger: 1, energy: 9 }),
      milestone: { type: 'turn-15' },
    });
  });
});

describe('finishGame', () => {
  it.each([
    [
      { hunger: 11, energy: 10, health: 10 },
      { condition: 'hunger', reportedCause: 'hunger' },
    ],
    [
      { hunger: 10, energy: 0, health: 10 },
      { condition: 'energy', reportedCause: 'hunger' },
    ],
    [
      { hunger: 10, energy: 10, health: 0 },
      { condition: 'health', reportedCause: 'hunger' },
    ],
    [
      { hunger: 9, energy: 0, health: 0 },
      { condition: 'energy', reportedCause: 'energy' },
    ],
    [
      { hunger: 9, energy: 10, health: 0 },
      { condition: 'health', reportedCause: 'health' },
    ],
  ] as const)(
    'registra la condición y la causa comunicada para %o',
    (values, end) => {
      const state = createCoreState({ ...values, turn: 8 });

      const result = finishGame(state);

      expect(result).toEqual({
        ...state,
        status: 'dead',
        end: {
          ...end,
          turnsSurvived: 7,
        },
      });
    },
  );

  it.each([
    { hunger: 10, energy: 10, health: 10 },
    { hunger: 9, energy: 10, health: 10 },
    { hunger: 9, energy: 10, health: -1 },
  ])('mantiene activa una partida que no viola el bucle: %o', (values) => {
    const state = createCoreState(values);

    expect(finishGame(state)).toEqual({
      ...state,
      status: 'playing',
    });
  });

  it('no muta el estado base al finalizar', () => {
    const state = createCoreState({ hunger: 11, turn: 4 });
    const originalState = { ...state };

    const result = finishGame(state);

    expect(state).toEqual(originalState);
    expect(result).not.toBe(state);
  });
});

describe('composición del pipeline', () => {
  it('resuelve acción, evento, dificultad y fin en ese orden', () => {
    const state: GameCoreState = createCoreState({
      difficulty: 'agony',
      turn: 29,
      hunger: 8,
      energy: 10,
      food: 0,
      health: 10,
      hasShelter: false,
    });
    const random = sequenceRandomInt([1, 50]);

    const action = resolveAction(state, 'repair', random.randomInt);
    const event = resolveRandomEvent(action.state, random.randomInt);
    const difficulty = applyDifficulty(event.state, state.turn);
    const finished = finishGame(difficulty.state);

    expect(finished).toEqual({
      difficulty: 'agony',
      status: 'dead',
      turn: 31,
      hunger: 11,
      energy: 7,
      food: 0,
      health: 10,
      hasShelter: true,
      end: {
        condition: 'hunger',
        reportedCause: 'hunger',
        turnsSurvived: 30,
      },
    });
    expect(random.calls).toEqual([
      { min: 1, max: 10 },
      { min: 1, max: 100 },
    ]);
  });

  it('permite que Ayuda genere un evento en Agonía sin avanzar turno', () => {
    const state = createCoreState({ difficulty: 'agony' });
    const random = sequenceRandomInt([99]);

    const action = resolveAction(state, 'help', random.randomInt);
    const event = resolveRandomEvent(action.state, random.randomInt);
    const difficulty = applyDifficulty(event.state);
    const finished = finishGame(difficulty.state);

    expect(finished).toMatchObject({
      status: 'playing',
      turn: 1,
      health: 9,
    });
    expect(random.calls).toEqual([{ min: 1, max: 100 }]);
  });
});
