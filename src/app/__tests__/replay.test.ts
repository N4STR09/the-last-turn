import { describe, expect, it } from 'vitest';

import { createGame, resolveTurn } from '../../game';
import type { GameAction, GameResolution, GameState } from '../../game';
import { createSeededRandomInt } from '../seed';
import { replayGame } from '../replay';

describe('replayGame', () => {
  it('termina en la misma partida que se juega a mano', () => {
    // Se juega una partida entera con la fuente sembrada y luego se reproduce
    // con el mismo registro. El motor es el mismo en los dos casos, asi que esto
    // mide justo lo que importa: que el enlace reconstruye la partida y no una
    // aproximacion suya.
    const randomInt = createSeededRandomInt(2024);
    let state: GameState = createGame('agony');
    const played: GameAction[] = [];

    for (let index = 0; index < 60; index += 1) {
      if (state.status === 'dead') {
        break;
      }

      const action: GameAction =
        index % 3 === 0
          ? 'explore'
          : index % 3 === 1
            ? 'rest'
            : 'eat';
      played.push(action);
      state = resolveTurn(state, action, randomInt).state;
    }

    const replayed = replayGame(2024, 'agony', played);

    expect(replayed.state).toEqual(state);
  });

  it('devuelve el turno en el que se jugado cada accion', () => {
    const records = replayGame(7, 'normal', [
      'explore',
      'rest',
      'repair',
    ]).records;

    // El turno se lee antes de resolver, que es cuando el jugador pulso. Reparar
    // gasta dos, asi que la siguiente accion despues de ella va dos mas
    // adelante, no una.
    expect(records).toEqual([
      { action: 'explore', turn: 1 },
      { action: 'rest', turn: 2 },
      { action: 'repair', turn: 3 },
    ]);
  });

  it('se detiene en la muerte y no resuelve sobre un estado muerto', () => {
    // Un enlace escrito a mano puede traer acciones de mas. El motor lanza una
    // excepcion si se resuelven sobre una partida terminada, asi que el bucle
    // tiene que parar antes.
    const starving = createSeededRandomInt(3);
    let state: GameState = createGame('agony');

    while (state.status === 'playing') {
      state = resolveTurn(state, 'explore', starving).state;
    }

    if (state.status !== 'dead') {
      throw new Error('Se esperaba una partida terminada.');
    }

    const turns = state.end.turnsSurvived;
    const result = replayGame(3, 'agony', [
      ...Array.from({ length: turns + 10 }, () => 'explore' as const),
    ]);

    expect(result.state.status).toBe('dead');
    expect(result.records).toHaveLength(turns);
  });

  it('un enlace con acciones de mas no rompe la pagina', () => {
    expect(() =>
      replayGame(3, 'agony', Array.from({ length: 500 }, () => 'rest')),
    ).not.toThrow();
  });

  it('un enlace sin acciones abre el primer turno, sin morir', () => {
    // Una semilla suelta no es una partida. Sin acciones no hay nada que
    // reproducir, y el motor no se inventa un final.
    const result = replayGame(1, 'normal', []);

    expect(result.state.status).toBe('playing');
    expect(result.state.turn).toBe(1);
    expect(result.resolution).toBeNull();
    expect(result.records).toEqual([]);
  });

  it('dos semillas distintas dan partidas distintas', () => {
    const actions: GameAction[] = Array.from({ length: 30 }, () => 'explore');
    const a = replayGame(1, 'agony', actions);
    const b = replayGame(2, 'agony', actions);

    expect(a.state).not.toEqual(b.state);
  });

  it('la dificultad forma parte de la partida', () => {
    const actions: GameAction[] = Array.from({ length: 30 }, () => 'explore');

    expect(replayGame(1, 'agony', actions).state).not.toEqual(
      replayGame(1, 'normal', actions).state,
    );
  });

  it('devuelve la ultima resolucion, que es la que mato', () => {
    const randomInt = createSeededRandomInt(0);
    let state: GameState = createGame('agony');
    let last: GameResolution | null = null;

    while (state.status === 'playing') {
      const resolution = resolveTurn(state, 'explore', randomInt);
      state = resolution.state;
      last = resolution;
    }

    if (state.status !== 'dead') {
      throw new Error('Se esperaba una partida terminada.');
    }

    const replayed = replayGame(
      0,
      'agony',
      Array.from({ length: state.end.turnsSurvived }, () => 'explore' as const),
    );

    expect(replayed.resolution).toEqual(last);
    expect(replayed.resolution?.state.status).toBe('dead');
  });
});
