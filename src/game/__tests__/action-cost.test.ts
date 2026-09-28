import { describe, expect, it } from 'vitest';

import { actionCost, actionTurns } from '../action-cost';
import { hungerPerTurn, REPAIR_TURNS } from '../threat';
import type { GameAction } from '../types';

const everyAction: ReadonlyArray<GameAction> = [
  'explore',
  'eat',
  'cure',
  'rest',
  'repair',
];

describe('hungerPerTurn', () => {
  it('es 1 sin escalada y sube con la carga', () => {
    expect(hungerPerTurn(0)).toBe(1);
    expect(hungerPerTurn(1)).toBe(1);
    expect(hungerPerTurn(2)).toBe(1);
    expect(hungerPerTurn(3)).toBe(2);
    expect(hungerPerTurn(6)).toBe(3);
    // Carga 10: el extra de hambre es su tope, 3, y el gasto queda en 4.
    expect(hungerPerTurn(10)).toBe(4);
  });

  it('queda fuera de dominio con una amenaza negativa, igual que el extra', () => {
    // `applyThreat` solo sube desde 0, asi que una amenaza negativa no existe en
    // el juego. Se documenta el comportamiento en vez de añadir un recorte que
    // `extraHungerPerTurn` no tiene, para que las dos reglas se comporten igual.
    expect(hungerPerTurn(-3)).toBe(0);
  });
});

describe('actionTurns', () => {
  it.each(['explore', 'eat', 'cure', 'rest'] as const)(
    'fija %s en un solo turno',
    (action) => {
      expect(actionTurns(action)).toBe(1);
    },
  );

  it('manda reparar a dos turnos', () => {
    expect(actionTurns('repair')).toBe(REPAIR_TURNS);
    expect(REPAIR_TURNS).toBe(2);
  });

  it('no depende de la escalada, así que el jugador la ve antes de elegir', () => {
    // Ninguna acción cuelga del azar: el precio se enuncia y es el que va a pasar.
    // Existió un rango porque pescar podía costar de 1 a 6 turnos, y obligaba a
    // prometer el peor caso porque el motor no garantizaba el resto.
    const sinEscalada = everyAction.map((action) => actionTurns(action));

    for (const action of everyAction) {
      for (const threat of [0, 1, 5, 10]) {
        expect(sinEscalada).toContain(actionTurns(action));
        expect(actionCost(action, threat).turns).toBe(actionTurns(action));
      }
    }
  });
});

describe('actionCost', () => {
  it.each(['explore', 'eat', 'cure', 'rest'] as const)(
    'cobra un turno de %s',
    (action) => {
      for (const threat of [0, 2, 6, 10]) {
        const cost = actionCost(action, threat);

        expect(cost.turns).toBe(1);
        expect(cost.hungerPerTurn).toBe(hungerPerTurn(threat));
        expect(cost.hunger).toBe(hungerPerTurn(threat));
        expect(cost.energy).toBe(1);
      }
    },
  );

  it('escala solo el hambre de reparar, no sus turnos', () => {
    // Reparar sigue costando 2 de energía sea cual sea la escalada; lo único que
    // endurece es el hambre, que sube porque sube el ritmo del turno.
    for (const threat of [0, 5, 10]) {
      const cost = actionCost('repair', threat);

      expect(cost.turns).toBe(REPAIR_TURNS);
      expect(cost.energy).toBe(REPAIR_TURNS);
      expect(cost.hunger).toBe(REPAIR_TURNS * hungerPerTurn(threat));
    }
  });

  it('mantiene la energia en un turno por turno y el hambre en el ritmo vigente', () => {
    for (const action of everyAction) {
      for (const threat of [0, 1, 2, 4, 7, 10]) {
        const cost = actionCost(action, threat);

        expect(cost.energy).toBe(cost.turns);
        expect(cost.hunger).toBe(cost.turns * cost.hungerPerTurn);
      }
    }
  });
});
