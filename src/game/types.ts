export type Difficulty = 'normal' | 'agony';
export type GameStatus = 'playing' | 'dead';
export type EndCondition = 'hunger' | 'energy' | 'health';
export type DeathCause = 'hunger' | 'energy' | 'health';

export type GameAction =
  | 'help'
  | 'forage'
  | 'rest'
  | 'explore'
  | 'repair'
  | 'fish'
  | 'eat';

export type RandomInt = (min: number, max: number) => number;

export interface GameCoreState {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly hunger: number;
  readonly energy: number;
  readonly food: number;
  readonly health: number;
  readonly hasShelter: boolean;
}

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

export type ActionOutcome =
  | { readonly type: 'help' }
  | { readonly type: 'forage-found' }
  | { readonly type: 'forage-empty' }
  | { readonly type: 'rest-without-shelter' }
  | { readonly type: 'rest-shelter-miss' }
  | {
      readonly type: 'rest-shelter-success';
      readonly energyRecovered: 3 | 5;
    }
  | { readonly type: 'explore-shelter' }
  | { readonly type: 'explore-food' }
  | { readonly type: 'explore-empty' }
  | { readonly type: 'repair-failed' }
  | { readonly type: 'repair-succeeded' }
  | { readonly type: 'fish-catch'; readonly attempts: number }
  | { readonly type: 'eat-no-food' };

export type GameEvent =
  | { readonly type: 'storm' }
  | { readonly type: 'raccoon' }
  | { readonly type: 'meteorite' };

export type Milestone =
  | { readonly type: 'turn-15' }
  | { readonly type: 'turn-30' };

export interface GameResolution {
  readonly state: GameState;
  readonly actionOutcome: ActionOutcome;
  readonly randomEvent: GameEvent | null;
  readonly milestone: Milestone | null;
}
