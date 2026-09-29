import { afterEach, describe, expect, it } from 'vitest';

import type { GameAction } from '../../game';
import { bootState, readBoot } from '../boot';
import { replayGame } from '../replay';
import { encodeReplayQuery } from '../seed';

/**
 * Busca una semilla cuya partida de solo explorar muera, y devuelve el enlace de
 * esa muerte. Se busca en vez de fijarla a mano para que el test siga valiendo si
 * algún día cambia el balance: lo que importa es que el enlace reconstruye la
 * partida, no que una semilla concreta siga matando igual.
 */
function deadLink() {
  const actions: GameAction[] = Array.from({ length: 40 }, () => 'explore');

  for (let seed = 1; seed < 500; seed += 1) {
    const result = replayGame(seed, 'agony', actions);

    if (result.state.status === 'dead') {
      return { seed, played: actions.slice(0, result.records.length) };
    }
  }

  throw new Error('Ninguna semilla de la prueba murió explorando.');
}

function openAt(query: string): void {
  window.history.replaceState(null, '', query);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('readBoot', () => {
  it('devuelve null con una página abierta sin enlace', () => {
    expect(readBoot()).toBeNull();
  });

  it('devuelve null con un enlace corrupto en vez de lanzar', () => {
    openAt('/?seed=$$$&d=z&a=qqq');

    expect(readBoot()).toBeNull();
  });

  it('devuelve null con una semilla suelta, que no es un enlace', () => {
    // Una semilla abre una partida con ese azar. No hay acciones que repetir, así
    // que no hay nada que reproducir y la aplicación arranca normal.
    openAt('/?seed=1z141z3');

    expect(readBoot()).toBeNull();
  });

  it('devuelve null si la partida del enlace no muere', () => {
    // Un enlace escrito a mano puede describir una partida que sobrevive. No hay
    // muerte que enseñar, así que se arranca normal en vez de fingir una.
    openAt(`/?${encodeReplayQuery({
      seed: 1,
      difficulty: 'agony',
      actions: ['rest', 'rest', 'rest'],
    })}`);

    expect(readBoot()).toBeNull();
  });

  it('lee la partida y su registro cuando el enlace sí muere', () => {
    const link = deadLink();
    const reference = replayGame(link.seed, 'agony', link.played);
    openAt(
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    const boot = readBoot();

    expect(boot?.link.seed).toBe(link.seed);
    expect(boot?.result.state).toEqual(reference.state);
    expect(boot?.result.records).toEqual(reference.records);
  });
});

describe('bootState', () => {
  it('arranca en la pantalla de inicio cuando no hay enlace', () => {
    const state = bootState(null);

    expect(state.screen).toBe('start');
    expect(state.game).toBeNull();
    expect(state.resolution).toBeNull();
  });

  it('nace ya en la pantalla de muerte cuando hay enlace', () => {
    // Y no un instante después: si la reproducción pasara por el inicio, el
    // visitante vería un parpadeo de una pantalla que no ha pedido.
    const link = deadLink();
    openAt(
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    const boot = readBoot();

    if (boot === null) {
      throw new Error('El enlace de prueba no muere.');
    }

    const state = bootState(boot);

    expect(state.screen).toBe('dead');
    if (state.screen !== 'dead') {
      throw new Error('Se esperaba una partida muerta.');
    }

    // La resolución guardada es la que cerró la partida, no un resumen.
    expect(state.resolution).toBe(boot.result.resolution);
    expect(state.threatNotice).toBeNull();
  });
});
