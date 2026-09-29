import { describe, expect, it } from 'vitest';

import { createBreakdown } from '../breakdown';
import type { GameAction } from '../../game';

describe('createBreakdown', () => {
  const played: GameAction[] = [
    'explore',
    'rest',
    'explore',
    'eat',
    'explore',
    'rest',
  ];

  it('cuenta cada acción', () => {
    const counts = Object.fromEntries(
      createBreakdown(played).map((usage) => [usage.id, usage.count]),
    );

    expect(counts).toEqual({
      explore: 3,
      eat: 1,
      cure: 0,
      rest: 2,
      repair: 0,
    });
  });

  it('cuenta igual venga desordenado el registro', () => {
    // Un enlace escrito a mano puede traer las acciones en otro orden, y una
    // cuenta no puede depender de ese orden. Aquí lo que se perdía era el turno de
    // la primera vez; la cuenta nunca debió depender de dónde estuviera cada acción
    // en la lista, así que se comprueba.
    const counts = Object.fromEntries(
      createBreakdown(['eat', 'eat', 'rest']).map((usage) => [
        usage.id,
        usage.count,
      ]),
    );

    expect(counts).toMatchObject({ eat: 2, rest: 1 });
  });

  it('no lleva el turno de la acción, solo la cuenta', () => {
    // Aquí hubo un modelo con el turno de la primera vez, y con el turno de la
    // última acción estrenada. Los dos se fueron con sus frases: el parte ya dice
    // en qué turno murió, y «cuántas veces» es lo que de verdad describe cómo se
    // jugó. Lo que se comprueba es que no vuelva colado.
    for (const usage of createBreakdown(played)) {
      expect(Object.keys(usage).sort()).toEqual(['count', 'id', 'label']);
    }
  });

  it('lista siempre las cinco acciones, en el orden de la rejilla', () => {
    // Un parte que solo lista lo que se hizo esconde la acción que el jugador
    // tenía delante y no usó, que es justo lo que se quiere ver.
    expect(createBreakdown([]).map((usage) => usage.id)).toEqual([
      'explore',
      'eat',
      'cure',
      'rest',
      'repair',
    ]);
  });

  it('aguanta una partida sin ninguna acción', () => {
    expect(
      createBreakdown([]).every((usage) => usage.count === 0),
    ).toBe(true);
  });
});
