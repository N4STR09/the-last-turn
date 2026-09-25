import { drawRandomInt } from './random';
import type {
  ActionOutcome,
  GameAction,
  GameCoreState,
  RandomInt,
} from './types';

export interface ActionResolution {
  readonly state: GameCoreState;
  readonly outcome: ActionOutcome;
}

type ActionResolver = (
  state: GameCoreState,
  randomInt: RandomInt,
) => ActionResolution;

function applyTurnCost(state: GameCoreState, turns: number): GameCoreState {
  return {
    ...state,
    turn: state.turn + turns,
    hunger: state.hunger + turns,
    energy: state.energy - turns,
  };
}

function resolveHelp(state: GameCoreState): ActionResolution {
  return {
    state,
    outcome: { type: 'help' },
  };
}

function resolveForage(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  const value = drawRandomInt(randomInt, 1, 5);
  const foundFood = value <= 3;
  const nextState = applyTurnCost(
    {
      ...state,
      food: state.food + (foundFood ? 1 : 0),
    },
    1,
  );

  return {
    state: nextState,
    outcome: { type: foundFood ? 'forage-found' : 'forage-empty' },
  };
}

function resolveRest(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  if (!state.hasShelter) {
    return {
      state: applyTurnCost(state, 1),
      outcome: { type: 'rest-without-shelter' },
    };
  }

  const value = drawRandomInt(randomInt, 1, 10);
  const energyRecovered = value <= 2 ? 3 : 5;
  const nextState = applyTurnCost(
    { ...state, energy: state.energy + energyRecovered },
    1,
  );

  return {
    state: nextState,
    outcome: {
      type: 'rest-shelter-success',
      energyRecovered,
    },
  };
}

function resolveExplore(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  const value = drawRandomInt(randomInt, 1, 20);

  if (value <= 4) {
    return {
      state: applyTurnCost({ ...state, hasShelter: true }, 1),
      outcome: { type: 'explore-shelter' },
    };
  }

  if (value >= 16) {
    return {
      state: applyTurnCost({ ...state, food: state.food + 1 }, 1),
      outcome: { type: 'explore-food' },
    };
  }

  return {
    state: applyTurnCost(state, 1),
    outcome: { type: 'explore-empty' },
  };
}

function resolveRepair(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  const value = drawRandomInt(randomInt, 1, 10);
  const succeeded = value !== 5;
  const nextState = applyTurnCost(
    {
      ...state,
      hasShelter: succeeded ? true : state.hasShelter,
    },
    2,
  );

  return {
    state: nextState,
    outcome: { type: succeeded ? 'repair-succeeded' : 'repair-failed' },
  };
}

const maxFishingAttempts = 6;

function resolveFish(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  for (let attempts = 1; attempts <= maxFishingAttempts; attempts += 1) {
    const value = drawRandomInt(randomInt, 1, 3);

    if (value === 1) {
      return {
        state: {
          ...state,
          turn: state.turn + attempts,
          hunger: state.hunger + attempts,
          energy: state.energy - attempts,
          food: state.food + 3,
        },
        outcome: { type: 'fish-catch', attempts },
      };
    }
  }

  return {
    state: {
      ...state,
      turn: state.turn + maxFishingAttempts,
      hunger: state.hunger + maxFishingAttempts,
      energy: state.energy - maxFishingAttempts,
    },
    outcome: { type: 'fish-failed', attempts: maxFishingAttempts },
  };
}

function resolveEat(state: GameCoreState): ActionResolution {
  if (state.food <= 0) {
    return {
      state: applyTurnCost(state, 1),
      outcome: { type: 'eat-no-food' },
    };
  }

  const hungerReduced = Math.max(0, Math.min(state.hunger, 3));
  const healthRecovered = state.health < 10 ? 1 : 0;
  const nextState = applyTurnCost(
    {
      ...state,
      food: state.food - 1,
      hunger: state.hunger - 4,
      health: Math.min(10, state.health + healthRecovered),
    },
    1,
  );

  return {
    state: {
      ...nextState,
      hunger: Math.max(0, nextState.hunger),
    },
    outcome: {
      type: 'eat-consumed',
      foodConsumed: 1,
      hungerReduced,
      healthRecovered,
    },
  };
}

const actionResolvers: Record<GameAction, ActionResolver> = {
  help: resolveHelp,
  forage: resolveForage,
  rest: resolveRest,
  explore: resolveExplore,
  repair: resolveRepair,
  fish: resolveFish,
  eat: resolveEat,
};

export function resolveAction(
  state: GameCoreState,
  action: GameAction,
  randomInt: RandomInt,
): ActionResolution {
  return actionResolvers[action](state, randomInt);
}
