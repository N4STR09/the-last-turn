import { createGame, resolveTurn } from '../game';
import type {
  Difficulty,
  GameAction,
  GameResolution,
  GameState,
} from '../game';
import { createSeededRandomInt } from './seed';

export interface ReplayResult {
  readonly state: GameState;
  /** La última resolución, para que el parte final sea el de verdad. */
  readonly resolution: GameResolution | null;
}

/**
 * Reproduce una partida a partir de su semilla y su lista de acciones.
 *
 * Es la misma ruta que juega una persona: el mismo `createGame`, el mismo
 * `resolveTurn` y la misma fuente de azar sembrada. Por eso el resultado no es
 * una aproximación ni un resumen: es la partida, turno a turno, con los mismos
 * dados. Si el enlace está bien, la partida termina en el mismo turno y con la
 * misma autopsia.
 *
 * Si la lista de acciones se pasa del punto en que la partida murió, el bucle se
 * detiene en la muerte en vez de llamar a `resolveTurn` sobre un estado muerto:
 * un enlace manipulado a mano no puede romper la aplicación.
 */
export function replayGame(
  seed: number,
  difficulty: Difficulty,
  actions: readonly GameAction[],
): ReplayResult {
  const randomInt = createSeededRandomInt(seed);
  let state: GameState = createGame(difficulty);
  let resolution: GameResolution | null = null;

  for (const action of actions) {
    if (state.status === 'dead') {
      break;
    }

    resolution = resolveTurn(state, action, randomInt);
    state = resolution.state;
  }

  return { state, resolution };
}
