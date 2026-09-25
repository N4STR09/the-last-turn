import type {
  DeathCause,
  Difficulty,
  GameAction,
} from '../../game/types';

export type ResourceId = 'hunger' | 'energy' | 'food' | 'shelter';
export type Tone = 'neutral' | 'warning' | 'positive';

export interface ResourceViewModel {
  readonly id: ResourceId;
  readonly label: string;
  readonly value: string;
  readonly stateLabel: string;
  readonly tone: Tone;
  /** Unidades actuales. La barra dibuja un bloque por unidad. */
  readonly units: number;
  /** Bloques que caben en la barra. El valor numérico siempre se imprime. */
  readonly capacity: number;
  /**
   * Punto sin retorno o al borde de él. Es distinto de `tone === 'warning'` a
   * propósito: quedarse sin refugio es una advertencia, no una muerte, y no
   * debe parpadear.
   */
  readonly critical: boolean;
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
   * la amenaza actual, así que en reparación y pesca refleja el coste real.
   */
  readonly cost: string;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  /** Nivel de escalada vigente. La dificultad la comunica la calavera. */
  readonly threat: number;
  readonly resources: ReadonlyArray<ResourceViewModel>;
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
