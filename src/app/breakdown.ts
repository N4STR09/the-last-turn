import type { GameAction } from '../game/types';
import type { ActionUsageViewModel } from '../ui/view-models/ui-types';

/**
 * El registro de lo que se hizo, con el turno en que se hizo.
 *
 * La URL solo lleva las acciones, una letra por turno: el turno se reconstruye
 * reproduciendo la partida, porque el motor lo sabe. Aquí dentro, en cambio, hace
 * falta el número, y por eso el registro guarda las dos cosas. Es la diferencia
 * entre un enlace y un parte.
 *
 * El turno se usa para una sola cosa, `findLastShift`. La cuenta de cada acción
 * no lo necesita, y por eso `createBreakdown` lo ignora.
 */
export interface TurnRecord {
  readonly action: GameAction;
  /** Turno en el que se jugó la acción, tal y como lo contaba la banner. */
  readonly turn: number;
}

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
 * Solo la cuenta. El turno de la primera vez se quitó de aquí porque el parte ya
 * lo da una vez y mejor con `findLastShift`, que devuelve el último de esos mismos
 * turnos: el que de verdad significa algo. Ponerlo en cada fila era repetir cinco
 * veces un dato que se lee de una.
 *
 * Salen las cinco acciones siempre, también las que no se usaron nunca con la
 * cuenta a cero. Un parte que solo lista lo que se hizo esconde justo lo
 * interesante: la acción que el jugador tenía delante y no usó.
 */
export function createBreakdown(
  records: readonly TurnRecord[],
): ActionUsageViewModel[] {
  const counts = new Map<GameAction, number>();

  for (const record of records) {
    counts.set(record.action, (counts.get(record.action) ?? 0) + 1);
  }

  return actionOrder.map((action) => ({
    id: action,
    label: actionLabels[action],
    count: counts.get(action) ?? 0,
  }));
}

/**
 * El último momento en el que el jugador enseñó algo nuevo.
 *
 * Es el turno de la primera vez de la última acción estrenada. A partir de ahí ya
 * no cambió de estrategia: solo se repitió. Es una lectura, no un hecho, y
 * por eso el rótulo tiene que decirlo con las mismas palabras: `lastShift` es
 * "dejó de estrenar acciones", no "cambió de estrategia".
 */
export function findLastShift(
  records: readonly TurnRecord[],
): { readonly turn: number; readonly label: string } | null {
  let latest: TurnRecord | null = null;
  const seen = new Set<GameAction>();

  for (const record of records) {
    if (seen.has(record.action)) {
      continue;
    }

    seen.add(record.action);
    if (latest === null || record.turn > latest.turn) {
      latest = record;
    }
  }

  if (latest === null) {
    return null;
  }

  return { turn: latest.turn, label: actionLabels[latest.action] };
}
