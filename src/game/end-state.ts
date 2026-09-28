import type {
  DeathCause,
  EndCondition,
  FinishedGameState,
  GameCoreState,
  GameState,
} from './types';

function getEndCondition(state: GameCoreState): EndCondition | null {
  if (state.hunger > 10) {
    return 'hunger';
  }

  if (state.energy <= 0) {
    return 'energy';
  }

  // `<= 0` y no `=== 0`: el daño no siempre cae de uno en uno. Explorar quita de
  // 2 a 5 según la carga, así que la salud se salta el cero con facilidad. Con
  // igualdad exacta, a partir de carga 8 un jugador con salud 3 podía explorar
  // hasta quedar en negativo y seguir jugando, y la barra de salud dejaba de
  // ser un presupuesto.
  if (state.health <= 0) {
    return 'health';
  }

  return null;
}

function getReportedCause(state: GameCoreState): DeathCause {
  if (state.hunger >= 10) {
    return 'hunger';
  }

  if (state.energy <= 0) {
    return 'energy';
  }

  return 'health';
}

export function finishGame(state: GameCoreState): GameState {
  const condition = getEndCondition(state);

  if (condition === null) {
    return { ...state, status: 'playing' };
  }

  return {
    ...state,
    status: 'dead',
    end: {
      condition,
      reportedCause: getReportedCause(state),
      turnsSurvived: state.turn - 1,
    },
  };
}

/**
 * Rendirse termina la partida sin matar a nadie.
 *
 * No es un turno, así que no tira dados, no dispara eventos y no sube la
 * escalada: pasa por el mismo estado que `finishGame` devuelve, pero declara su
 * propio motivo. El recuento de turnos es el mismo porque son los mismos turnos
 * que el jugador llegó a completar.
 *
 * La firma acepta el estado completo y no solo `GameCoreState` porque quien la
 * llama tiene una partida viva, y por eso el motor deja constancia en el
 * resultado en lugar de validar.
 */
export function surrenderGame(state: GameState): FinishedGameState {
  return {
    ...state,
    status: 'dead',
    end: {
      condition: 'surrender',
      reportedCause: 'surrender',
      turnsSurvived: state.turn - 1,
    },
  };
}
