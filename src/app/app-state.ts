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

/**
 * El estado de arranque cuando la página se abre con un enlace de partida.
 *
 * La partida reproducida no arranca en la pantalla de inicio y salta a la muerte
 * después: nace ya muerta. Hacerlo de otra forma obligaría a pasar por el inicio
 * un instante, y ese instante se ve como un parpadeo de una pantalla que el
 * visitante no pidió. Además, reproducir en un efecto obligaría a pedir tres
 * cambios de estado seguidos, que es un render en cascada por el mismo motivo.
 *
 * La resolución que se guarda es la de verdad, la que cerró la partida. Por eso
 * la pantalla final no es un resumen: es exactamente la que habría visto quien
 * Jugó, con su última tirada y su último evento.
 */
export function createReplayedAppState(
  game: FinishedGameState,
  resolution: GameResolution,
): AppState {
  return {
    screen: 'dead',
    game,
    resolution,
    threatNotice: null,
  };
}
