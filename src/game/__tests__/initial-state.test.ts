import { describe, expect, it } from 'vitest';

import { createGame } from '..';
import type { Difficulty } from '..';

const difficulties: readonly Difficulty[] = ['normal', 'agony'];

describe('createGame', () => {
  it.each(difficulties)('crea el estado inicial de %s', (difficulty) => {
    expect(createGame(difficulty)).toEqual({
      difficulty,
      status: 'playing',
      turn: 1,
      hunger: 0,
      energy: 10,
      food: 0,
      health: 10,
      hasShelter: false,
      threat: 0,
      // El primer turno no tiene nada anunciado: los eventos se tiran al final
      // de un turno para el siguiente, así que la partida arranca sin ninguno.
      pendingEvents: [],
    });
  });

  it('arranca sin eventos pendientes y con listas distintas', () => {
    const firstGame = createGame('agony');
    const secondGame = createGame('agony');

    expect(firstGame.pendingEvents).toEqual([]);
    expect(firstGame.pendingEvents).not.toBe(secondGame.pendingEvents);
  });

  it('crea estados independientes para partidas distintas', () => {
    const firstGame = createGame('normal');
    const secondGame = createGame('agony');

    expect(firstGame).not.toBe(secondGame);
    expect(firstGame.difficulty).toBe('normal');
    expect(secondGame.difficulty).toBe('agony');
  });
});
