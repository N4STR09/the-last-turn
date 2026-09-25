import { drawRandomInt } from './random';
import type { GameCoreState, GameEvent, RandomInt } from './types';

export interface RandomEventResolution {
  readonly state: GameCoreState;
  readonly event: GameEvent | null;
}

export function resolveRandomEvent(
  state: GameCoreState,
  randomInt: RandomInt,
): RandomEventResolution {
  if (state.difficulty === 'normal') {
    return { state, event: null };
  }

  const value = drawRandomInt(randomInt, 1, 100);

  if (value <= 10) {
    return {
      state: { ...state, hasShelter: false },
      event: { type: 'storm' },
    };
  }

  if (value >= 51 && value <= 59) {
    return {
      state: { ...state, food: 0 },
      event: { type: 'raccoon' },
    };
  }

  if (value === 99) {
    return {
      state: { ...state, health: 0 },
      event: { type: 'meteorite' },
    };
  }

  return { state, event: null };
}
