import { afterEach, describe, expect, it } from 'vitest';

import { buildShareUrl, readReplayLink, readSeedOnly } from '../seed-url';

/**
 * Esta capa es la única que toca `window`, y en un sitio solo existe en navegador.
 * En jsdom existe siempre, así que las dos guardas `typeof window === 'undefined'`
 * no se pueden provocar desde aquí: viven en `seed-url-sin-navegador.test.ts`, que
 * corre en el entorno `node` de Vitest. Borrar `window` a mano desde este archivo
 * habría sido una prueba construida para que saliera la cobertura, no para
 * comprobar algo.
 */
describe('readReplayLink', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('devuelve null con una URL sin parametros', () => {
    expect(readReplayLink()).toBeNull();
  });

  it('lee un enlace de partida completo', () => {
    window.history.replaceState(null, '', '/?seed=1z141z3&d=a&a=ecd');

    expect(readReplayLink()).toEqual({
      seed: 0xffffffff,
      difficulty: 'agony',
      actions: ['explore', 'eat', 'rest'],
    });
  });

  it('devuelve null con un enlace a medias', () => {
    window.history.replaceState(null, '', '/?seed=1z141z3');

    expect(readReplayLink()).toBeNull();
  });

  it('devuelve null con un enlace corrupto, y no lanza', () => {
    window.history.replaceState(null, '', '/?seed=%C0%A9&d=a&a=ec');

    expect(readReplayLink()).toBeNull();
  });
});

describe('readSeedOnly', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('devuelve null cuando no hay semilla', () => {
    expect(readSeedOnly()).toBeNull();
  });

  it('devuelve la semilla de una URL que solo trae la semilla', () => {
    // Una semilla suelta abre una partida con ese azar, que es una cosa distinta
    // de reproducir un enlace.
    window.history.replaceState(null, '', '/?seed=1z141z3');

    expect(readSeedOnly()).toBe(0xffffffff);
  });

  it('devuelve null con una semilla que no vale', () => {
    window.history.replaceState(null, '', '/?seed=$$$');

    expect(readSeedOnly()).toBeNull();
  });
});

describe('buildShareUrl', () => {
  it('monta un enlace con la ruta de la pagina y no con la de la consulta', () => {
    window.history.replaceState(null, '', '/?seed=antigua&d=n&a=eeee');

    const url = buildShareUrl({
      seed: 5,
      difficulty: 'agony',
      actions: ['explore', 'rest'],
    });

    expect(url).toBe(`${window.location.origin}/?seed=5&d=a&a=ed`);
  });

  it('no escribe en la barra de direcciones', () => {
    // Si la partida muerta metiera su enlace en la URL, recargar reventaría la
    // muerte en vez de empezar otra. Construir el enlace no puede tener ese
    // efecto lateral.
    window.history.replaceState(null, '', '/');
    const before = window.location.href;

    buildShareUrl({ seed: 5, difficulty: 'normal', actions: ['explore'] });

    expect(window.location.href).toBe(before);
  });
});
