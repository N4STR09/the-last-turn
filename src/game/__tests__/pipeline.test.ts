import { describe, expect, it } from 'vitest';

import { resolveAction } from '../actions';
import { finishGame } from '../end-state';
import { resolveRandomEvents } from '../events';
import { applyThreat } from '../threat';
import type { GameCoreState } from '..';
import { createCoreState } from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

describe('resolveRandomEvents', () => {
  it('no consume azar en Normal', () => {
    const state = createCoreState({ difficulty: 'normal' });

    const result = resolveRandomEvents(state, failIfRandomIntIsCalled());

    expect(result).toEqual({ state, events: [] });
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
    'resuelve la tirada de evento %i como %s con carga 0',
    (value, eventType, changes) => {
      const state = createCoreState({
        difficulty: 'agony',
        food: 4,
        health: 8,
        hasShelter: true,
      });
      const random = sequenceRandomInt([value]);

      const result = resolveRandomEvents(state, random.randomInt);

      expect(result.events).toEqual(
        eventType === null ? [] : [{ type: eventType }],
      );
      expect(result.state).toEqual({ ...state, ...changes });
      expect(random.calls).toEqual([{ min: 1, max: 100 }]);
    },
  );

  it('deja al jugador vivo tras un meteorito con salud inicial', () => {
    const state = createCoreState({ difficulty: 'agony', health: 10 });
    const random = sequenceRandomInt([99]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result).toEqual({
      state: { ...state, health: 9 },
      events: [{ type: 'meteorite' }],
    });
  });

  it('mantiene mortal un meteorito cuando la salud ya es crítica', () => {
    const state = createCoreState({ difficulty: 'agony', health: 1 });
    const random = sequenceRandomInt([99]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result).toEqual({
      state: { ...state, health: 0 },
      events: [{ type: 'meteorite' }],
    });
  });

  it('no cobra el recargo de energía con carga 0', () => {
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
    });
    const random = sequenceRandomInt([1]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.state.energy).toBe(5);
  });

  it.each([
    [1, { hasShelter: false, energy: 4 }],
    [55, { food: 0, energy: 4 }],
  ] as const)(
    'cobra un punto de energía extra a la tirada %i con carga 1',
    (value, changes) => {
      const state = createCoreState({
        difficulty: 'agony',
        energy: 5,
        food: 3,
        health: 10,
        hasShelter: true,
        threat: 1,
      });
      const random = sequenceRandomInt([value]);

      const result = resolveRandomEvents(state, random.randomInt);

      expect(result.state).toEqual({ ...state, ...changes });
    },
  );

  it('el mapache no hiere con carga 2 pero sí con carga 3', () => {
    const base = {
      difficulty: 'agony' as const,
      energy: 9,
      food: 3,
      health: 10,
      threat: 2,
    };
    const light = sequenceRandomInt([55]);
    const heavy = sequenceRandomInt([55]);

    const atTwo = resolveRandomEvents(
      createCoreState({ ...base }),
      light.randomInt,
    );
    const atThree = resolveRandomEvents(
      createCoreState({ ...base, threat: 3 }),
      heavy.randomInt,
    );

    expect(atTwo.state.health).toBe(10);
    expect(atThree.state).toMatchObject({ food: 0, energy: 8, health: 9 });
  });

  it('el recargo de energía puede dejar al jugador al borde de la muerte', () => {
    const state = createCoreState({
      difficulty: 'agony',
      energy: 1,
      hasShelter: true,
      threat: 1,
    });
    const random = sequenceRandomInt([1]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.state.energy).toBe(0);
  });

  it('hace una sola tirada con carga 3 y tres con carga 10', () => {
    const atThree = sequenceRandomInt([30, 30, 30]);
    const atTen = sequenceRandomInt([30, 30, 30]);

    resolveRandomEvents(
      createCoreState({ difficulty: 'agony', threat: 3 }),
      atThree.randomInt,
    );
    resolveRandomEvents(
      createCoreState({ difficulty: 'agony', threat: 10 }),
      atTen.randomInt,
    );

    expect(atThree.calls).toEqual([{ min: 1, max: 100 }]);
    expect(atTen.calls).toEqual([
      { min: 1, max: 100 },
      { min: 1, max: 100 },
      { min: 1, max: 100 },
    ]);
  });

  it('aplica cada tirada extra sobre el estado que dejó la anterior', () => {
    // Dos tormentas: la primera quita el refugio, la segunda cobra energía.
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
      threat: 4,
    });
    const random = sequenceRandomInt([5, 5]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.events).toEqual([{ type: 'storm' }, { type: 'storm' }]);
    expect(result.state).toMatchObject({ hasShelter: false, energy: 3 });
  });

  it('acumula eventos distintos en el orden en que salen', () => {
    const state = createCoreState({
      difficulty: 'agony',
      energy: 9,
      food: 3,
      health: 10,
      hasShelter: true,
      threat: 4,
    });
    const random = sequenceRandomInt([5, 99]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.events).toEqual([
      { type: 'storm' },
      { type: 'meteorite' },
    ]);
    expect(result.state).toMatchObject({
      hasShelter: false,
      energy: 8,
      health: 9,
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
  it('resuelve acción, evento, escalada y fin en ese orden', () => {
    const state: GameCoreState = createCoreState({
      difficulty: 'agony',
      turn: 29,
      hunger: 9,
      energy: 10,
      food: 0,
      health: 10,
      hasShelter: false,
    });
    const random = sequenceRandomInt([1, 50]);

    const action = resolveAction(state, 'repair', random.randomInt);
    const event = resolveRandomEvents(action.state, random.randomInt);
    const threat = applyThreat(event.state);
    const finished = finishGame(threat.state);

    expect(finished).toEqual({
      difficulty: 'agony',
      status: 'dead',
      turn: 31,
      hunger: 11,
      energy: 8,
      food: 0,
      health: 10,
      hasShelter: true,
      threat: 2,
      end: {
        condition: 'hunger',
        reportedCause: 'hunger',
        turnsSurvived: 30,
      },
    });
    expect(threat.notice).toEqual({ threat: 2, load: 2 });
    expect(random.calls).toEqual([
      { min: 1, max: 10 },
      { min: 1, max: 100 },
    ]);
  });

  it('permite que Ayuda genere un evento en Agonía sin avanzar turno', () => {
    const state = createCoreState({ difficulty: 'agony' });
    const random = sequenceRandomInt([99]);

    const action = resolveAction(state, 'help', random.randomInt);
    const event = resolveRandomEvents(action.state, random.randomInt);
    const threat = applyThreat(event.state);
    const finished = finishGame(threat.state);

    expect(finished).toMatchObject({
      status: 'playing',
      turn: 1,
      health: 9,
      threat: 0,
    });
    expect(threat.notice).toBeNull();
    expect(random.calls).toEqual([{ min: 1, max: 100 }]);
  });
});
