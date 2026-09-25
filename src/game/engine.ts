import { resolveAction } from './actions';
import { applyDifficulty } from './difficulty';
import { finishGame } from './end-state';
import { resolveRandomEvent } from './events';
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
  const eventResolution = resolveRandomEvent(
    actionResolution.state,
    randomInt,
  );
  const difficultyResolution = applyDifficulty(eventResolution.state);
  const finalState = finishGame(difficultyResolution.state);

  return {
    state: finalState,
    actionOutcome: actionResolution.outcome,
    randomEvent: eventResolution.event,
    milestone: difficultyResolution.milestone,
  };
}
