import { describe, expect, it } from 'vitest';

import { resolveAction } from '../actions';
import { finishGame, surrenderGame } from '../end-state';
import { resolveRandomEvents } from '../events';
import { applyThreat } from '../threat';
import type { GameCoreState, PlayingGameState } from '..';
import { createCoreState } from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

/**
 * Estado vivo para las pruebas de `surrenderGame`: la función acepta el estado
 * completo porque quien la llama tiene una partida en curso, y el cuerpo sin
 * `status` de `createCoreState` no sirve para eso.
 */
function createPlayingState(overrides: Partial<PlayingGameState> = {}) {
  return { ...createCoreState(), status: 'playing' as const, ...overrides };
}

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
    [51, 'raccoon', { food: 1 }],
    [59, 'raccoon', { food: 1 }],
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

  it('saquea una cantidad fija en vez de vaciar el depósito', () => {
    // Vaciarlo era una ruina económica: mataba a todos por igual y en el mismo
    // turno, así que decidía la partida antes de que la estrategia tuviera nada
    // que decir. Robar una cantidad fija golpea a quien tiene el depósito lleno,
    // que es una decisión, y deja sobrevivir a quien juega con poco.
    const state = createCoreState({ difficulty: 'agony', food: 12 });
    const random = sequenceRandomInt([55]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.state.food).toBe(9);
  });

  it('saca más comida conforme sube la carga', () => {
    // Carga 10 abre tres tiradas por turno, así que la secuencia lleva tres
    // valores: el primero saca y los dos siguientes no sacan nada.
    const bajo = sequenceRandomInt([55]);
    const alto = sequenceRandomInt([55, 60, 60]);

    const atZero = resolveRandomEvents(
      createCoreState({ difficulty: 'agony', food: 20 }),
      bajo.randomInt,
    );
    const atTen = resolveRandomEvents(
      createCoreState({ difficulty: 'agony', food: 20, threat: 10 }),
      alto.randomInt,
    );

    expect(atZero.state.food).toBe(17);
    expect(atTen.state.food).toBe(14);
  });

  it('no baja de cero el saqueo aunque el depósito sea más pequeño', () => {
    const state = createCoreState({ difficulty: 'agony', food: 1, threat: 10 });
    const random = sequenceRandomInt([55, 60, 60]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.state.food).toBe(0);
  });

  it('cobra el recargo de energía una sola vez por turno, no uno por evento', () => {
    // Esta es la fractura que rompía Agonía. Con tres tiradas y un recargo por
    // evento, el peor turno costaba 3 de energía contra un descanso que devolvía
    // 1: encadenaba sola, porque la tormenta tiraba el refugio, sin refugio
    // descansar ya no rendía, y la partida se caía sin turno en el que decidir.
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
      threat: 10,
    });
    const random = sequenceRandomInt([1, 1, 1]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.events).toHaveLength(3);
    expect(result.state.energy).toBe(4);
  });

  it('no gasta el recargo del turno un meteorito que llega después de la tormenta', () => {
    // El meteorito no cuesta energía. Si consumiera el recargo, el jugador pagaría
    // por algo que la interfaz no le había cobrado.
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
      threat: 4,
    });
    const random = sequenceRandomInt([5, 99]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.events).toEqual([{ type: 'storm' }, { type: 'meteorite' }]);
    expect(result.state.energy).toBe(4);
  });

  it('deja pasar el recargo a un evento sin coste cuando la carga es 0', () => {
    // Con carga 0 el recargo no existe, así que la marca de turno no se consume y
    // un evento de carga 1 posterior del mismo turno sí puede cobrarlo. En la
    // práctica no se da (la carga sube al final del turno), pero fija que la
    // marca no se gasta sola.
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
      threat: 0,
    });
    const random = sequenceRandomInt([5]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.state.energy).toBe(5);
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
    // Dos tormentas: la primera quita el refugio y cobra el recargo del turno,
    // la segunda vuelve a quitar un refugio que ya no está.
    const state = createCoreState({
      difficulty: 'agony',
      energy: 5,
      hasShelter: true,
      threat: 4,
    });
    const random = sequenceRandomInt([5, 5]);

    const result = resolveRandomEvents(state, random.randomInt);

    expect(result.events).toEqual([{ type: 'storm' }, { type: 'storm' }]);
    // La segunda tormenta no vuelve a cobrar: el recargo es del turno, no del
    // evento. Con un punto menos de energía por tormenta, dos tormentas seguidas
    // costarían 2 y este turno sería una trampa invisible.
    expect(result.state).toMatchObject({ hasShelter: false, energy: 4 });
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
    { hunger: 9, energy: 10, health: 10 },
    { hunger: 9, energy: 10, health: 1 },
  ])('mantiene activa una partida que no viola el bucle: %o', (values) => {
    const state = createCoreState(values);

    expect(finishGame(state)).toEqual({
      ...state,
      status: 'playing',
    });
  });

  it.each([-1, -4])('mata por salud cuando las heridas la dejan en %i', (health) => {
    // El daño no siempre cae de uno en uno: explorar quita de 2 a 5 según la
    // carga. Con igualdad exacta en el cierre, a partir de la carga 8 quien
    // bajara de cero seguía vivo con salud negativa y la barra dejaba de ser un
    // presupuesto.
    const state = createCoreState({ hunger: 9, energy: 10, health, turn: 8 });

    expect(finishGame(state)).toEqual({
      ...state,
      status: 'dead',
      end: { condition: 'health', reportedCause: 'health', turnsSurvived: 7 },
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

  it('aplica el evento de Agonía sobre el estado de la acción', () => {
    const state = createCoreState({ difficulty: 'agony' });
    const random = sequenceRandomInt([99]);

    // Comer sin comida no tira nada, así que la única tirada que se ve aquí es
    // la del evento: el meteorito quita salud sin haber gastado turno la acción.
    const action = resolveAction(state, 'eat', random.randomInt);
    const event = resolveRandomEvents(action.state, random.randomInt);
    const threat = applyThreat(event.state);
    const finished = finishGame(threat.state);

    expect(finished).toMatchObject({
      status: 'playing',
      turn: 2,
      health: 9,
      threat: 0,
    });
    expect(threat.notice).toBeNull();
    expect(random.calls).toEqual([{ min: 1, max: 100 }]);
  });
});

describe('surrenderGame', () => {
  it('termina la partida declarando que fue decisión del jugador', () => {
    const state = createPlayingState({
      turn: 5,
      hunger: 7,
      energy: 2,
      health: 3,
    });

    const result = surrenderGame(state);

    expect(result).toEqual({
      ...state,
      status: 'dead',
      end: {
        condition: 'surrender',
        reportedCause: 'surrender',
        turnsSurvived: 4,
      },
    });
  });

  it('no toca los recursos: rendirse no mata a nadie', () => {
    const state = createPlayingState({
      turn: 2,
      hunger: 0,
      energy: 10,
      food: 3,
      health: 10,
      hasShelter: true,
      threat: 2,
    });

    const result = surrenderGame(state);

    // Ni un solo punto menos en ninguna columna, y el nivel se queda donde
    // estaba: la escalada no avanza porque no se ha jugado un turno.
    expect(result).toMatchObject({
      hunger: 0,
      energy: 10,
      food: 3,
      health: 10,
      hasShelter: true,
      threat: 2,
    });
  });

  it('cuenta los mismos turnos que una muerte en el mismo punto', () => {
    // El recuento no distingue por qué se acabó, así que un jugador que se
    // rinde en el turno 5 y otro que muere de hambre en el turno 5 declaran lo
    // mismo: cuatro turnos completados.
    const state = createPlayingState({ turn: 5, hunger: 11, energy: 5 });
    const deadByHunger = finishGame(state);

    expect(deadByHunger.status).toBe('dead');
    expect(deadByHunger.status === 'dead' && deadByHunger.end).toMatchObject({
      turnsSurvived: 4,
    });
    expect(surrenderGame(state).end.turnsSurvived).toBe(4);
  });

  it('no muta el estado de entrada', () => {
    const state = createPlayingState({ turn: 3, hasShelter: true });
    const original = { ...state };

    surrenderGame(state);

    expect(state).toEqual(original);
  });
});
