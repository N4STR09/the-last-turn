import type { Difficulty, PlayingGameState } from './types';

export function createGame(difficulty: Difficulty): PlayingGameState {
  return {
    difficulty,
    status: 'playing',
    turn: 1,
    hunger: 0,
    energy: 10,
    food: 0,
    health: 10,
    hasShelter: false,
  };
}
