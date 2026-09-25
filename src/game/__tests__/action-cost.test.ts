import { describe, expect, it } from 'vitest';

import {
  actionCost,
  actionTurnSpan,
  MAX_FISHING_ATTEMPTS,
} from '../action-cost';
import { hungerPerTurn, repairTurnCost } from '../threat';
import type { GameAction } from '../types';

const everyAction: ReadonlyArray<GameAction> = [
  'help',
  'forage',
  'rest',
  'explore',
  'repair',
  'fish',
  'eat',
];

describe('hungerPerTurn', () => {
  it('es 1 sin escalada y sube con la carga', () => {
    expect(hungerPerTurn(0)).toBe(1);
    expect(hungerPerTurn(1)).toBe(1);
    expect(hungerPerTurn(2)).toBe(2);
    expect(hungerPerTurn(4)).toBe(3);
    // Carga 10: el extra de hambre es el tope, 6, y el gasto queda en 6.
    expect(hungerPerTurn(10)).toBe(6);
  });

  it('queda fuera de dominio con una amenaza negativa, igual que el extra', () => {
    // `applyThreat` solo sube desde 0, asi que una amenaza negativa no existe en
    // el juego. Se documenta el comportamiento en vez de añadir un recorte que
    // `extraHungerPerTurn` no tiene, para que las dos reglas se comporten igual.
    expect(hungerPerTurn(-3)).toBe(-1);
  });
});

describe('actionTurnSpan', () => {
  it('marca Ayuda como la unica accion sin turnos', () => {
    expect(actionTurnSpan('help', 0)).toEqual({ min: 0, max: 0 });
  });

  it.each(['forage', 'rest', 'explore', 'eat'] as const)(
    'fija %s en un solo turno sea cual sea la escalada',
    (action) => {
      for (const threat of [0, 1, 5, 10]) {
        expect(actionTurnSpan(action, threat)).toEqual({ min: 1, max: 1 });
      }
    },
  );

  it('manda a reparar al coste de turnos que fija la amenaza', () => {
    for (const threat of [0, 1, 2, 3, 4, 5, 6, 10]) {
      const turns = repairTurnCost(threat);
      expect(actionTurnSpan('repair', threat)).toEqual({
        min: turns,
        max: turns,
      });
    }
  });

  it('describe la pesca como un rango porque su coste es azar', () => {
    expect(actionTurnSpan('fish', 0)).toEqual({ min: 1, max: 6 });
    expect(actionTurnSpan('fish', 9)).toEqual({
      min: 1,
      max: MAX_FISHING_ATTEMPTS,
    });
  });
});

describe('actionCost', () => {
  it('no cobra nada por la ayuda, con escalada o sin ella', () => {
    for (const threat of [0, 3, 10]) {
      const cost = actionCost('help', threat);
      expect(cost.minHunger).toBe(0);
      expect(cost.maxHunger).toBe(0);
      expect(cost.minEnergy).toBe(0);
      expect(cost.maxEnergy).toBe(0);
    }
  });

  it('cobra un turno de hambre y uno de energia en las acciones simples', () => {
    for (const threat of [0, 2, 6, 10]) {
      const cost = actionCost('forage', threat);
      expect(cost.hungerPerTurn).toBe(hungerPerTurn(threat));
      expect(cost.minHunger).toBe(hungerPerTurn(threat));
      expect(cost.maxHunger).toBe(hungerPerTurn(threat));
      expect(cost.minEnergy).toBe(1);
      expect(cost.maxEnergy).toBe(1);
    }
  });

  it('escala el gasto de reparar con los turnos que cuesta', () => {
    const cost = actionCost('repair', 10);
    const turns = repairTurnCost(10);

    expect(turns).toBe(4);
    expect(cost.span.max).toBe(turns);
    expect(cost.minEnergy).toBe(turns);
    expect(cost.maxEnergy).toBe(turns);
    expect(cost.minHunger).toBe(turns * hungerPerTurn(10));
    expect(cost.maxHunger).toBe(cost.minHunger);
  });

  it('enuncia el peor caso de la pesca, de 1 a 6 turnos', () => {
    const cost = actionCost('fish', 4);
    const perTurn = hungerPerTurn(4);

    expect(cost.minHunger).toBe(perTurn);
    expect(cost.maxHunger).toBe(MAX_FISHING_ATTEMPTS * perTurn);
    expect(cost.minEnergy).toBe(1);
    expect(cost.maxEnergy).toBe(MAX_FISHING_ATTEMPTS);
  });

  it('mantiene la energia en un turno por turno y el hambre en el ritmo vigente', () => {
    for (const action of everyAction) {
      for (const threat of [0, 1, 2, 4, 7, 10]) {
        const cost = actionCost(action, threat);
        expect(cost.maxEnergy - cost.minEnergy).toBe(
          cost.span.max - cost.span.min,
        );
        expect(cost.minHunger).toBe(cost.span.min * cost.hungerPerTurn);
        expect(cost.maxHunger).toBe(cost.span.max * cost.hungerPerTurn);
      }
    }
  });
});
