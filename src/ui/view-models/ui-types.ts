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
  readonly event: EventViewModel | null;
  readonly milestone: string | null;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly resources: ReadonlyArray<ResourceViewModel>;
  readonly resolution: ResolutionViewModel | null;
}

export interface GameOverViewModel {
  readonly difficulty: Difficulty;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
}
