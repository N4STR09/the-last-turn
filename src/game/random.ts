import type { RandomInt } from './types';

function assertValidBounds(min: number, max: number): void {
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min > max
  ) {
    throw new RangeError(
      `Intervalo de azar inválido: [${min}, ${max}].`,
    );
  }
}

export function drawRandomInt(
  randomInt: RandomInt,
  min: number,
  max: number,
): number {
  assertValidBounds(min, max);

  const value = randomInt(min, max);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(
      `La fuente de azar devolvió ${value}; se esperaba un entero en [${min}, ${max}].`,
    );
  }

  return value;
}
