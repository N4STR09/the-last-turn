import { surrenderGame } from '../game';
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
        surrenderPending: false,
        overlay: 'none',
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
        surrenderPending: false,
        // Un turno resuelto cierra lo que hubiera encima. No debería poder
        // resolverse con un overlay puesto, porque el atajo está bloqueado
        // mientras lo esté, pero dejarlo escrito evita que un camino nuevo se
        // lleve por delante la única garantía de que el menú no se queda huérfano.
        overlay: 'none',
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
    case 'ask-surrender': {
      // Con el aviso de escalada abierto, o con el menú o la ayuda puestos, la
      // pantalla ya está cubierta: rendirse detrás de algo sería aceptar una
      // derrota sin haberla visto.
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.overlay !== 'none'
      ) {
        return state;
      }

      return {
        ...state,
        surrenderPending: true,
      };
    }
    case 'cancel-surrender': {
      if (state.screen !== 'playing' || !state.surrenderPending) {
        return state;
      }

      return {
        ...state,
        surrenderPending: false,
      };
    }
    case 'surrender': {
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.overlay !== 'none'
      ) {
        return state;
      }

      return {
        screen: 'dead',
        game: surrenderGame(state.game),
        resolution: null,
        threatNotice: null,
      };
    }
    case 'open-settings': {
      // Con el aviso de escalada abierto la pantalla ya está cubierta, y el menú
      // detrás de él sería un menú que no se ve. Detrás de la confirmación de
      // rendirse pasa lo mismo.
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.surrenderPending
      ) {
        return state;
      }

      return {
        ...state,
        overlay: 'settings',
      };
    }
    case 'open-rules': {
      // La hoja sustituye al menú en vez de apilarse encima: dos capas para
      // llegar a la ayuda obligarían a cerrar dos veces para volver al juego.
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.surrenderPending
      ) {
        return state;
      }

      return {
        ...state,
        overlay: 'rules',
      };
    }
    case 'close-overlay': {
      if (state.screen !== 'playing' || state.overlay === 'none') {
        return state;
      }

      return {
        ...state,
        overlay: 'none',
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
