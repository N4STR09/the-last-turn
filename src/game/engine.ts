import { resolveAction } from './actions';
import { finishGame } from './end-state';
import { resolveRandomEvents } from './events';
import { applyThreat } from './threat';
import type {
  GameAction,
  GameResolution,
  GameState,
  RandomInt,
} from './types';

export function resolveTurn(
  state: GameState,
  action: GameAction,
  randomInt: RandomInt,
): GameResolution {
  if (state.status === 'dead') {
    throw new Error('No se puede resolver una partida terminada.');
  }

  const actionResolution = resolveAction(state, action, randomInt);
  const eventResolution = resolveRandomEvents(
    actionResolution.state,
    randomInt,
  );
  const threatResolution = applyThreat(eventResolution.state);
  const finalState = finishGame(threatResolution.state);

  return {
    state: finalState,
    actionOutcome: actionResolution.outcome,
    randomEvents: eventResolution.events,
    // Si el turno mata, la pantalla de muerte gana y el aviso se suprime. El
    // nivel de amenaza ya está aplicado en el estado de todos modos.
    threatNotice: finalState.status === 'dead' ? null : threatResolution.notice,
  };
}
