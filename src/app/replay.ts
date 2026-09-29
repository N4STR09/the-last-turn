import { createGame, resolveTurn } from '../game';
import type {
  Difficulty,
  FinishedGameState,
  GameAction,
  GameResolution,
  GameState,
} from '../game';
import type { TurnRecord } from './breakdown';
import { createSeededRandomInt } from './seed';

export interface ReplayResult {
  readonly state: GameState;
  /** La última resolución, para que el parte final sea el de verdad. */
  readonly resolution: GameResolution | null;
  /**
   * El registro con el turno de cada acción, reconstruido al reproducir. La URL
   * solo lleva las letras; los turnos salen de aquí, y salen porque el motor
   * cuenta igual que contó la partida original.
   */
  readonly records: readonly TurnRecord[];
}

/**
 * Una reproducción que llegó a una muerte.
 *
 * El tipo existe para que «hay partida muerta» y «hay resolución» no puedan
 * separarse: en el bucle de `replayGame` las dos cosas ocurren juntas, porque una
 * partida solo muere al resolver un turno, y ese turno deja su resolución.
 * Igualarlas en el tipo evita comprobarlo en cada sitio, y evita el error de
 * pintar una pantalla de muerte sin la resolución que la cerró.
 */
export interface DeadReplayResult {
  readonly state: FinishedGameState;
  readonly resolution: GameResolution;
  readonly records: readonly TurnRecord[];
}

/** Estrecha una reproducción al caso en que terminó. */
export function isDeadReplay(
  result: ReplayResult,
): result is DeadReplayResult {
  return result.state.status === 'dead' && result.resolution !== null;
}

/**
 * Reproduce una partida a partir de su semilla y su lista de acciones.
 *
 * Es la misma ruta que juega una persona: el mismo `createGame`, el mismo
 * `resolveTurn` y la misma fuente de azar sembrada. Por eso el resultado no es
 * una aproximación ni un resumen: es la partida, turno a turno, con los mismos
 * dados. Si el enlace está bien, la partida termina en el mismo turno y con el
 * mismo parte.
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
  const records: TurnRecord[] = [];

  for (const action of actions) {
    if (state.status === 'dead') {
      break;
    }

    // El turno se lee antes de resolver: es el que la banner mostraba cuando el
    // jugador pulsó, no el que deja la resolución.
    records.push({ action, turn: state.turn });
    resolution = resolveTurn(state, action, randomInt);
    state = resolution.state;
  }

  return { state, resolution, records };
}
