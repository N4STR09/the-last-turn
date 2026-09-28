import { drawRandomInt } from './random';
import {
  CURE_FOOD_COST,
  cureAmount,
  exploreFindLimit,
  exploreRichLimit,
  exploreWound,
  foodRelief,
  hungerPerTurn,
  repairFailureRadius,
  REPAIR_TURNS,
  repairDemolishesShelter,
  restEnergyCap,
  REST_ENERGY_WITHOUT_SHELTER,
} from './threat';
import {
  MAX_HEALTH,
  type ActionOutcome,
  type GameAction,
  type GameCoreState,
  type RandomInt,
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
    hunger: state.hunger + turns * hungerPerTurn(state.threat),
    energy: state.energy - turns,
  };
}

function resolveExplore(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  const value = drawRandomInt(randomInt, 1, 20);

  if (value <= exploreRichLimit(state.threat)) {
    const healthLost = exploreWound(state.threat);
    return {
      state: applyTurnCost(
        { ...state, food: state.food + 4, health: state.health - healthLost },
        1,
      ),
      outcome: { type: 'explore-rich', foodGained: 4, healthLost },
    };
  }

  if (value <= exploreFindLimit(state.threat)) {
    return {
      state: applyTurnCost({ ...state, food: state.food + 2, health: state.health - 1 }, 1),
      outcome: { type: 'explore-find', foodGained: 2, healthLost: 1 },
    };
  }

  return {
    state: applyTurnCost(state, 1),
    outcome: { type: 'explore-empty' },
  };
}

function resolveCure(state: GameCoreState): ActionResolution {
  if (state.food < CURE_FOOD_COST) {
    return {
      state: applyTurnCost(state, 1),
      outcome: { type: 'cure-no-food' },
    };
  }

  const healthRecovered = Math.min(cureAmount(state.threat), MAX_HEALTH - state.health);
  const nextState = applyTurnCost(
    {
      ...state,
      food: state.food - CURE_FOOD_COST,
      health: state.health + healthRecovered,
    },
    1,
  );

  return {
    state: nextState,
    outcome: { type: 'cure-done', foodSpent: CURE_FOOD_COST, healthRecovered },
  };
}

function resolveRest(
  state: GameCoreState,
  randomInt: RandomInt,
): ActionResolution {
  if (!state.hasShelter) {
    return {
      state: applyTurnCost(
        { ...state, energy: state.energy + REST_ENERGY_WITHOUT_SHELTER },
        1,
      ),
      outcome: {
        type: 'rest-without-shelter',
        energyRecovered: REST_ENERGY_WITHOUT_SHELTER,
      },
    };
  }

  const value = drawRandomInt(randomInt, 1, 10);
  // La tirada sigue decidiendo entre 2 y 4, pero la amenaza pone un techo: con
  // carga alta descansar nunca devuelve la energía completa.
  const energyRecovered = Math.min(
    value <= 2 ? 2 : 4,
    restEnergyCap(state.threat),
  );
  const nextState = applyTurnCost(
    { ...state, energy: state.energy + energyRecovered },
    1,
  );

  return {
    state: nextState,
    outcome: { type: 'rest-shelter-success', energyRecovered },
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
  // Un fallo deja el refugio como estaba: se han gastado dos turnos y ya. A partir
  // de la carga 1, en cambio, se lleva el refugio por delante. Antes el fallo era
  // gratis de riesgo y la tirada no decidía nada, así que reparar no era una
  // apuesta sino un peaje. Derribarlo le da peso al d10.
  const hasShelter = succeeded
    ? true
    : repairDemolishesShelter(state.threat)
      ? false
      : state.hasShelter;
  const nextState = applyTurnCost(
    {
      ...state,
      hasShelter,
    },
    REPAIR_TURNS,
  );

  return {
    state: nextState,
    outcome: { type: succeeded ? 'repair-succeeded' : 'repair-failed' },
  };
}

function resolveEat(state: GameCoreState): ActionResolution {
  if (state.food <= 0) {
    return {
      state: applyTurnCost(state, 1),
      outcome: { type: 'eat-no-food' },
    };
  }

  const hungerBefore = state.hunger;
  // La ración quita el relieve base más el extra de amenaza, para que comer siga
  // tapando el gasto del turno cuando la escalada endurece el hambre. No cura:
  // esa es la función de `cure`, y si las dos hicieran lo mismo bastaría una.
  const nextState = applyTurnCost(
    {
      ...state,
      food: state.food - 1,
      hunger: state.hunger - foodRelief(state.threat),
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
    outcome: { type: 'eat-consumed', foodConsumed: 1, hungerReduced },
  };
}

const actionResolvers: Record<GameAction, ActionResolver> = {
  explore: resolveExplore,
  eat: resolveEat,
  cure: resolveCure,
  rest: resolveRest,
  repair: resolveRepair,
};

export function resolveAction(
  state: GameCoreState,
  action: GameAction,
  randomInt: RandomInt,
): ActionResolution {
  return actionResolvers[action](state, randomInt);
}
