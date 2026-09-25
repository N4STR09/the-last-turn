import { drawRandomInt } from './random';
import {
  extraHungerPerTurn,
  foodRelief,
  forageSuccessLimit,
  repairFailureRadius,
  repairTurnCost,
  restEnergyCap,
} from './threat';
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

/**
 * Hambre que cuesta cada turno: el 1 del coste normal más el extra de
 * amenaza. Con amenaza 0 el extra es 0 y el coste es el de siempre.
 */
function hungerPerTurn(threat: number): number {
  return 1 + extraHungerPerTurn(threat);
}

function applyTurnCost(state: GameCoreState, turns: number): GameCoreState {
  return {
    ...state,
    turn: state.turn + turns,
    hunger: state.hunger + turns * hungerPerTurn(state.threat),
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
  const foundFood = value <= forageSuccessLimit(state.threat);
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
  // La tirada sigue decidiendo entre 3 y 5, pero la amenaza pone un techo: con
  // carga alta descansar nunca devuelve la energía completa.
  const energyRecovered = Math.min(
    value <= 2 ? 3 : 5,
    restEnergyCap(state.threat),
  );
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
  // Con radio 0 solo falla la tirada 5, que es el comportamiento heredado. La
  // banda se ensancha hacia ambos lados conforme sube la carga.
  const succeeded = Math.abs(value - 5) > repairFailureRadius(state.threat);
  const nextState = applyTurnCost(
    {
      ...state,
      hasShelter: succeeded ? true : state.hasShelter,
    },
    repairTurnCost(state.threat),
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
          hunger: state.hunger + attempts * hungerPerTurn(state.threat),
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
      hunger:
        state.hunger +
        maxFishingAttempts * hungerPerTurn(state.threat),
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

  const healthRecovered = state.health < 10 ? 1 : 0;
  const hungerBefore = state.hunger;
  // La ración quita el relieve base más el extra de amenaza, para que comer siga
  // tapando el gasto del turno cuando la escalada endurece el hambre.
  const nextState = applyTurnCost(
    {
      ...state,
      food: state.food - 1,
      hunger: state.hunger - foodRelief(state.threat),
      health: Math.min(10, state.health + healthRecovered),
    },
    1,
  );
  const withFloor = {
    ...nextState,
    hunger: Math.max(0, nextState.hunger),
  };
  // La reducción se mide sobre el resultado real: el suelo en cero y el coste del
  // turno hacen que el texto no prometa más de lo que la acción entrega.
  const hungerReduced = Math.max(0, hungerBefore - withFloor.hunger);

  return {
    state: withFloor,
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
