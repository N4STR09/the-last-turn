import { describe, expect, it } from 'vitest';

import { resolveAction } from '../actions';
import type { GameAction, GameCoreState } from '..';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

const initialCoreState: GameCoreState = {
  difficulty: 'normal',
  turn: 1,
  hunger: 0,
  energy: 10,
  food: 0,
  health: 10,
  hasShelter: false,
};

function createCoreState(
  overrides: Partial<GameCoreState> = {},
): GameCoreState {
  return { ...initialCoreState, ...overrides };
}

function resolve(
  state: GameCoreState,
  action: GameAction,
  values: readonly number[] = [],
) {
  const random = sequenceRandomInt(values);
  const resolution = resolveAction(state, action, random.randomInt);

  return { resolution, calls: random.calls };
}

describe('resolveAction', () => {
  describe('help', () => {
    it('no consume turno ni azar', () => {
      const state = createCoreState({
        turn: 14,
        hunger: 9,
        energy: 4,
        food: 7,
        health: 6,
        hasShelter: true,
      });

      const result = resolveAction(
        state,
        'help',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state,
        outcome: { type: 'help' },
      });
    });
  });

  describe('forage', () => {
    it.each([1, 2, 3])('añade comida cuando la tirada es %i', (value) => {
      const state = createCoreState();

      const { resolution, calls } = resolve(state, 'forage', [value]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 1,
        }),
        outcome: { type: 'forage-found' },
      });
      expect(calls).toEqual([{ min: 1, max: 5 }]);
    });

    it.each([4, 5])('no añade comida cuando la tirada es %i', (value) => {
      const state = createCoreState({ food: 4 });

      const { resolution, calls } = resolve(state, 'forage', [value]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 4,
        }),
        outcome: { type: 'forage-empty' },
      });
      expect(calls).toEqual([{ min: 1, max: 5 }]);
    });
  });

  describe('rest', () => {
    it('consume un turno sin recuperar energía cuando no hay refugio', () => {
      const state = createCoreState({ energy: 7 });

      const result = resolveAction(
        state,
        'rest',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 6,
        }),
        outcome: { type: 'rest-without-shelter' },
      });
    });

    it.each([1, 2])(
      'recupera 3 de energía con refugio cuando la tirada es %i',
      (value) => {
        const state = createCoreState({
          energy: 7,
          hasShelter: true,
        });

        const { resolution, calls } = resolve(state, 'rest', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 9,
            hasShelter: true,
          }),
          outcome: {
            type: 'rest-shelter-success',
            energyRecovered: 3,
          },
        });
        expect(calls).toEqual([{ min: 1, max: 10 }]);
      },
    );

    it.each([3, 10])(
      'recupera 5 de energía con refugio cuando la tirada es %i',
      (value) => {
        const state = createCoreState({
          energy: 7,
          hasShelter: true,
        });

        const { resolution, calls } = resolve(state, 'rest', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 11,
            hasShelter: true,
          }),
          outcome: {
            type: 'rest-shelter-success',
            energyRecovered: 5,
          },
        });
        expect(calls).toEqual([{ min: 1, max: 10 }]);
      },
    );
  });

  describe('explore', () => {
    it.each([1, 4])('encuentra refugio cuando la tirada es %i', (value) => {
      const state = createCoreState();

      const { resolution, calls } = resolve(state, 'explore', [value]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          hasShelter: true,
        }),
        outcome: { type: 'explore-shelter' },
      });
      expect(calls).toEqual([{ min: 1, max: 20 }]);
    });

    it.each([16, 20])('encuentra comida cuando la tirada es %i', (value) => {
      const state = createCoreState({ food: 2 });

      const { resolution, calls } = resolve(state, 'explore', [value]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 3,
        }),
        outcome: { type: 'explore-food' },
      });
      expect(calls).toEqual([{ min: 1, max: 20 }]);
    });

    it.each([5, 15])('no encuentra nada cuando la tirada es %i', (value) => {
      const state = createCoreState({ food: 2 });

      const { resolution, calls } = resolve(state, 'explore', [value]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 2,
        }),
        outcome: { type: 'explore-empty' },
      });
      expect(calls).toEqual([{ min: 1, max: 20 }]);
    });
  });

  describe('repair', () => {
    it('falla y consume dos turnos cuando la tirada es 5', () => {
      const state = createCoreState();

      const { resolution, calls } = resolve(state, 'repair', [5]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 3,
          hunger: 2,
          energy: 8,
        }),
        outcome: { type: 'repair-failed' },
      });
      expect(calls).toEqual([{ min: 1, max: 10 }]);
    });

    it('conserva un refugio existente cuando falla', () => {
      const state = createCoreState({ hasShelter: true });

      const { resolution } = resolve(state, 'repair', [5]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 3,
          hunger: 2,
          energy: 8,
          hasShelter: true,
        }),
        outcome: { type: 'repair-failed' },
      });
    });

    it.each([1, 10])(
      'establece el refugio y consume dos turnos cuando la tirada es %i',
      (value) => {
        const state = createCoreState();

        const { resolution, calls } = resolve(state, 'repair', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 3,
            hunger: 2,
            energy: 8,
            hasShelter: true,
          }),
          outcome: { type: 'repair-succeeded' },
        });
        expect(calls).toEqual([{ min: 1, max: 10 }]);
      },
    );
  });

  describe('fish', () => {
    it('termina después de un único intento', () => {
      const state = createCoreState();

      const { resolution, calls } = resolve(state, 'fish', [1]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 3,
        }),
        outcome: { type: 'fish-catch', attempts: 1 },
      });
      expect(calls).toEqual([{ min: 1, max: 3 }]);
    });

    it('acumula los intentos en turno, hambre y energía, pero añade una sola vez la comida', () => {
      const state = createCoreState();

      const { resolution, calls } = resolve(state, 'fish', [2, 3, 1]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 4,
          hunger: 3,
          energy: 7,
          food: 3,
        }),
        outcome: { type: 'fish-catch', attempts: 3 },
      });
      expect(calls).toEqual([
        { min: 1, max: 3 },
        { min: 1, max: 3 },
        { min: 1, max: 3 },
      ]);
    });

    it('falla tras seis intentos sin éxito', () => {
      const state = createCoreState({ food: 2 });

      const { resolution, calls } = resolve(state, 'fish', [2, 3, 2, 3, 2, 3]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 7,
          hunger: 6,
          energy: 4,
          food: 2,
        }),
        outcome: { type: 'fish-failed', attempts: 6 },
      });
      expect(calls).toEqual([
        { min: 1, max: 3 },
        { min: 1, max: 3 },
        { min: 1, max: 3 },
        { min: 1, max: 3 },
        { min: 1, max: 3 },
        { min: 1, max: 3 },
      ]);
    });

    it('permite capturar en el sexto intento', () => {
      const state = createCoreState();

      const { resolution } = resolve(state, 'fish', [2, 3, 2, 3, 2, 1]);

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 7,
          hunger: 6,
          energy: 4,
          food: 3,
        }),
        outcome: { type: 'fish-catch', attempts: 6 },
      });
    });
  });

  describe('eat', () => {
    it('consume una comida, reduce el hambre y recupera salud', () => {
      const state = createCoreState({ food: 5, hunger: 2, health: 6 });

      const result = resolveAction(
        state,
        'eat',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 0,
          energy: 9,
          food: 4,
          health: 7,
        }),
        outcome: {
          type: 'eat-consumed',
          foodConsumed: 1,
          hungerReduced: 2,
          healthRecovered: 1,
        },
      });
    });

    it('mantiene el coste cruel cuando no hay comida', () => {
      const state = createCoreState({ food: 0, hunger: 2 });

      const result = resolveAction(
        state,
        'eat',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 3,
          energy: 9,
          food: 0,
        }),
        outcome: { type: 'eat-no-food' },
      });
    });

    it('no baja el hambre de cero al comer con el estómago vacío', () => {
      const state = createCoreState({ food: 1, hunger: 0, health: 10 });

      const result = resolveAction(
        state,
        'eat',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 0,
          energy: 9,
          food: 0,
          health: 10,
        }),
        outcome: {
          type: 'eat-consumed',
          foodConsumed: 1,
          hungerReduced: 0,
          healthRecovered: 0,
        },
      });
    });

    it('trata la comida negativa como ausencia de comida', () => {
      const state = createCoreState({ food: -1, hunger: 3 });

      const result = resolveAction(
        state,
        'eat',
        failIfRandomIntIsCalled(),
      );

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 4,
          energy: 9,
          food: -1,
        }),
        outcome: { type: 'eat-no-food' },
      });
    });
  });

  it('no muta el estado de entrada', () => {
    const state = createCoreState({ food: 2, hasShelter: true });
    const originalState = { ...state };

    const { resolution } = resolve(state, 'rest', [1]);

    expect(state).toEqual(originalState);
    expect(resolution.state).not.toBe(state);
  });
});
