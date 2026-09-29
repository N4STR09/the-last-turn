// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { readReplayLink, readSeedOnly } from '../seed-url';

/**
 * Las guardas de `seed-url.ts` se prueban aquí, y no en `seed-url.test.ts`, porque
 * necesitan un entorno donde `window` no exista. jsdom lo trae siempre —borrarlo a
 * mano desde un test sería montar un scenario falso para que la cobertura salga—,
 * mientras que el entorno `node` de Vitest no lo tiene, que es exactamente el
 * escenario que la guarda cubre: este módulo importado fuera de un navegador.
 *
 * No es una prueba deCoverage: es la comprobación de que importar la capa de URL
 * en un runtime sin DOM no revienta, y de que en ese caso no se lee nada de una
 * barra de direcciones que no está.
 */
describe('sin navegador', () => {
  it('no hay ventana, que es justo lo que se comprueba', () => {
    expect(typeof window).toBe('undefined');
  });

  it('no lee un enlace de partida de la nada', () => {
    expect(readReplayLink()).toBeNull();
  });

  it('no lee una semilla suelta de la nada', () => {
    expect(readSeedOnly()).toBeNull();
  });
});
