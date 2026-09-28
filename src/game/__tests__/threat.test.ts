import { describe, expect, it } from 'vitest';

import {
  applyThreat,
  BASE_FOOD_RELIEF,
  CURE_FOOD_COST,
  cureAmount,
  extraEventRolls,
  extraHungerPerTurn,
  exploreFindLimit,
  exploreRichLimit,
  exploreWound,
  foodRaid,
  foodRelief,
  MAX_THREAT_LOAD,
  repairDemolishesShelter,
  repairFailureRadius,
  REPAIR_TURNS,
  REST_ENERGY_WITHOUT_SHELTER,
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
  it('extrae el hambre extra por turno, con freno en 4', () => {
    const table = Array.from({ length: 11 }, (_, load) =>
      extraHungerPerTurn(load),
    );

    expect(table).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3]);
    // El freno importa. Con `min(6, ⌊carga/2⌋)` el hambre por turno llegaba a 7
    // mientras una ración quitaba 10, el sumidero de calorías se comía el
    // presupuesto entero de turnos hacia la carga 6 y la partida dejaba de ser
    // renewable: el techo absoluto medido se quedaba en el turno 97.
    expect(extraHungerPerTurn(MAX_THREAT_LOAD)).toBeLessThanOrEqual(4);
  });

  it('baja el tope de energía al descansar, pero nunca hasta la neutralidad', () => {
    const table = Array.from({ length: 11 }, (_, load) => restEnergyCap(load));

    expect(table).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3]);
    // Descansar con refugio siempre devuelve más de lo que cuesta el turno. Con
    // un tope de 2 el descanso era un impuesto en carga alta —neto +1— y la
    // energía se iba de rositas en silencio.
    expect(restEnergyCap(MAX_THREAT_LOAD)).toBeGreaterThan(2);
  });

  it('hace que sin refugio descansar sea exactamente neutro', () => {
    // El refugio multiplica, no habilita: perderlo duele pero no es una
    // sentencia. Antes devolvía 0 y en Agonía eso era una fractura.
    expect(REST_ENERGY_WITHOUT_SHELTER).toBe(1);
  });

  it('curar paga exactamente lo que abre el hallazgo grande', () => {
    const table = Array.from({ length: 11 }, (_, load) => cureAmount(load));

    // Con escaleras separadas, a carga 6 el hallazgo grande costaba 4 de salud y
    // cerrar las heridas devolvía 3: el premio grande salía a 1 de comida por
    // punto de salud y el hallazgo pequeño, a 2. Explorar tenía una opción
    // claramente peor que la otra, que es justo lo contrario de una decisión.
    expect(table).toEqual([2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5]);
    for (const load of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(cureAmount(load)).toBe(exploreWound(load));
    }
    expect(cureAmount(MAX_THREAT_LOAD)).toBeGreaterThanOrEqual(2);
  });

  it('hace que cerrar heridas cueste más que una ración', () => {
    expect(CURE_FOOD_COST).toBe(2);
  });

  it('estrecha las dos ventanas de explorar con la carga', () => {
    const rich = Array.from({ length: 11 }, (_, load) => exploreRichLimit(load));
    const find = Array.from({ length: 11 }, (_, load) => exploreFindLimit(load));

    expect(rich).toEqual([6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2]);
    expect(find).toEqual([16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11]);
    // El hallazgo grande nunca desaparece del todo, y el hallazgo normal nunca
    // deja de ser la mitad de la tirada: explorar siempre puede rentar.
    expect(exploreRichLimit(MAX_THREAT_LOAD)).toBeGreaterThanOrEqual(2);
    expect(exploreFindLimit(MAX_THREAT_LOAD)).toBeGreaterThan(
      exploreRichLimit(MAX_THREAT_LOAD),
    );
  });

  it('agranda la herida del hallazgo grande con la carga', () => {
    const table = Array.from({ length: 11 }, (_, load) => exploreWound(load));

    expect(table).toEqual([2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5]);
  });

  it('agranda el saqueo del mapache con la carga, con suelo 2', () => {
    const table = Array.from({ length: 11 }, (_, load) => foodRaid(load));

    expect(table).toEqual([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6]);
    expect(foodRaid(MAX_THREAT_LOAD)).toBeGreaterThanOrEqual(2);
  });

  it('añade tiradas de evento solo en Agonía alta', () => {
    const table = Array.from({ length: 11 }, (_, load) => extraEventRolls(load));

    expect(table).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
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

  it('derriba el refugio al fallar la reparacion desde la carga 1', () => {
    // La regla que rellena el primer escalón de la rampa. Solo puede dispararse
    // sobre una tirada que ya era un fallo, así que no añade coste esperado: es la
    // diferencia entre la curva de L1 y la de L0, cero modificadores antes.
    const table = Array.from({ length: 12 }, (_, threat) =>
      repairDemolishesShelter(threat),
    );

    expect(table).toEqual([
      false, true, true, true, true, true, true, true, true, true, true, true,
    ]);
  });

  it('fija el coste de reparar en dos turnos, sin escala', () => {
    // Reparar costaba de 2 a 5 turnos según la carga, y eso obligaba a la
    // interfaz a prometer el peor caso porque el motor no garantizaba el resto.
    // Fijarlo es lo que hace su coste comunicable antes de pulsarlo.
    expect(REPAIR_TURNS).toBe(2);
  });

  it('escala el alivio de la ración al doble que el gasto del turno', () => {
    const table = Array.from({ length: 11 }, (_, load) => foodRelief(load));

    expect(table).toEqual([4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10]);
  });

  it('reproduce el relieve base de la Fase 1 con carga 0, 1 y 2', () => {
    expect(BASE_FOOD_RELIEF).toBe(4);
    expect(foodRelief(0)).toBe(BASE_FOOD_RELIEF);
    expect(foodRelief(1)).toBe(BASE_FOOD_RELIEF);
    expect(foodRelief(2)).toBe(BASE_FOOD_RELIEF);
  });

  it('queda por encima del hambre que cuesta el turno en toda la rampa', () => {
    // Sin esto la partida deja de ser superable a partir de la carga 4: la
    // racion costaria mas hambre de la que devuelve. Ver D-01 en SPEC-threat.md.
    for (let threat = 0; threat <= 40; threat += 1) {
      const hungerPerTurn = 1 + extraHungerPerTurn(threat);
      expect(foodRelief(threat)).toBeGreaterThan(hungerPerTurn);
    }
  });

  it('una ración cubre cada vez más turnos, que es lo que la hace invertible', () => {
    // La holgura por ración es `foodRelief - hungerPerTurn`: los turnos que una
    // comida compra por encima de lo que cuesta vivir. Con el extra entrando al
    // mismo ritmo en las dos reglas, esa holgura se quedaba en 3 para siempre y
    // la fracción de turnos dedicada a comer no bajaba nunca con la carga: el
    // presupuesto se cerraba solo hacia la carga 6 y la partida no era
    // renewable. Al doblarlo, la holgura crece con la escalada.
    const table = Array.from({ length: 11 }, (_, load) => {
      const gasto = 1 + extraHungerPerTurn(load);
      return foodRelief(load) - gasto;
    });

    expect(table).toEqual([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6]);
    expect(table[0]).toBe(BASE_FOOD_RELIEF - 1);
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
