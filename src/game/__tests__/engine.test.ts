import { describe, expect, it } from 'vitest';

import { finishGame } from '../end-state';
import { createGame, resolveTurn } from '..';
import type {
  Difficulty,
  GameAction,
  GameState,
  PlayingGameState,
} from '..';
import { createCoreState } from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

function createPlayingState(
  difficulty: Difficulty,
  overrides: Partial<PlayingGameState> = {},
): PlayingGameState {
  return { ...createGame(difficulty), ...overrides };
}

/**
 * Piloto que seguiría una persona, no una optimum.
 *
 * Las dos guardas no son decoración. Sin reparar cuando la tormenta se lleva el
 * refugio, `rest` pasa a ser neto 0 y la partida se cuelga dormida; sin explorar
 * cuando no hay comida, los turnos se van en `eat` sin raciones. Con cualquiera de
 * las dos faltas, la ruta muere en el 16 por mucho que el motor esté bien: mide al
 * piloto, no al juego.
 */
function competentAction(state: PlayingGameState): GameAction {
  if (!state.hasShelter) return 'repair';
  if (state.food === 0) return 'explore';
  if (state.health < 4 && state.food >= 4) return 'cure';
  if (state.energy < 5) return 'rest';
  if (state.hunger >= 3 && state.food >= 2) return 'eat';
  return 'explore';
}

/** Mejor azar posible en cada dado: el techo de lo que el diseño permite. */
function bestLuck(_min: number, max: number): number {
  // La tirada de evento devuelve 50 para que no salga ninguno: en Normal no se
  // tira, y en Agonía el techo no debe depender de la suerte con la tormenta.
  if (max === 100) return 50;
  // Explorar tira a d20 y el techo es que salga siempre el hallazgo grande.
  if (max === 20) return 1;
  return max;
}

