import type { RandomInt } from '..';

export interface RecordedRandomCall {
  readonly min: number;
  readonly max: number;
}

export interface SequenceRandomInt {
  readonly calls: RecordedRandomCall[];
  readonly randomInt: RandomInt;
}

export function sequenceRandomInt(
  values: readonly number[],
): SequenceRandomInt {
  const calls: RecordedRandomCall[] = [];
  let nextIndex = 0;

  return {
    calls,
    randomInt(min, max) {
      calls.push({ min, max });
      const value = values[nextIndex];

      if (value === undefined) {
        throw new Error('La secuencia de azar se agotó durante la prueba.');
      }

      nextIndex += 1;
      return value;
    },
  };
}

export function failIfRandomIntIsCalled(): RandomInt {
  return () => {
    throw new Error('La acción no debía consumir una tirada de azar.');
  };
}
