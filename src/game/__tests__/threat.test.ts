import { describe, expect, it } from 'vitest';

import {
  applyThreat,
  BASE_FOOD_RELIEF,
  extraEventRolls,
  extraHungerPerTurn,
  foodRelief,
  forageSuccessLimit,
  MAX_THREAT_LOAD,
  repairFailureRadius,
  repairTurnCost,
  restEnergyCap,
  threatForTurn,
  threatLoad,
  threatThreshold,
} from '../threat';
import { createCoreState } from './test-state';

describe('threatThreshold', () => {
  it.each([
    [0, 0],
    [1, 10],
    [2, 22],
    [3, 36],
    [4, 52],
    [5, 70],
    [6, 90],
    [7, 112],
    [8, 136],
    [9, 162],
    [10, 190],
  ])('sitúa el nivel %i en el turno %i', (level, turn) => {
    expect(threatThreshold(level)).toBe(turn);
  });

  it('deja los huecos cada vez más amplios', () => {
    const gaps = [2, 3, 4, 5, 6, 7, 8].map(
      (level) => threatThreshold(level) - threatThreshold(level - 1),
    );

    expect(gaps).toEqual([12, 14, 16, 18, 20, 22, 24]);
  });
});

describe('threatForTurn', () => {
  it.each([
    [1, 0],
    [9, 0],
    [10, 1],
    [11, 1],
    [21, 1],
    [22, 2],
    [35, 2],
    [36, 3],
    [100, 6],
  ])('resuelve el turno %i con el nivel %i', (turn, level) => {
    expect(threatForTurn(turn)).toBe(level);
  });

  it('sigue contando por encima del tope de carga', () => {
    expect(threatForTurn(1000)).toBeGreaterThan(MAX_THREAT_LOAD);
  });
});

describe('threatLoad', () => {
  it.each([
    [0, 0],
    [7, 7],
    [10, 10],
    [11, 10],
    [999, 10],
  ])('satura la carga del nivel %i en %i', (threat, load) => {
    expect(threatLoad(threat)).toBe(load);
  });
});

describe('modificadores de carga', () => {
  it('extrae el hambre extra por turno', () => {
    const table = Array.from({ length: 11 }, (_, load) =>
      extraHungerPerTurn(load),
    );

    expect(table).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('baja el tope de energía al descansar', () => {
    const table = Array.from({ length: 11 }, (_, load) => restEnergyCap(load));

    expect(table).toEqual([5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2]);
  });

  it('nunca deja el tope de energía por debajo de 1', () => {
    expect(restEnergyCap(MAX_THREAT_LOAD)).toBeGreaterThanOrEqual(1);
  });

  it('añade tiradas de evento solo en Agonía alta', () => {
    const table = Array.from({ length: 11 }, (_, load) => extraEventRolls(load));

    expect(table).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('estrecha la ventana de éxito al buscar comida', () => {
    const table = Array.from({ length: 11 }, (_, load) =>
      forageSuccessLimit(load),
    );

    expect(table).toEqual([3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1]);
  });

  it('nunca cierra del todo la ventana de éxito al buscar comida', () => {
    expect(forageSuccessLimit(MAX_THREAT_LOAD)).toBeGreaterThanOrEqual(1);
  });

  it('ensancha la banda de fallo al reparar en ambos lados', () => {
    const table = Array.from({ length: 11 }, (_, load) =>
      repairFailureRadius(load),
    );

    expect(table).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
    // Radio 0 debe seguir fallando solo con la tirada 5.
    const failsAt = (radius: number) =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((v) => Math.abs(v - 5) <= radius);

    expect(failsAt(repairFailureRadius(0))).toEqual([5]);
    expect(failsAt(repairFailureRadius(10))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('encarece reparar por turnos', () => {
    const table = Array.from({ length: 11 }, (_, load) => repairTurnCost(load));

    expect(table).toEqual([2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4]);
  });

  it('escala el alivio de la ración con la carga', () => {
    const table = Array.from({ length: 11 }, (_, load) => foodRelief(load));

    expect(table).toEqual([4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9]);
  });

  it('reproduce el relieve base de la Fase 1 con carga 0 y 1', () => {
    expect(BASE_FOOD_RELIEF).toBe(4);
    expect(foodRelief(0)).toBe(BASE_FOOD_RELIEF);
    expect(foodRelief(1)).toBe(BASE_FOOD_RELIEF);
  });

  it('queda por encima del hambre que cuesta el turno en toda la rampa', () => {
    // Sin esto la partida deja de ser superable a partir de la carga 4: la
    // racion costaria mas hambre de la que devuelve. Ver D-01 en SPEC-threat.md.
    for (let threat = 0; threat <= 40; threat += 1) {
      const hungerPerTurn = 1 + extraHungerPerTurn(threat);
      expect(foodRelief(threat)).toBeGreaterThan(hungerPerTurn);
    }
  });
});

describe('applyThreat', () => {
  it('no emite aviso por debajo del primer umbral', () => {
    const state = createCoreState({ turn: 9 });

    expect(applyThreat(state)).toEqual({ state, notice: null });
  });

  it('sube al nivel 1 y avisa en el turno 10', () => {
    const state = createCoreState({ turn: 10 });

    expect(applyThreat(state)).toEqual({
      state: createCoreState({ turn: 10, threat: 1 }),
      notice: { threat: 1, load: 1 },
    });
  });

  it('sube al nivel 2 y avisa en el turno 22', () => {
    const state = createCoreState({ turn: 22 });

    expect(applyThreat(state)).toEqual({
      state: createCoreState({ turn: 22, threat: 2 }),
      notice: { threat: 2, load: 2 },
    });
  });

  it('salta al nivel más alto y avisa una sola vez con una acción multiturno', () => {
    const state = createCoreState({ turn: 23, threat: 0 });

    expect(applyThreat(state)).toEqual({
      state: createCoreState({ turn: 23, threat: 2 }),
      notice: { threat: 2, load: 2 },
    });
  });

  it('no vuelve a avisar en turnos posteriores al mismo nivel', () => {
    const state = createCoreState({ turn: 15, threat: 1 });

    expect(applyThreat(state)).toEqual({ state, notice: null });
  });

  it('reporta la carga saturada cuando el nivel supera el tope', () => {
    const state = createCoreState({ turn: 1000, threat: 9 });

    const result = applyThreat(state);

    expect(result.state.threat).toBe(threatForTurn(1000));
    expect(result.notice?.load).toBe(MAX_THREAT_LOAD);
    expect(result.notice?.threat).toBeGreaterThan(MAX_THREAT_LOAD);
  });

  it('no muta el estado de entrada', () => {
    const state = createCoreState({ turn: 10 });
    const original = { ...state };

    applyThreat(state);

    expect(state).toEqual(original);
  });
});
