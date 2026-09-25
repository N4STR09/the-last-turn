import type {
  DeathCause,
  EndCondition,
  GameCoreState,
  GameState,
} from './types';

function getEndCondition(state: GameCoreState): EndCondition | null {
  if (state.hunger > 10) {
    return 'hunger';
  }

  if (state.energy <= 0) {
    return 'energy';
  }

  if (state.health === 0) {
    return 'health';
  }

  return null;
}

function getReportedCause(state: GameCoreState): DeathCause {
  if (state.hunger >= 10) {
    return 'hunger';
  }

  if (state.energy <= 0) {
    return 'energy';
  }

  return 'health';
}

export function finishGame(state: GameCoreState): GameState {
  const condition = getEndCondition(state);

  if (condition === null) {
    return { ...state, status: 'playing' };
  }

  return {
    ...state,
    status: 'dead',
    end: {
      condition,
      reportedCause: getReportedCause(state),
      turnsSurvived: state.turn - 1,
    },
  };
}
