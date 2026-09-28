import { describe, expect, it } from 'vitest';

import {
  actionCostLabel,
  createGameOverViewModel,
  createGameViewModel,
} from '../game-view-model';
import { createGame, MAX_HEALTH, resolveTurn } from '../../game';
import type { GameCoreState } from '../../game';

function createCoreState(overrides: Partial<GameCoreState> = {}): GameCoreState {
  return {
    difficulty: 'normal',
    turn: 1,
    hunger: 0,
    energy: 10,
    food: 0,
    health: 10,
    hasShelter: false,
    threat: 0,
    ...overrides,
  };
}

describe('createGameViewModel', () => {
  it('representa las cuatro cifras y el refugio aparte', () => {
    const model = createGameViewModel(createGame('normal'), null);

    expect(model.difficulty).toBe('normal');
    expect(model.turn).toBe(1);
    expect(model.stats.map((resource) => resource.id)).toEqual([
      'hunger',
      'energy',
      'food',
      'health',
    ]);
    expect(model.stats.map((resource) => resource.value)).toEqual([
      '0',
      '10',
      '0',
      '10',
    ]);
    expect(model.shelter).toEqual({
      label: 'Refugio',
      hasShelter: false,
      status: 'Destruido',
      tone: 'warning',
    });
    // La salud es la cuarta cifra, con su propio techo. Durante toda la fase
    // anterior fue el dato que el jugador no veía nunca, y explorar la volvió
    // una decisión: si no se puede ver, no se puede administrar.
    expect(model.stats.map((resource) => resource.label)).toContain('Salud');
  });

  it('da a la salud el techo del cuerpo, no el de las cifras', () => {
    const model = createGameViewModel(createGame('normal'), null);
    const byId = new Map(model.stats.map((resource) => [resource.id, resource]));

    // Las tres cifras comparten escala para que las filas queden alineadas. La
    // salud no: es una reserva con final, no un contador, y usa MAX_HEALTH.
    expect(byId.get('health')?.capacity).toBe(MAX_HEALTH);
    expect(byId.get('hunger')?.capacity).toBe(12);
    expect(byId.get('energy')?.capacity).toBe(12);
    expect(byId.get('food')?.capacity).toBe(12);
  });

  it('dice el refugio con una palabra entera en los dos estados', () => {
    const without = createGameViewModel(createGame('normal'), null);
    const with_ = createGameViewModel(
      { ...createGame('normal'), hasShelter: true },
      null,
    );

    // Ni cifra, ni «Presente» o «Ausente»: el refugio es un interruptor y su
    // estado se dice entero, en su propia línea.
    expect(without.shelter.status).toBe('Destruido');
    expect(without.shelter.hasShelter).toBe(false);
    expect(without.shelter.tone).toBe('warning');
    expect(with_.shelter.status).toBe('Construido');
    expect(with_.shelter.hasShelter).toBe(true);
    expect(with_.shelter.tone).toBe('positive');
  });

  it('traduce la acción y sus cambios, y no expone hitos', () => {
    const previous = createCoreState({
      difficulty: 'agony',
      turn: 14,
      hunger: 9,
      energy: 8,
      food: 2,
      hasShelter: true,
    });
    // Tirada 1 en el d20 da el hallazgo grande, tirada 50 en el d100 no saca
    // evento.
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'explore',
      (() => {
        const values = [1, 50];
        return () => values.shift() ?? 50;
      })(),
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('explore');
    expect(model.resolution?.headline).toBe(
      'Aguantas más de lo previsto y vuelves cargado.',
    );
    // La salud aparece entre los cambios: es lo que el hallazgo grande abre y lo
    // que el jugador tiene que decidir si puede permitirse.
    expect(model.resolution?.details).toEqual([
      'La exploración añade 4 comidas y te cuesta 2 de salud.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '+1', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '+4', tone: 'positive' },
      { id: 'health', label: 'Salud', value: '−2', tone: 'warning' },
    ]);
    expect(model.resolution?.events).toEqual([]);
  });

  it('recoge todos los eventos de la resolución', () => {
    const previous = createCoreState({
      difficulty: 'agony',
      turn: 4,
      threat: 4,
      hasShelter: true,
    });
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'eat',
      () => 5,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.events.map((event) => event.type)).toEqual([
      'storm',
      'storm',
    ]);
  });

  it('traduce comer una ración y sus cambios, y aclara que no cura', () => {
    const previous = createCoreState({ food: 1, hunger: 2, health: 6 });
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'eat',
      () => 1,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('eat');
    expect(model.resolution?.headline).toBe('Comes una ración.');
    // La segunda línea es la que separa las dos decisiones: bajar el hambre y
    // cerrarse las heridas pagan con la misma comida, así que la terminal tiene
    // que decir en voz alta que comer no es curar.
    expect(model.resolution?.details).toEqual([
      'Consumes 1 comida y reduces el hambre en 2.',
      'Comer no cura: para eso están las heridas.',
    ]);
    // La salud no se mueve al comer, y por eso no sale entre los cambios.
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '−2', tone: 'positive' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '−1', tone: 'warning' },
    ]);
  });

  it('traduce una exploración estéril sin añadir comida ni herir', () => {
    const previous = createCoreState();
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'explore',
      // Fuera de las dos ventanas con carga 0, que llegan hasta 16.
      () => 20,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('explore');
    expect(model.resolution?.headline).toBe('La exploración no te lleva a nada.');
    expect(model.resolution?.details).toEqual([
      'No encuentras comida, y al menos no te hiere.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '+1', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
    ]);
  });

  it('traduce cerrar las heridas y su gasto de comida', () => {
    const previous = createCoreState({ food: 5, health: 3 });
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'cure',
      () => 1,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('cure');
    expect(model.resolution?.headline).toBe('Te vendas las heridas.');
    expect(model.resolution?.details).toEqual([
      'Gastas 2 comidas y recuperas 2 de salud.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '+1', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '−2', tone: 'warning' },
      { id: 'health', label: 'Salud', value: '+2', tone: 'positive' },
    ]);
  });

  it('traduce los tres eventos de Agonía', () => {
    const cases = [
      [1, 'Tormenta', 'Tu refugio ha resultado dañado por las fuertes tormentas!'],
      [51, 'Mapache', 'Un mapache te ha robado tu comida!'],
      [99, 'Meteorito', 'Un meteorito te golpea y te deja herido.'],
    ] as const;

    for (const [value, headline, description] of cases) {
      const state = {
        ...createCoreState({ difficulty: 'agony' }),
        status: 'playing' as const,
      };
      const resolution = resolveTurn(
        state,
        'eat',
        () => value,
      );

      expect(
        createGameViewModel(resolution.state, resolution, state).resolution
          ?.events,
      ).toEqual([
        {
          type: value === 1 ? 'storm' : value === 51 ? 'raccoon' : 'meteorite',
          headline,
          description,
        },
      ]);
    }
  });
});

