import { describe, expect, it } from 'vitest';

import {
  actionCostLabel,
  createGameOverViewModel,
  createGameViewModel,
} from '../game-view-model';
import { createGame, resolveTurn } from '../../game';
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
  it('representa los cuatro recursos sin exponer salud', () => {
    const model = createGameViewModel(createGame('normal'), null);

    expect(model.difficulty).toBe('normal');
    expect(model.turn).toBe(1);
    expect(model.resources.map((resource) => resource.id)).toEqual([
      'hunger',
      'energy',
      'food',
      'shelter',
    ]);
    expect(model.resources.map((resource) => resource.value)).toEqual([
      '0',
      '10',
      '0',
      'Ausente',
    ]);
    expect(model.resources.map((resource) => resource.id)).not.toContain(
      'health',
    );
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
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'forage',
      (() => {
        const values = [1, 50];
        return () => values.shift() ?? 50;
      })(),
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('forage');
    expect(model.resolution?.headline).toBe('Encuentras comida.');
    expect(model.resolution?.details).toEqual([
      'La búsqueda añade 1 comida.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '+1', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '+1', tone: 'positive' },
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
      'help',
      () => 5,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.events.map((event) => event.type)).toEqual([
      'storm',
      'storm',
    ]);
  });

  it('traduce comer una ración y sus cambios', () => {
    const previous = createCoreState({ food: 1, hunger: 2, health: 6 });
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'eat',
      () => 1,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('eat');
    expect(model.resolution?.headline).toBe('Comes una ración.');
    expect(model.resolution?.details).toEqual([
      'Consumes 1 comida y reduces el hambre en 2.',
      'La comida te ayuda a recuperar un poco de salud.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '−2', tone: 'positive' },
      { id: 'energy', label: 'Energía', value: '−1', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '−1', tone: 'warning' },
    ]);
  });

  it('traduce una pesca fallida sin añadir comida', () => {
    const previous = createCoreState();
    const resolution = resolveTurn(
      { ...previous, status: 'playing' },
      'fish',
      () => 2,
    );

    const model = createGameViewModel(resolution.state, resolution, previous);

    expect(model.resolution?.actionId).toBe('fish');
    expect(model.resolution?.headline).toBe('La pesca no consigue nada.');
    expect(model.resolution?.details).toEqual([
      'La pesca agota 6 intentos y no añade comida.',
    ]);
    expect(model.resolution?.deltas).toEqual([
      { id: 'hunger', label: 'Hambre', value: '+6', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−6', tone: 'warning' },
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
        'help',
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
  it('anuncia que la ayuda no gasta nada', () => {
    for (const threat of [0, 3, 10]) {
      expect(actionCostLabel('help', threat)).toBe('(sin coste)');
    }
  });

  it('cobra un turno de hambre y uno de energia sin escalada', () => {
    for (const action of ['forage', 'rest', 'explore', 'eat'] as const) {
      expect(actionCostLabel(action, 0)).toBe('(+1 hambre, −1 energía)');
    }
  });

  it('sube el gasto de hambre de las acciones simples con la escalada', () => {
    // Carga 10: el turno cuesta 6 de hambre, no 1. El botón tiene que decirlo
    // o el jugador firma un coste que no es el real.
    expect(actionCostLabel('rest', 10)).toBe('(+6 hambre, −1 energía)');
    expect(actionCostLabel('explore', 4)).toBe('(+3 hambre, −1 energía)');
  });

  it('refleja que reparar consume mas turnos segun el nivel', () => {
    expect(actionCostLabel('repair', 0)).toBe('(+2 hambre, −2 energía)');
    // Carga 2 todavia son 2 turnos, asi que el gasto solo cambia por el ritmo
    // de hambre: 2 turnos por 2 de hambre.
    expect(actionCostLabel('repair', 2)).toBe('(+4 hambre, −2 energía)');
    // Carga 5 son 3 turnos y 3 de hambre por turno.
    expect(actionCostLabel('repair', 5)).toBe('(+9 hambre, −3 energía)');
    expect(actionCostLabel('repair', 10)).toBe('(+24 hambre, −4 energía)');
  });

  it('enuncia el peor caso de la pesca porque su coste es azar', () => {
    expect(actionCostLabel('fish', 0)).toBe(
      '(hasta +6 hambre, −6 energía)',
    );
    expect(actionCostLabel('fish', 10)).toBe(
      '(hasta +36 hambre, −6 energía)',
    );
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

  it('trae las siete acciones con su gasto calculado contra la escalada', () => {
    const model = createGameViewModel(
      { ...createGame('agony'), turn: 90, threat: 5 },
      null,
    );

    expect(model.actions.map((action) => action.id)).toEqual([
      'forage',
      'rest',
      'explore',
      'repair',
      'fish',
      'eat',
      'help',
    ]);
    const costs = model.actions.map((action) => `${action.id} ${action.cost}`);
    expect(costs).toEqual([
      'forage (+3 hambre, −1 energía)',
      'rest (+3 hambre, −1 energía)',
      'explore (+3 hambre, −1 energía)',
      'repair (+9 hambre, −3 energía)',
      'fish (hasta +18 hambre, −6 energía)',
      'eat (+3 hambre, −1 energía)',
      'help (sin coste)',
    ]);
  });

  it('da a cada recurso bloques y un punto critico explicito', () => {
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
      model.resources.map((resource) => [resource.id, resource]),
    );

    // Hambre al limite y energia critica: parpadean y avisan en texto.
    expect(byId.get('hunger')?.critical).toBe(true);
    expect(byId.get('energy')?.critical).toBe(true);
    expect(byId.get('food')?.critical).toBe(true);
    // Estar sin refugio es una advertencia, no una muerte: avisa pero no late.
    expect(byId.get('shelter')?.tone).toBe('warning');
    expect(byId.get('shelter')?.critical).toBe(false);

    expect(byId.get('hunger')?.units).toBe(10);
    expect(byId.get('shelter')?.units).toBe(0);
    expect(byId.get('shelter')?.capacity).toBe(1);
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
