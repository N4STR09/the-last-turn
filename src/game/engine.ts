import { resolveAction } from './actions';
import { finishGame } from './end-state';
import { applyRandomEvents, rollRandomEvents } from './events';
import { applyThreat } from './threat';
import type {
  GameAction,
  GameResolution,
  GameState,
  RandomInt,
} from './types';

/**
 * Un turno, en el orden en que se lee.
 *
 * La acción va primero porque es lo que el jugador eligió. Los eventos que caen
 * son los que el turno anterior ya había tirado y la terminal ya había
 * anunciado, así que el jugador sabe que le vienen antes de decidirlos. Después
 * sube la escalada, y solo entonces se tira lo que llegará al turno siguiente.
 *
 * El orden importa para el gasto: la acción cobra su energía, y el recargo del
 * evento se suma encima. Si el evento se aplicara antes, el jugador pagaría el
 * recargo de un turno en el que todavía no había actuado.
 */
export function resolveTurn(
  state: GameState,
  action: GameAction,
  randomInt: RandomInt,
): GameResolution {
  if (state.status === 'dead') {
    throw new Error('No se puede resolver una partida terminada.');
  }

  const announced = state.pendingEvents;
  const actionResolution = resolveAction(state, action, randomInt);
  const afterEvents = applyRandomEvents(actionResolution.state, announced);
  const threatResolution = applyThreat(afterEvents);
  const finished = finishGame(threatResolution.state);
  const alive = finished.status === 'playing';
  // Una partida muerta no tira por el turno siguiente: no hay turno siguiente, y
  // gastar una tirada para nada rompería las secuencias que las pruebas fijan.
  const pendingEvents = alive
    ? rollRandomEvents(threatResolution.state, randomInt)
    : [];

  return {
    state: { ...finished, pendingEvents },
    actionOutcome: actionResolution.outcome,
    randomEvents: announced,
    // Si el turno mata, la pantalla de muerte gana y el aviso se suprime. El
    // nivel de amenaza ya está aplicado en el estado de todos modos.
    threatNotice: alive ? threatResolution.notice : null,
  };
}
