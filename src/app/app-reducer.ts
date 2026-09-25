import type { AppCommand, AppState } from './app-state';

export function appReducer(state: AppState, command: AppCommand): AppState {
  switch (command.type) {
    case 'show-difficulty':
      return {
        screen: 'difficulty',
        game: null,
        resolution: null,
      };
    case 'start-game':
      return {
        screen: 'playing',
        game: command.game,
        resolution: null,
      };
    case 'resolve-action': {
      if (command.resolution.state.status === 'dead') {
        return {
          screen: 'dead',
          game: command.resolution.state,
          resolution: command.resolution,
        };
      }

      return {
        screen: 'playing',
        game: command.resolution.state,
        resolution: command.resolution,
      };
    }
    case 'restart':
      return {
        screen: 'difficulty',
        game: null,
        resolution: null,
      };
    default:
      return state;
  }
}
