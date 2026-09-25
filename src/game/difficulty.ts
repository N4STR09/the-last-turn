import type { GameCoreState, Milestone } from './types';

export interface DifficultyResolution {
  readonly state: GameCoreState;
  readonly milestone: Milestone | null;
}

export function applyDifficulty(
  state: GameCoreState,
): DifficultyResolution {
  let nextState = state;
  let milestone: Milestone | null = null;

  if (state.turn === 15) {
    milestone = { type: 'turn-15' };
  }

  if (state.turn > 15) {
    nextState = {
      ...nextState,
      hunger: nextState.hunger + 1,
      energy: nextState.energy - 1,
    };
  }

  if (state.turn === 30) {
    milestone = { type: 'turn-30' };
  }

  if (state.turn > 30) {
    nextState = {
      ...nextState,
      hunger: nextState.hunger + 1,
      energy: nextState.energy - 1,
    };
  }

  return { state: nextState, milestone };
}
