import type {
  DeathCause,
  Difficulty,
  GameAction,
} from '../../game/types';

/** Los tres recursos con cifra. El refugio no es un stat: es un interruptor. */
export type StatId = 'hunger' | 'energy' | 'food' | 'health';
export type ResourceId = StatId | 'shelter';
export type Tone = 'neutral' | 'warning' | 'positive';

export interface ResourceViewModel {
  readonly id: StatId;
  readonly label: string;
  readonly value: string;
  readonly stateLabel: string;
  /**
   * `warning` avisa y late a la vez: es el mismo peligro escrito en texto y
   * dibujado en luz. Hasta que el refugio salió de esta lista era el único
   * sitio donde las dos señales se separaban, así que no hace falta un campo
   * aparte para el parpadeo.
   */
  readonly tone: Tone;
  /** Unidades actuales. La barra dibuja un bloque por unidad. */
  readonly units: number;
  /** Bloques que caben en la barra. El valor numérico siempre se imprime. */
  readonly capacity: number;
}

/**
 * Estado del refugio, en su propia línea debajo de las cifras. Se dice con una
 * palabra y no con un aviso porque no hay ningún punto en el que quedarse sin
 * techo sea una muerte: es una posición, no un peligro.
 */
export interface ShelterViewModel {
  readonly label: string;
  readonly hasShelter: boolean;
  readonly status: 'Construido' | 'Destruido';
  readonly tone: Tone;
}

export interface ResourceDeltaViewModel {
  readonly id: ResourceId;
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
}

export interface EventViewModel {
  readonly type: 'storm' | 'raccoon' | 'meteorite';
  readonly headline: string;
  readonly description: string;
}

export interface ResolutionViewModel {
  readonly actionId: GameAction;
  readonly headline: string;
  readonly details: readonly string[];
  readonly deltas: ReadonlyArray<ResourceDeltaViewModel>;
  readonly events: readonly EventViewModel[];
}

export interface ActionViewModel {
  readonly id: GameAction;
  readonly label: string;
  /**
   * Gasto de la acción en hambre y energía, entre paréntesis. Se calcula contra
   * la amenaza actual, así que sube con la escalada, y en reparar refleja que
   * dura dos turnos. Es el gasto exacto: ninguna acción tiene coste azar.
   */
  readonly cost: string;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  /** Nivel de escalada vigente. La dificultad la comunica la calavera. */
  readonly threat: number;
  /** Hambre, energía, comida y salud, en ese orden. */
  readonly stats: ReadonlyArray<ResourceViewModel>;
  /** El refugio, en su propia línea debajo de las cifras. */
  readonly shelter: ShelterViewModel;
  readonly resolution: ResolutionViewModel | null;
  readonly actions: ReadonlyArray<ActionViewModel>;
}

/** Pantalla de escalada: congela la partida hasta que se continúa. */
export interface ThreatNoticeViewModel {
  readonly threat: number;
  readonly load: number;
  readonly level: string;
  readonly message: string;
  readonly hint: string;
}

export interface GameOverViewModel {
  readonly difficulty: Difficulty;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
}
