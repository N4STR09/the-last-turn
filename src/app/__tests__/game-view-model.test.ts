import { describe, expect, it } from 'vitest';

import {
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

  it('traduce la acción, sus cambios, el evento y el hito en orden', () => {
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
      { id: 'hunger', label: 'Hambre', value: '+2', tone: 'warning' },
      { id: 'energy', label: 'Energía', value: '−2', tone: 'warning' },
      { id: 'food', label: 'Comida', value: '+1', tone: 'positive' },
    ]);
    expect(model.resolution?.event).toBeNull();
    expect(model.resolution?.milestone).toBe(
      'El ambiente empieza a desprender un aura rara. Una presión inicial castiga tu cuerpo...',
    );
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
      'La comida te ayuda a recuperar 1 de salud.',
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
          ?.event,
      ).toEqual({
        type: value === 1 ? 'storm' : value === 51 ? 'raccoon' : 'meteorite',
        headline,
        description,
      });
    }
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
