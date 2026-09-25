import { useCallback, useMemo, useReducer, useState } from 'react';

import { createGame, resolveTurn } from '../game';
import type {
  GameAction,
  GameResolution,
  GameState,
  PlayingGameState,
  RandomInt,
} from '../game';
import type {
  GameOverViewModel,
  GameViewModel,
  ThreatNoticeViewModel,
} from '../ui/view-models/ui-types';
import { appReducer } from './app-reducer';
import { createInitialAppState, type AppState } from './app-state';
import { browserRandomInt } from './browser-random';
import {
  createGameOverViewModel,
  createGameViewModel,
} from './game-view-model';
import { createThreatNoticeViewModel } from './threat-copy';
import { useActionShortcuts } from './app-keyboard';

export interface GameSessionOptions {
  readonly randomInt?: RandomInt;
  readonly resolveTurn?: (
    state: GameState,
    action: GameAction,
    randomInt: RandomInt,
  ) => GameResolution;
}

export interface GameSession {
  readonly state: AppState;
  readonly gameModel: GameViewModel | null;
  readonly gameOverModel: GameOverViewModel | null;
  readonly threatNoticeModel: ThreatNoticeViewModel | null;
  readonly showDifficulty: () => void;
  readonly selectDifficulty: (difficulty: GameState['difficulty']) => void;
  readonly performAction: (action: GameAction) => void;
  readonly dismissThreatNotice: () => void;
  readonly restart: () => void;
}

export function useGameSession(
  options: GameSessionOptions = {},
): GameSession {
  const randomInt = options.randomInt ?? browserRandomInt;
  const resolve = options.resolveTurn ?? resolveTurn;
  const [state, dispatch] = useReducer(appReducer, createInitialAppState());
  const [previousGame, setPreviousGame] = useState<PlayingGameState | null>(
    null,
  );

  const showDifficulty = useCallback(() => {
    setPreviousGame(null);
    dispatch({ type: 'show-difficulty' });
  }, []);

  const selectDifficulty = useCallback(
    (difficulty: GameState['difficulty']) => {
      setPreviousGame(null);
      dispatch({ type: 'start-game', game: createGame(difficulty) });
    },
    [],
  );

  const dismissThreatNotice = useCallback(() => {
    dispatch({ type: 'dismiss-threat-notice' });
  }, []);

  const performAction = useCallback(
    (action: GameAction) => {
      // Con el aviso de escalada abierto la partida está congelada: el click
      // solo descarta el aviso, nunca ejecuta una acción.
      if (state.screen !== 'playing' || state.threatNotice !== null) {
        return;
      }

      setPreviousGame(state.game);
      const resolution = resolve(state.game, action, randomInt);
      dispatch({ type: 'resolve-action', resolution });
    },
    [randomInt, resolve, state],
  );

  const restart = useCallback(() => {
    setPreviousGame(null);
    dispatch({ type: 'restart' });
  }, []);

  const gameModel = useMemo(() => {
    if (state.screen !== 'playing') {
      return null;
    }

    return createGameViewModel(
      state.game,
      state.resolution,
      previousGame ?? undefined,
    );
  }, [previousGame, state]);

  const gameOverModel = useMemo(() => {
    if (state.screen !== 'dead') {
      return null;
    }

    return createGameOverViewModel(state.game);
  }, [state]);

  const threatNoticeModel = useMemo(() => {
    if (state.screen !== 'playing' || state.threatNotice === null) {
      return null;
    }

    return createThreatNoticeViewModel(state.threatNotice);
  }, [state]);

  // Los atajos se desactivan también con el aviso abierto, para que una tecla
  // no ejecute acciones sobre una partida congelada.
  useActionShortcuts(
    state.screen === 'playing' && state.threatNotice === null,
    performAction,
  );

  return {
    state,
    gameModel,
    gameOverModel,
    threatNoticeModel,
    showDifficulty,
    selectDifficulty,
    performAction,
    dismissThreatNotice,
    restart,
  };
}
