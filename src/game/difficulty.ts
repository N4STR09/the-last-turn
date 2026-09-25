import type { GameCoreState, Milestone } from './types';

export interface DifficultyResolution {
  readonly state: GameCoreState;
  readonly milestone: Milestone | null;
}

export function applyDifficulty(
  state: GameCoreState,
  previousTurn = state.turn - 1,
): DifficultyResolution {
  const crossedTurn15 = previousTurn < 15 && state.turn >= 15;
  const crossedTurn30 = previousTurn < 30 && state.turn >= 30;
  const reachedTurn15 = state.turn === 15 || crossedTurn15;
  const reachedTurn30 = state.turn === 30 || crossedTurn30;
  const milestone: Milestone | null = reachedTurn30
    ? { type: 'turn-30' }
    : reachedTurn15
      ? { type: 'turn-15' }
      : null;
  const penalties = Number(crossedTurn15) + Number(crossedTurn30);

  if (penalties === 0) {
    return { state, milestone };
  }

  return {
    state: {
      ...state,
      hunger: state.hunger + penalties,
      energy: state.energy - penalties,
    },
    milestone,
  };
}
