import type {
  GameResolution,
  PlayingGameState,
  FinishedGameState,
  ThreatNotice,
} from '../game';

export type AppState =
  | {
      readonly screen: 'start' | 'difficulty';
      readonly game: null;
      readonly resolution: null;
      readonly threatNotice: null;
    }
  | {
      readonly screen: 'playing';
      readonly game: PlayingGameState;
      readonly resolution: GameResolution | null;
      /** Aviso de escalada abierto: la partida está congelada hasta descartarlo. */
      readonly threatNotice: ThreatNotice | null;
    }
  | {
      readonly screen: 'dead';
      readonly game: FinishedGameState;
      readonly resolution: GameResolution;
      readonly threatNotice: null;
    };

export type AppCommand =
  | { readonly type: 'show-difficulty' }
  | { readonly type: 'start-game'; readonly game: PlayingGameState }
  | { readonly type: 'resolve-action'; readonly resolution: GameResolution }
  | { readonly type: 'dismiss-threat-notice' }
  | { readonly type: 'restart' };

export function createInitialAppState(): AppState {
  return {
    screen: 'start',
    game: null,
    resolution: null,
    threatNotice: null,
  };
}