describe('actionCostLabel', () => {
  it('cobra un turno de hambre y uno de energia sin escalada', () => {
    for (const action of ['explore', 'eat', 'cure', 'rest'] as const) {
      expect(actionCostLabel(action, 0)).toBe('(+1 hambre, −1 energía)');
    }
  });

  it('sube el gasto de hambre de las acciones simples con la escalada', () => {
    // Carga 10: el turno cuesta 4 de hambre, no 1. El botón tiene que decirlo o
    // el jugador firma un coste que no es el real.
    expect(actionCostLabel('rest', 10)).toBe('(+4 hambre, −1 energía)');
    expect(actionCostLabel('explore', 4)).toBe('(+2 hambre, −1 energía)');
    // Carga 2 no sube todavía: el extra entra en 3.
    expect(actionCostLabel('explore', 2)).toBe('(+1 hambre, −1 energía)');
  });

  it('fija reparar en dos turnos para que su precio se vea entero', () => {
    // Antes costaba de 2 a 5 según la carga, y entonces el botón tenía que
    // prometer el peor caso porque el motor no garantizaba el resto. Fijado en
    // 2, solo cambia el ritmo de hambre.
    expect(actionCostLabel('repair', 0)).toBe('(+2 hambre, −2 energía)');
    expect(actionCostLabel('repair', 2)).toBe('(+2 hambre, −2 energía)');
    // Carga 4 son 2 turnos a 2 de hambre.
    expect(actionCostLabel('repair', 4)).toBe('(+4 hambre, −2 energía)');
    // Carga 10 son 2 turnos a 4 de hambre.
    expect(actionCostLabel('repair', 10)).toBe('(+8 hambre, −2 energía)');
  });

  it('no enuncia ningún peor caso, porque ninguna acción tiene coste azar', () => {
    // La pesca iba de 1 a 6 intentos, así que el botón solo podía prometer el
    // peor caso. Ya no hay ninguna acción cuyo precio dependa de una tirada: el
    // número que dice el botón es el que va a pasar.
    for (const action of ['explore', 'eat', 'cure', 'rest', 'repair'] as const) {
      for (const threat of [0, 5, 10]) {
        expect(actionCostLabel(action, threat)).not.toContain('hasta');
      }
    }
  });
});

