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
      /**
       * Confirmación de rendirse abierta. Vive en el estado y no en la
       * pantalla por la misma razón que el aviso: mientras esté puesta, la
       * partida está congelada y los atajos no deben disparar turnos.
       */
      readonly surrenderPending: boolean;
    }
  | {
      readonly screen: 'dead';
      readonly game: FinishedGameState;
      /**
       * Nulo cuando la partida terminó porque el jugador se rindió: no hubo
       * ningún turno que resolver, así que no hay resolución que conservar.
       */
      readonly resolution: GameResolution | null;
      readonly threatNotice: null;
    };

export type AppCommand =
  | { readonly type: 'show-difficulty' }
  | { readonly type: 'start-game'; readonly game: PlayingGameState }
  | { readonly type: 'resolve-action'; readonly resolution: GameResolution }
  | { readonly type: 'dismiss-threat-notice' }
  | { readonly type: 'ask-surrender' }
  | { readonly type: 'cancel-surrender' }
  | { readonly type: 'surrender' }
  | { readonly type: 'restart' };

export function createInitialAppState(): AppState {
  return {
    screen: 'start',
    game: null,
    resolution: null,
    threatNotice: null,
  };
}
