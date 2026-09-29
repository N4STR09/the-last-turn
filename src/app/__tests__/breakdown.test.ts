import { describe, expect, it } from 'vitest';

import { createBreakdown, findLastShift } from '../breakdown';
import type { TurnRecord } from '../breakdown';

describe('createBreakdown', () => {
  const records: TurnRecord[] = [
    { action: 'explore', turn: 1 },
    { action: 'rest', turn: 2 },
    { action: 'explore', turn: 3 },
    { action: 'eat', turn: 4 },
    { action: 'explore', turn: 5 },
    { action: 'rest', turn: 6 },
  ];

  it('cuenta cada acción', () => {
    const counts = Object.fromEntries(
      createBreakdown(records).map((usage) => [usage.id, usage.count]),
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
      createBreakdown([
        { action: 'eat', turn: 9 },
        { action: 'eat', turn: 1 },
      ]).map((usage) => [usage.id, usage.count]),
    );

    expect(counts).toMatchObject({ eat: 2 });
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

describe('findLastShift', () => {
  it('señala el turno de la última acción estrenada', () => {
    const result = findLastShift([
      { action: 'explore', turn: 1 },
      { action: 'rest', turn: 2 },
      { action: 'explore', turn: 3 },
      { action: 'repair', turn: 4 },
    ]);

    expect(result).toEqual({ turn: 4, label: 'Reparar' });
  });

  it('ignora las repeticiones posteriores', () => {
    // Lo que se busca es el último estreno, no la última vez que se usó algo. Aquí
    // se sigue jugando hasta el turno 4, pero las dos acciones ya se habían
    // estrenado en los turnos 1 y 2.
    const result = findLastShift([
      { action: 'explore', turn: 1 },
      { action: 'rest', turn: 2 },
      { action: 'explore', turn: 3 },
      { action: 'rest', turn: 4 },
    ]);

    expect(result).toEqual({ turn: 2, label: 'Descansar' });
  });

  it('devuelve null cuando no se jugaron turnos', () => {
    expect(findLastShift([])).toBeNull();
  });

  it('mira el turno y no el orden de la lista', () => {
    // El registro llega ordenado cuando lo escribe la sesión o una reproducción,
    // pero un enlace editado a mano puede traer las acciones en otro orden. El
    // último estreno es el de mayor turno, no el último de la lista.
    const result = findLastShift([
      { action: 'repair', turn: 7 },
      { action: 'explore', turn: 1 },
      { action: 'rest', turn: 4 },
    ]);

    expect(result).toEqual({ turn: 7, label: 'Reparar' });
  });
});
