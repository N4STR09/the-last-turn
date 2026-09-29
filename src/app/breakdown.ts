import type { GameAction } from '../game/types';
import type { ActionUsageViewModel } from '../ui/view-models/ui-types';

/** Los nombres de las cinco acciones, en el orden en que salen en la rejilla. */
const actionLabels: Readonly<Record<GameAction, string>> = {
  explore: 'Explorar',
  eat: 'Comer',
  cure: 'Curarse',
  rest: 'Descansar',
  repair: 'Reparar',
};

const actionOrder: readonly GameAction[] = [
  'explore',
  'eat',
  'cure',
  'rest',
  'repair',
];

/**
 * Cuántas veces se usó cada acción.
 *
 * Recibe las acciones en el orden en que se jugaron y devuelve solo la cuenta. El
 * orden no se usa: la URL solo lleva una letra por turno, así que un enlace
 * editado a mano puede traerlas desordenadas, y una cuenta no puede depender de
 * dónde estuviera cada una en la lista.
 *
 * Salen las cinco acciones siempre, también las que no se usaron nunca con la
 * cuenta a cero. Un parte que solo lista lo que se hizo esconde justo lo
 * interesante: la acción que el jugador tenía delante y no usó.
 */
export function createBreakdown(
  played: readonly GameAction[],
): ActionUsageViewModel[] {
  const counts = new Map<GameAction, number>();

  for (const action of played) {
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }

  return actionOrder.map((action) => ({
    id: action,
    label: actionLabels[action],
    count: counts.get(action) ?? 0,
  }));
}