describe('createGameViewModel', () => {
  it('publica el nivel de escalada vigente en el modelo', () => {
    const model = createGameViewModel(
      { ...createGame('normal'), turn: 40, threat: 3 },
      null,
    );

    expect(model.threat).toBe(3);
  });

  it('trae las cinco acciones con su gasto calculado contra la escalada', () => {
    const model = createGameViewModel(
      { ...createGame('agony'), turn: 90, threat: 5 },
      null,
    );

    // Cinco, no seis: rendirse no es una acción con coste sino la salida de la
    // partida, y por eso no pasa por la rejilla de gastos. El orden va por
    // recursos: primero lo que produce comida, después lo que la gasta, después
    // lo que sostiene la energía y al final lo que sostiene el techo.
    expect(model.actions.map((action) => action.id)).toEqual([
      'explore',
      'eat',
      'cure',
      'rest',
      'repair',
    ]);
    // Carga 5: el turno cuesta 2 de hambre. Solo reparar dura dos turnos.
    const costs = model.actions.map((action) => `${action.id} ${action.cost}`);
    expect(costs).toEqual([
      'explore (+2 hambre, −1 energía)',
      'eat (+2 hambre, −1 energía)',
      'cure (+2 hambre, −1 energía)',
      'rest (+2 hambre, −1 energía)',
      'repair (+4 hambre, −2 energía)',
    ]);
  });

  it('da a cada cifra bloques y avisa con tono cuando toca', () => {
    const model = createGameViewModel(
      {
        ...createGame('normal'),
        hunger: 10,
        energy: 2,
        food: 0,
        hasShelter: false,
      },
      null,
    );
    const byId = new Map(
      model.stats.map((resource) => [resource.id, resource]),
    );

    // Hambre al limite, energia critica y comida en cero: los tres avisan en
    // texto, y el aviso y el parpadeo son la misma señal.
    expect(byId.get('hunger')?.tone).toBe('warning');
    expect(byId.get('energy')?.tone).toBe('warning');
    expect(byId.get('food')?.tone).toBe('warning');
    expect(byId.get('hunger')?.stateLabel).toBe('Hambre al límite');
    expect(byId.get('energy')?.stateLabel).toBe('Reserva crítica');
    expect(byId.get('food')?.stateLabel).toBe('Sin provisiones');

    expect(byId.get('hunger')?.units).toBe(10);
    expect(byId.get('hunger')?.capacity).toBe(12);
    // Estar sin refugio avisa, pero ya no vive en la lista de cifras.
    expect(model.shelter.tone).toBe('warning');
  });
});

describe('createGameOverViewModel', () => {
  it('usa la causa comunicada aunque la condición interna sea otra', () => {
    const model = createGameOverViewModel({
      ...createCoreState({
        turn: 4,
        hunger: 10,
        energy: 0,
      }),
      status: 'dead',
      end: {
        condition: 'energy',
        reportedCause: 'hunger',
        turnsSurvived: 3,
      },
    });

    expect(model).toEqual({
      difficulty: 'normal',
      reportedCause: 'hunger',
      turnsSurvived: 3,
    });
  });
});
