export type Difficulty = 'normal' | 'agony';
export type GameStatus = 'playing' | 'dead';

/**
 * Techo de salud.
 *
 * Vive aquí y no en `threat.ts` porque no escala con la escalada: es el tope
 * físico del cuerpo, no un modificador. Diez porque la barra se dibuja con un
 * bloque por unidad, y diez bloques se leen de un vistazo; con más, la barra
 * deja de contar y pasa a ser una forma.
 */
export const MAX_HEALTH = 10;
/**
 * Por qué terminó la partida. `surrender` no es una muerte del cuerpo: es la
 * decisión del jugador de dejar de jugar, y el motor la registra aparte para que
 * la pantalla final no la confunda con el hambre o con el agotamiento.
 */
export type EndCondition = 'hunger' | 'energy' | 'health' | 'surrender';
export type DeathCause = 'hunger' | 'energy' | 'health' | 'surrender';

/**
 * Acciones que consumen turnos. Rendirse no va aquí: no es un turno.
 *
 * Cada una tiene una sola función, y la suma de las cinco cubre los cinco
 * recursos sin que ninguna compita con otra por el mismo:
 *
 * - `explore` produce comida y paga con salud.
 * - `eat` baja el hambre y paga con comida.
 * - `cure` sube la salud y paga con comida.
 * - `rest` sube la energía y paga con hambre.
 * - `repair` levanta el refugio y paga con dos turnos.
 *
 * La comida es el único recurso con tres sumideros que compiten entre sí —calorías,
 * medicina y reserva— y esa competencia es la decisión central de la partida.
 */
export type GameAction = 'explore' | 'eat' | 'cure' | 'rest' | 'repair';

export type RandomInt = (min: number, max: number) => number;

export interface GameCoreState {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly hunger: number;
  readonly energy: number;
  readonly food: number;
  readonly health: number;
  readonly hasShelter: boolean;
  readonly threat: number;
}

/**
 * Cierre de la partida. `condition` es el motivo real y `reportedCause` el que
 * se le cuenta al jugador: difieren cuando el juego mata por una causa y el
 * jugador percibe otra. Rendirse declara las dos iguales.
 */
export interface GameEnd {
  readonly condition: EndCondition;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
}

export interface PlayingGameState extends GameCoreState {
  readonly status: 'playing';
}

export interface FinishedGameState extends GameCoreState {
  readonly status: 'dead';
  readonly end: GameEnd;
}

export type GameState = PlayingGameState | FinishedGameState;

/** Aviso de escalada que la interfaz debe mostrar antes de dejar seguir. */
export interface ThreatNotice {
  readonly threat: number;
  readonly load: number;
}

/**
 * Lo que devolvió la acción, para que la terminal pueda contarlo sin volver a
 * mirar el estado. Los números viajan aquí porque el delta se calcula contra el
 * resultado real, no contra lo que la acción prometía.
 */
export type ActionOutcome =
  | {
      readonly type: 'explore-rich';
      readonly foodGained: 4;
      readonly healthLost: number;
    }
  | {
      readonly type: 'explore-find';
      readonly foodGained: 2;
      readonly healthLost: 1;
    }
  | { readonly type: 'explore-empty' }
  | {
      readonly type: 'cure-done';
      readonly foodSpent: number;
      readonly healthRecovered: number;
    }
  | { readonly type: 'cure-no-food' }
  | {
      readonly type: 'eat-consumed';
      readonly foodConsumed: 1;
      readonly hungerReduced: number;
    }
  | { readonly type: 'eat-no-food' }
  | {
      readonly type: 'rest-without-shelter';
      readonly energyRecovered: number;
    }
  | {
      readonly type: 'rest-shelter-success';
      readonly energyRecovered: number;
    }
  | { readonly type: 'repair-failed' }
  | { readonly type: 'repair-succeeded' };

export type GameEvent =
  | { readonly type: 'storm' }
  | { readonly type: 'raccoon' }
  | { readonly type: 'meteorite' };

export interface GameResolution {
  readonly state: GameState;
  readonly actionOutcome: ActionOutcome;
  /**
   * Lista de eventos de la resolución. Con tiradas extra una acción puede
   * provocar más de uno, y cada tirada se aplica sobre el estado anterior.
   */
  readonly randomEvents: readonly GameEvent[];
  readonly threatNotice: ThreatNotice | null;
}
