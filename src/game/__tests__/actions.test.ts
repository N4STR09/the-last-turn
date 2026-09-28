import { describe, expect, it } from 'vitest';

import { resolveAction } from '../actions';
import type { GameAction, GameCoreState } from '..';
import { createCoreState } from './test-state';
import { failIfRandomIntIsCalled, sequenceRandomInt } from './test-random';

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
  describe('explore', () => {
    it.each([1, 6])(
      'vuelve con 4 comidas y 2 de salud menos cuando la tirada es %i',
      (value) => {
        const state = createCoreState({ health: 10 });

        const { resolution, calls } = resolve(state, 'explore', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 9,
            food: 4,
            health: 8,
          }),
          outcome: { type: 'explore-rich', foodGained: 4, healthLost: 2 },
        });
        expect(calls).toEqual([{ min: 1, max: 20 }]);
      },
    );

    it.each([7, 16])(
      'vuelve con 2 comidas y 1 de salud menos cuando la tirada es %i',
      (value) => {
        const state = createCoreState({ health: 10 });

        const { resolution, calls } = resolve(state, 'explore', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 9,
            food: 2,
            health: 9,
          }),
          outcome: { type: 'explore-find', foodGained: 2, healthLost: 1 },
        });
        expect(calls).toEqual([{ min: 1, max: 20 }]);
      },
    );

    it.each([17, 20])(
      'vuelve sin nada y sin heridas cuando la tirada es %i',
      (value) => {
        const state = createCoreState({ food: 2, health: 10 });

        const { resolution, calls } = resolve(state, 'explore', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 9,
            food: 2,
            health: 10,
          }),
          outcome: { type: 'explore-empty' },
        });
        expect(calls).toEqual([{ min: 1, max: 20 }]);
      },
    );

    it('deja la salud en negativo antes de que la mate el cierre, sin recortarla', () => {
      // El motor no decide la muerte: la decide `finishGame` con la salud en cero
      // o menos. Si explorar recortase aquí, el jugador vería 1 y la partida
      // seguiría, y eso sería mentir sobre lo que ha costado la exploración.
      const state = createCoreState({ health: 1 });

      const { resolution } = resolve(state, 'explore', [1]);

      expect(resolution.state.health).toBe(-1);
    });
  });

  describe('cure', () => {
    it('gasta 2 comidas y devuelve lo que abrió el hallazgo grande', () => {
      // Con carga 0 el hallazgo grande abre 2, así que cerrar sale a 2. Es el
      // suelo: sin salud que recuperar, cerrar las heridas no cura.
      const state = createCoreState({ food: 5, health: 3 });

      const { resolution, calls } = resolve(state, 'cure');

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 3,
          health: 5,
        }),
        outcome: { type: 'cure-done', foodSpent: 2, healthRecovered: 2 },
      });
      // No tira dado: el precio y el efecto son fijos, así que no hay nada que
      // sortear y la interfaz no tiene nada que adivinar.
      expect(calls).toEqual([]);
    });

    it('no sube del techo del cuerpo aunque le sobre recuperación', () => {
      const state = createCoreState({ food: 5, health: 8 });

      const { resolution } = resolve(state, 'cure');

      expect(resolution.outcome).toEqual({
        type: 'cure-done',
        foodSpent: 2,
        healthRecovered: 2,
      });
      expect(resolution.state.health).toBe(10);
    });

    it('gasta la comida aunque esté a la tope, y lo dice en cero recuperado', () => {
      const state = createCoreState({ food: 5, health: 10 });

      const { resolution } = resolve(state, 'cure');

      expect(resolution.outcome).toEqual({
        type: 'cure-done',
        foodSpent: 2,
        healthRecovered: 0,
      });
      expect(resolution.state).toMatchObject({ food: 3, health: 10 });
    });

    it('mantiene el coste cruel cuando no hay comida para las vendas', () => {
      const state = createCoreState({ food: 1, health: 3 });

      const { resolution, calls } = resolve(state, 'cure');

      expect(resolution).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 9,
          food: 1,
          health: 3,
        }),
        outcome: { type: 'cure-no-food' },
      });
      expect(calls).toEqual([]);
    });

    it('trata la comida negativa como ausencia de comida', () => {
      const state = createCoreState({ food: -1, health: 3 });

      const { resolution } = resolve(state, 'cure');

      expect(resolution.outcome).toEqual({ type: 'cure-no-food' });
      expect(resolution.state).toMatchObject({ food: -1, health: 3 });
    });
  });

  describe('rest', () => {
    it('sin refugio devuelve exactamente lo que cuesta el turno, y sin tirar dado', () => {
      // El refugio multiplica, no habilita: perderlo duele pero no es una
      // sentencia. Antes devolvía 0, y en Agonía eso era una fractura.
      const state = createCoreState({ energy: 7 });

      const result = resolveAction(state, 'rest', failIfRandomIntIsCalled());

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 1,
          energy: 7,
        }),
        outcome: {
          type: 'rest-without-shelter',
          energyRecovered: 1,
        },
      });
    });

    it.each([1, 2])(
      'recupera 2 de energía con refugio cuando la tirada es %i',
      (value) => {
        const state = createCoreState({ energy: 7, hasShelter: true });

        const { resolution, calls } = resolve(state, 'rest', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 8,
            hasShelter: true,
          }),
          outcome: { type: 'rest-shelter-success', energyRecovered: 2 },
        });
        expect(calls).toEqual([{ min: 1, max: 10 }]);
      },
    );

    it.each([3, 10])(
      'recupera 4 de energía con refugio cuando la tirada es %i',
      (value) => {
        const state = createCoreState({ energy: 7, hasShelter: true });

        const { resolution, calls } = resolve(state, 'rest', [value]);

        expect(resolution).toEqual({
          state: createCoreState({
            turn: 2,
            hunger: 1,
            energy: 10,
            hasShelter: true,
          }),
          outcome: { type: 'rest-shelter-success', energyRecovered: 4 },
        });
        expect(calls).toEqual([{ min: 1, max: 10 }]);
      },
    );

    it('no cura salud, porque esa es la función de curar las heridas', () => {
      // Si descansar curara, la barra de salud dejaría de ser un presupuesto: se
      // rellenaría solo en los turnos muertos en los que no compite por la comida.
      const state = createCoreState({ energy: 7, health: 2, hasShelter: true });

      const { resolution } = resolve(state, 'rest', [10]);

      expect(resolution.state.health).toBe(2);
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

  describe('eat', () => {
    it('consume una comida y reduce el hambre, sin tocar la salud', () => {
      // Comer no cura. Si curara, curar las heridas sería siempre la opción
      // dominante y la barra de salud dejaría de ser una decisión.
      const state = createCoreState({ food: 5, hunger: 2, health: 6 });

      const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

      expect(result).toEqual({
        state: createCoreState({
          turn: 2,
          hunger: 0,
          energy: 9,
          food: 4,
          health: 6,
        }),
        outcome: {
          type: 'eat-consumed',
          foodConsumed: 1,
          hungerReduced: 2,
        },
      });
    });

    it('mantiene el coste cruel cuando no hay comida', () => {
      const state = createCoreState({ food: 0, hunger: 2 });

      const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

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

      const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

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
        },
      });
    });

    it('trata la comida negativa como ausencia de comida', () => {
      const state = createCoreState({ food: -1, hunger: 3 });

      const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

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

describe('con escalada de amenaza', () => {
  it('cobra un punto de hambre extra por turno al explorar', () => {
    const state = createCoreState({ threat: 4 });

    const { resolution } = resolve(state, 'explore', [7]);

    expect(resolution.state).toMatchObject({ turn: 2, hunger: 2, energy: 9 });
  });

  it('escala el hambre hasta el tope de carga sin pasarse', () => {
    const atTen = resolve(createCoreState({ threat: 10 }), 'explore', [7]);
    const aboveCap = resolve(createCoreState({ threat: 40 }), 'explore', [7]);

    expect(atTen.resolution.state.hunger).toBe(4);
    expect(aboveCap.resolution.state.hunger).toBe(4);
  });

  it('topa la recuperación al descansar con carga alta', () => {
    const state = createCoreState({
      energy: 1,
      hasShelter: true,
      threat: 9,
    });

    const { resolution } = resolve(state, 'rest', [10]);

    expect(resolution.outcome).toEqual({
      type: 'rest-shelter-success',
      energyRecovered: 3,
    });
    // Recupera 3 y gasta 1: sigue ganando algo, porque el suelo del tope es 3.
    expect(resolution.state.energy).toBe(3);
  });

  it('respeta la tirada baja aunque la amenaza ponga un tope mas alto', () => {
    const state = createCoreState({
      energy: 1,
      hasShelter: true,
      threat: 3,
    });

    const { resolution } = resolve(state, 'rest', [1]);

    expect(resolution.outcome).toEqual({
      type: 'rest-shelter-success',
      energyRecovered: 2,
    });
  });

  it('devuelve con las heridas lo que abrió el hallazgo grande, también en carga alta', () => {
    // Carga 8: el hallazgo grande abre 4, y cerrar devuelve 4. Antes devolvía 2
    // con escalera propia, así que el hallazgo grande costaba el doble de comida
    // por punto de salud que el pequeño y explorar tenía una opción peor.
    const state = createCoreState({ food: 5, health: 2, threat: 8 });

    const { resolution } = resolve(state, 'cure');

    expect(resolution.outcome).toEqual({
      type: 'cure-done',
      foodSpent: 2,
      healthRecovered: 4,
    });
    expect(resolution.state.health).toBe(6);
  });

  it('estrecha las dos ventanas de explorar con la carga', () => {
    // Carga 6: el hallazgo grande cae a 3 de 20 y el normal sube a 13, así que una
    // tirada de 4, que a carga 0 era el hallazgo grande, pasa a ser el normal.
    const state = createCoreState({ threat: 6, health: 10 });

    const { resolution } = resolve(state, 'explore', [4]);

    expect(resolution.outcome).toEqual({
      type: 'explore-find',
      foodGained: 2,
      healthLost: 1,
    });
  });

  it('deja pasar el hallazgo grande incluso en carga máxima', () => {
    // A carga 10 el hallazgo grande es solo la tirada 1, pero no desaparece: si
    // cerrara del todo, explorar sería solo un castigo y no habría nada que decidir.
    const state = createCoreState({ threat: 10, health: 10 });

    const { resolution } = resolve(state, 'explore', [1]);

    expect(resolution.outcome).toEqual({
      type: 'explore-rich',
      foodGained: 4,
      healthLost: 5,
    });
  });

  it('agranda la herida del hallazgo grande con la carga', () => {
    const state = createCoreState({ threat: 10, health: 10 });

    const { resolution } = resolve(state, 'explore', [1]);

    // A carga 10 el hallazgo grande arranca 5 de salud: al final del juego la
    // comida vale más que la piel, y esa es la cuenta que hay que hacer.
    expect(resolution.outcome).toMatchObject({ healthLost: 5 });
    expect(resolution.state.health).toBe(5);
  });

  it('hace fallar reparaciones que antes nunca fallaban', () => {
    const state = createCoreState({ threat: 4 });

    const { resolution } = resolve(state, 'repair', [3]);

    expect(resolution.outcome).toEqual({ type: 'repair-failed' });
  });

  it('deja pasar la tirada 10 al reparar en carga máxima', () => {
    const state = createCoreState({ threat: 10 });

    const { resolution } = resolve(state, 'repair', [10]);

    expect(resolution.outcome).toEqual({ type: 'repair-succeeded' });
  });

  it('mantiene la tirada 5 como la única fallona con carga 0', () => {
    const fails = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
      (value) =>
        resolve(createCoreState(), 'repair', [value]).resolution.outcome.type ===
        'repair-failed',
    );

    expect(fails).toEqual([5]);
  });

  it('mantiene el coste de dos turnos al reparar en carga alta', () => {
    // Antes costaba hasta 5 y la interfaz tenía que prometer el peor caso. Fijado
    // en 2, el precio se ve entero antes de pulsar.
    const state = createCoreState({ threat: 7 });

    const { resolution } = resolve(state, 'repair', [1]);

    // Carga 7: 2 turnos a 3 de hambre cada uno. Solo el hambre se endurece.
    expect(resolution.state).toMatchObject({ turn: 3, hunger: 6, energy: 8 });
  });

  it('escala el alivio de la ración con la carga para que comer siga tapando el gasto', () => {
    // Carga 4 la ración quita 6 en lugar de 4, y el turno cuesta 2: comer deja
    // el hambre 4 por debajo. La holgura crece con la escalada, que es lo que
    // mantiene el sumidero de calorías dentro del presupuesto de turnos.
    const state = createCoreState({ threat: 4, food: 2, hunger: 5 });

    const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

    expect(result.outcome).toEqual({
      type: 'eat-consumed',
      foodConsumed: 1,
      hungerReduced: 4,
    });
    expect(result.state.hunger).toBe(1);
  });

  it('mantiene el relief base con carga 0', () => {
    const state = createCoreState({ threat: 0, food: 2, hunger: 8 });

    const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

    expect(result.outcome).toMatchObject({ hungerReduced: 3 });
    expect(result.state.hunger).toBe(5);
  });

  it('informa de la reducción real aunque el suelo en cero la recorte', () => {
    // Carga 10: la ración quita 10 y el turno cuesta 4, así que el balance neto
    // es de 6 puntos, pero si el hambre inicial es menor el suelo en cero manda.
    const state = createCoreState({ threat: 10, food: 2, hunger: 2 });

    const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

    expect(result.outcome).toMatchObject({ hungerReduced: 2 });
    expect(result.state.hunger).toBe(0);
  });

  it('no puede dejar el resultado de comer por debajo de cero', () => {
    const state = createCoreState({ food: 1, hunger: 0 });

    const result = resolveAction(state, 'eat', failIfRandomIntIsCalled());

    expect(result.state.hunger).toBe(0);
    expect(result.outcome).toMatchObject({ hungerReduced: 0 });
  });
});
