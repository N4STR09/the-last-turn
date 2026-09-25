import type { GameCoreState } from '..';

export const baseCoreState: GameCoreState = {
  difficulty: 'normal',
  turn: 1,
  hunger: 0,
  energy: 10,
  food: 0,
  health: 10,
  hasShelter: false,
  threat: 0,
};

export function createCoreState(
  overrides: Partial<GameCoreState> = {},
): GameCoreState {
  return { ...baseCoreState, ...overrides };
}
