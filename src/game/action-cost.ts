import { hungerPerTurn, repairTurnCost } from './threat';
import type { GameAction } from './types';

/** Tope de intentos de pesca, y por tanto de turnos que puede costar. */
export const MAX_FISHING_ATTEMPTS = 6;

/**
 * Rango de turnos que consume una acción.
 *
 * Casi todas gastan un turno fijo. Reparar gasta entre 2 y 5 según la carga de
 * amenaza, y pescar entre 1 y 6 según el azar, así que el rango es la única
 * forma honesta de describir el coste: un número único mentiría en uno de los
 * dos casos y la interfaz no puede prometer lo que el motor no garantiza.
 */
export interface ActionTurnSpan {
  readonly min: number;
  readonly max: number;
}

/**
 * Coste de una acción en hambre y energía, resuelto contra la amenaza actual.
 *
 * Hambre y energía se gastan por turno, no por acción, así que el coste sale
 * de multiplicar los turnos por el gasto unitario. La energía siempre cuesta
 * una unidad por turno; el hambre sube con la escalada.
 */
export interface ActionCost {
  readonly span: ActionTurnSpan;
  /** Hambre por turno, ya con el extra de amenaza aplicado. */
  readonly hungerPerTurn: number;
  readonly minHunger: number;
  readonly maxHunger: number;
  readonly minEnergy: number;
  readonly maxEnergy: number;
}

function turnSpanFor(action: GameAction, threat: number): ActionTurnSpan {
  switch (action) {
    case 'help':
      return { min: 0, max: 0 };
    case 'forage':
    case 'rest':
    case 'explore':
    case 'eat':
      return { min: 1, max: 1 };
    case 'repair': {
      const turns = repairTurnCost(threat);
      return { min: turns, max: turns };
    }
    case 'fish':
      return { min: 1, max: MAX_FISHING_ATTEMPTS };
  }
}

export function actionTurnSpan(
  action: GameAction,
  threat: number,
): ActionTurnSpan {
  return turnSpanFor(action, threat);
}

export function actionCost(action: GameAction, threat: number): ActionCost {
  const span = turnSpanFor(action, threat);
  const perTurn = hungerPerTurn(threat);

  return {
    span,
    hungerPerTurn: perTurn,
    minHunger: span.min * perTurn,
    maxHunger: span.max * perTurn,
    minEnergy: span.min,
    maxEnergy: span.max,
  };
}
