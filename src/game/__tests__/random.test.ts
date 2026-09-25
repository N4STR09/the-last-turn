import { describe, expect, it, vi } from 'vitest';

import { drawRandomInt } from '../random';
import type { RandomInt } from '..';
import { sequenceRandomInt } from './test-random';

describe('drawRandomInt', () => {
  it('devuelve un valor entero dentro del intervalo inclusivo', () => {
    const source = vi.fn<RandomInt>(() => 3);

    expect(drawRandomInt(source, 1, 3)).toBe(3);
    expect(source).toHaveBeenCalledWith(1, 3);
  });

  it.each([
    ['no entero', 1.5],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
    ['por debajo', 0],
    ['por encima', 4],
  ])('rechaza un resultado %s', (_label, value) => {
    const source: RandomInt = () => value;

    expect(() => drawRandomInt(source, 1, 3)).toThrow(RangeError);
  });

  it.each([
    [3, 1],
    [1.5, 3],
    [1, 3.5],
  ])('rechaza el intervalo inválido [%s, %s]', (min, max) => {
    const source = sequenceRandomInt([2]);

    expect(() => drawRandomInt(source.randomInt, min, max)).toThrow(RangeError);
    expect(source.calls).toEqual([]);
  });

  it('permite una tirada cuando min coincide con max', () => {
    const source = sequenceRandomInt([7]);

    expect(drawRandomInt(source.randomInt, 7, 7)).toBe(7);
  });
});
