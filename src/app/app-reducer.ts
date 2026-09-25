import type { AppCommand, AppState } from './app-state';

export function appReducer(state: AppState, command: AppCommand): AppState {
  switch (command.type) {
    case 'show-difficulty':
      return {
        screen: 'difficulty',
        game: null,
        resolution: null,
        threatNotice: null,
      };
    case 'start-game':
      return {
        screen: 'playing',
        game: command.game,
        resolution: null,
        threatNotice: null,
      };
    case 'resolve-action': {
      if (command.resolution.state.status === 'dead') {
        return {
          screen: 'dead',
          game: command.resolution.state,
          resolution: command.resolution,
          threatNotice: null,
        };
      }

      return {
        screen: 'playing',
        game: command.resolution.state,
        resolution: command.resolution,
        threatNotice: command.resolution.threatNotice,
      };
    }
    case 'dismiss-threat-notice': {
      // El aviso solo existe sobre una partida viva; el estado del juego y la
      // última resolución no se tocan al descartarlo.
      if (state.screen !== 'playing' || state.threatNotice === null) {
        return state;
      }

      return {
        ...state,
        threatNotice: null,
      };
    }
    case 'restart':
      return {
        screen: 'difficulty',
        game: null,
        resolution: null,
        threatNotice: null,
      };
    default:
      return state;
  }
}
