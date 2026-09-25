import { drawRandomInt } from './random';
import {
  extraEventRolls,
  threatLoad,
} from './threat';
import type { GameCoreState, GameEvent, RandomInt } from './types';

export interface RandomEventResolution {
  readonly state: GameCoreState;
  readonly events: readonly GameEvent[];
}

interface SingleEventResolution {
  readonly state: GameCoreState;
  readonly event: GameEvent | null;
}

function resolveSingleEvent(
  state: GameCoreState,
  randomInt: RandomInt,
): SingleEventResolution {
  const value = drawRandomInt(randomInt, 1, 100);
  const load = threatLoad(state.threat);
  // A partir de la carga 1, tormenta y mapache también cuestan energía.
  const energySurcharge = load >= 1 ? 1 : 0;

  if (value <= 10) {
    return {
      state: {
        ...state,
        hasShelter: false,
        energy: state.energy - energySurcharge,
      },
      event: { type: 'storm' },
    };
  }

  if (value >= 51 && value <= 59) {
    return {
      state: {
        ...state,
        food: 0,
        energy: state.energy - energySurcharge,
        // A partir de la carga 3 el mapache también hiere.
        health: load >= 3 ? Math.max(0, state.health - 1) : state.health,
      },
      event: { type: 'raccoon' },
    };
  }

  if (value === 99) {
    return {
      state: { ...state, health: Math.max(0, state.health - 1) },
      event: { type: 'meteorite' },
    };
  }

  return { state, event: null };
}

export function resolveRandomEvents(
  state: GameCoreState,
  randomInt: RandomInt,
): RandomEventResolution {
  if (state.difficulty === 'normal') {
    return { state, events: [] };
  }

  const rolls = 1 + extraEventRolls(state.threat);
  let current = state;
  const events: GameEvent[] = [];

  for (let roll = 0; roll < rolls; roll += 1) {
    const resolution = resolveSingleEvent(current, randomInt);
    current = resolution.state;

    if (resolution.event !== null) {
      events.push(resolution.event);
    }
  }

  return { state: current, events };
}
