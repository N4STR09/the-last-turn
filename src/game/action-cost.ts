import { hungerPerTurn, REPAIR_TURNS } from './threat';
import type { GameAction } from './types';

/**
 * Turnos que consume una acción.
 *
 * Todas gastan un número fijo y conocido: explorar, comer, curar y descansar
 * gastan uno, reparar gasta dos. No hay ninguna acción cuyo coste dependa del
 * azar, y esa es la razón de que esta función devuelva un número y no un
 * intervalo.
 *
 * Existió un rango porque pescar podía costar de uno a seis turnos según la
 * tirada, y la interfaz solo podía ser honesta mostrando el peor caso. Al quitar
 * la pesca ese rango desapareció, y con él la necesidad de que el jugador
 * descubriera su coste después de pulsarla: el precio se ve antes de elegir, que
 * es lo único que lo convierte en una decisión y no en una trampa.
 */
export function actionTurns(action: GameAction): number {
  return action === 'repair' ? REPAIR_TURNS : 1;
}

/**
 * Coste de una acción en hambre y energía, resuelto contra la amenaza actual.
 *
 * Hambre y energía se gastan por turno, no por acción, así que el coste sale de
 * multiplicar los turnos por el gasto unitario. La energía siempre cuesta una
 * unidad por turno; el hambre sube con la escalada.
 */
export interface ActionCost {
  readonly turns: number;
  /** Hambre por turno, ya con el extra de amenaza aplicado. */
  readonly hungerPerTurn: number;
  readonly hunger: number;
  readonly energy: number;
}

export function actionCost(action: GameAction, threat: number): ActionCost {
  const turns = actionTurns(action);
  const perTurn = hungerPerTurn(threat);

  return {
    turns,
    hungerPerTurn: perTurn,
    hunger: turns * perTurn,
    energy: turns,
  };
}