describe('resolveTurn', () => {
  it('resuelve una acción en Normal sin tirar el azar de evento', () => {
    const state = createPlayingState('normal');
    const random = failIfRandomIntIsCalled();

    // Comer sin comida es la acción que no tira nada: deja verificar que en
    // Normal tampoco se tira el azar del evento.
    const result = resolveTurn(state, 'eat', random);

    expect(result).toEqual({
      state: {
        ...state,
        status: 'playing',
        turn: 2,
        hunger: 1,
        energy: 9,
      },
      actionOutcome: { type: 'eat-no-food' },
      randomEvents: [],
      threatNotice: null,
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
        // Reparar ya no hiere: es la única acción que no toca la salud, y la que
        // solo paga con tiempo. Lo único que la baja aquí es el meteorito.
        health: 9,
        hasShelter: true,
        threat: 0,
      },
      actionOutcome: { type: 'repair-succeeded' },
      randomEvents: [{ type: 'meteorite' }],
      threatNotice: null,
    });
    expect(random.calls).toEqual([
      { min: 1, max: 10 },
      { min: 1, max: 100 },
    ]);
  });

  it('emite el aviso de escalada en el turno 10', () => {
    const state = createPlayingState('normal', { turn: 9 });
    const random = sequenceRandomInt([1]);

    const result = resolveTurn(state, 'explore', random.randomInt);

    expect(result.threatNotice).toEqual({ threat: 1, load: 1 });
    expect(result.state).toMatchObject({ turn: 10, threat: 1, food: 4 });
  });

  it('una acción de dos turnos avisa una sola vez y queda en el nivel del turno en que acaba', () => {
    // Antes este caso lo cruzaba la pesca, que costaba hasta seis turnos. Ya no
    // hay ninguna acción que pueda saltarse un umbral entero: la más larga es
    // reparar, con dos turnos, y entre umbrales hay al menos diez. El salto de
    // varios niveles de una vez vive solo en `applyThreat`, y ahí está probado.
    // Lo que queda aquí es que una acción multiturno avisa una vez y no dos, y
    // que el nivel se toma del turno en que termina y no del punto de partida.
    const state = createPlayingState('normal', { turn: 20, threat: 1, energy: 10 });

    const result = resolveTurn(state, 'repair', sequenceRandomInt([1]).randomInt);

    expect(result.state.turn).toBe(22);
    expect(result.state.threat).toBe(2);
    expect(result.threatNotice).toEqual({ threat: 2, load: 2 });
  });

  it('aumenta el nivel sin volver a avisar en el mismo escalón', () => {
    const state = createPlayingState('normal', { turn: 10, threat: 1 });
    const random = failIfRandomIntIsCalled();

    const result = resolveTurn(state, 'eat', random);

    expect(result.threatNotice).toBeNull();
    expect(result.state.threat).toBe(1);
  });

  it('aplica la escalada tras el evento de Agonía', () => {
    const state = createPlayingState('agony', {
      turn: 29,
      hunger: 8,
      health: 10,
    });
    const random = sequenceRandomInt([1, 50]);

    const result = resolveTurn(state, 'repair', random.randomInt);

    expect(result.state).toMatchObject({
      status: 'playing',
      turn: 31,
      hunger: 10,
      energy: 8,
      threat: 2,
    });
    expect(result.randomEvents).toEqual([]);
    expect(result.threatNotice).toEqual({ threat: 2, load: 2 });
  });

  it('suprime el aviso cuando el mismo turno mata', () => {
    const state = createPlayingState('agony', {
      turn: 9,
      hunger: 10,
    });
    const random = sequenceRandomInt([1, 50]);

    const result = resolveTurn(state, 'explore', random.randomInt);

    expect(result.state.status).toBe('dead');
    expect(result.state.threat).toBe(1);
    expect(result.threatNotice).toBeNull();
  });

  it('mata por salud cuando la herida se pasa del cero', () => {
    // Explorar quita de 2 a 5 según la carga, así que la salud no siempre cae de
    // uno en uno. Con igualdad exacta en el cierre, quien bajara de cero seguía
    // vivo con salud negativa y la barra dejaba de ser un presupuesto.
    const state = createPlayingState('normal', {
      turn: 20,
      threat: 2,
      hunger: 1,
      energy: 8,
      health: 1,
    });

    const result = resolveTurn(state, 'explore', sequenceRandomInt([1]).randomInt);

    expect(result.state.status).toBe('dead');
    expect(
      result.state.status === 'dead' ? result.state.end : null,
    ).toMatchObject({
      condition: 'health',
      reportedCause: 'health',
    });
    expect(result.state.health).toBeLessThan(0);
  });

  it('recoge varios eventos cuando la carga añade tiradas', () => {
    const state = createPlayingState('agony', { turn: 4, threat: 4 });
    const random = sequenceRandomInt([5, 5]);

    const result = resolveTurn(state, 'eat', random.randomInt);

    expect(result.randomEvents).toEqual([
      { type: 'storm' },
      { type: 'storm' },
    ]);
    expect(random.calls).toEqual([
      { min: 1, max: 100 },
      { min: 1, max: 100 },
    ]);
  });

  it.each(['normal', 'agony'] as const)(
    'la partida sigue siendo renewable en %s con juego ordenado',
    (difficulty) => {
      let state: GameState = createGame(difficulty);

      state = resolveTurn(state, 'repair', bestLuck).state;

      for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
        if (state.status !== 'playing') break;
        state = resolveTurn(state, competentAction(state), bestLuck).state;
      }

      // Criterio de D-01 resuelto. Antes de la válvula de escape el techo
      // absoluto medido con este mismo piloto era el turno 97, y ninguna
      // combinación de los otros tres modificadores lo subía: la escalada no
      // tenía holgura y el sumidero de calorías se comía el presupuesto de
      // turnos hacia la carga 6. Con la válvula, el techo es 153 y la partida
      // vuelve a ser renewable por construcción, no por suerte del piloto.
      expect(state.turn).toBeGreaterThan(100);
    },
  );

  it('mantiene el techo absoluto por encima de todo el tramo escalonado', () => {
    // Medición cara, ejecutada aparte y registrada en SPEC-threat.md: con este
    // piloto y el mejor azar posible la partida llega a la carga 8 antes de
    // cerrarse por recursos. Aquí basta con fijar que el nivel 6, que es donde
    // el presupuesto de turnos se aprieta de verdad, es alcanzable.
    let state: GameState = createGame('normal');

    state = resolveTurn(state, 'repair', bestLuck).state;

    for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
      if (state.status !== 'playing') break;
      state = resolveTurn(state, competentAction(state), bestLuck).state;
      if (state.status === 'playing' && state.threat < 6) continue;
      break;
    }

    expect(state.status).toBe('playing');
    expect(state.threat).toBeGreaterThanOrEqual(6);
  });

  it('rechaza resolver una partida terminada sin consumir azar', () => {
    const deadState = finishGame(createCoreState({ hunger: 11 }));

    expect(() =>
      resolveTurn(deadState, 'eat', failIfRandomIntIsCalled()),
    ).toThrow('No se puede resolver una partida terminada.');
  });

  it('rechaza un resultado de RandomInt fuera de intervalo', () => {
    const state = createPlayingState('agony');
    const random = sequenceRandomInt([101]);

    expect(() => resolveTurn(state, 'eat', random.randomInt)).toThrow(
      RangeError,
    );
  });

  it('no muta el estado de entrada', () => {
    const state = createPlayingState('agony', { food: 2 });
    const originalState = { ...state };
    const random = sequenceRandomInt([1, 50]);

    resolveTurn(state, 'explore', random.randomInt);

    expect(state).toEqual(originalState);
  });
});
