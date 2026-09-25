import type {
  GameResolution,
  PlayingGameState,
  FinishedGameState,
} from '../game';

export type AppState =
  | {
      readonly screen: 'start' | 'difficulty';
      readonly game: null;
      readonly resolution: null;
    }
  | {
      readonly screen: 'playing';
      readonly game: PlayingGameState;
      readonly resolution: GameResolution | null;
    }
  | {
      readonly screen: 'dead';
      readonly game: FinishedGameState;
      readonly resolution: GameResolution;
    };

export type AppCommand =
  | { readonly type: 'show-difficulty' }
  | { readonly type: 'start-game'; readonly game: PlayingGameState }
  | { readonly type: 'resolve-action'; readonly resolution: GameResolution }
  | { readonly type: 'restart' };

export function createInitialAppState(): AppState {
  return {
    screen: 'start',
    game: null,
    resolution: null,
  };
}
