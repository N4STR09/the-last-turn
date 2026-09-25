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
    hunger: Math.max(0, state.hunger + turns),
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
  const foundFood = value <= 2;
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

  if (value <= 15) {
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
  const succeeded = value !== 1;
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

function resolveFish(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  let attempts = 0;
  let value: number;

  do {
    attempts += 1;
    value = drawRandomInt(randomInt, 1, 3);
  } while (value !== 1);

  const totalCost = (attempts * (attempts + 1)) / 2;

  return {
    state: {
      ...state,
      turn: state.turn + attempts,
      hunger: state.hunger + totalCost,
      energy: state.energy - totalCost,
      food: state.food + attempts * 3,
    },
    outcome: { type: 'fish-catch', attempts },
  };
}

function resolveEat(state: GameCoreState): ActionResolution {
  const nextState =
    state.food >= 0
      ? state
      : {
          ...state,
          hunger: state.hunger - 4,
        };

  return {
    state: applyTurnCost(nextState, 1),
    outcome: { type: 'eat-no-food' },
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
