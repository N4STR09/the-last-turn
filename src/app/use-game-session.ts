import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { createGame, resolveTurn } from '../game';
import type {
  GameAction,
  GameResolution,
  GameState,
  PlayingGameState,
  RandomInt,
} from '../game';
import type { SurrenderControl as Surrender } from '../ui/components/SurrenderControl';
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
import { readReplayLink, readSeedOnly } from './seed-url';
import { replayGame } from './replay';
import {
  createRandomSeed,
  createSeededRandomInt,
  encodeReplayQuery,
  isReplayLink,
} from './seed';

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
  /** Enlace que reproduce la partida actual. Nulo hasta que hay partida muerta. */
  readonly shareUrl: string | null;
  readonly showDifficulty: () => void;
  readonly selectDifficulty: (difficulty: GameState['difficulty']) => void;
  readonly performAction: (action: GameAction) => void;
  readonly dismissThreatNotice: () => void;
  readonly surrender: Surrender;
  readonly restart: () => void;
}

export function useGameSession(
  options: GameSessionOptions = {},
): GameSession {
  const injected = options.randomInt;
  const resolve = options.resolveTurn ?? resolveTurn;
  const [state, dispatch] = useReducer(appReducer, createInitialAppState());
  const [previousGame, setPreviousGame] = useState<PlayingGameState | null>(
    null,
  );

  // Semilla, lista de acciones y mejor marca viven aquí y no en el reducer: son
  // cosas de la sesión, no de la pantalla. La semilla decide el azar, el registro
  // de acciones construye el enlace de replay y el desglose, y la mejor marca es
  // el rival fantasma. El reducer sigue siendo un `switch` sobre la pantalla.
  const [seed, setSeed] = useState<number | null>(null);
  const [actionLog, setActionLog] = useState<readonly GameAction[]>([]);
  const [best, setBest] = useState<number | null>(null);

  // El azar de la partida viva. Es un `ref` y no un `state` a propósito: la fuente
  // sembrada lleva su propio estado interno y tiene que ser la misma instancia
  // durante toda la partida, sin que un turnola vuelva a crear.
  const randomRef = useRef<RandomInt>(injected ?? browserRandomInt);

  // Si la URL trae una semilla suelta, esa semilla es la de la primera partida.
  // Se lee una vez, al montar, con inicialización perezosa.
  const [urlSeed] = useState(() => readSeedOnly());

  const showDifficulty = useCallback(() => {
    setPreviousGame(null);
    dispatch({ type: 'show-difficulty' });
  }, []);

  const selectDifficulty = useCallback(
    (difficulty: GameState['difficulty']) => {
      setPreviousGame(null);
      setActionLog([]);
      const gameSeed = urlSeed ?? createRandomSeed();
      setSeed(gameSeed);
      randomRef.current = injected ?? createSeededRandomInt(gameSeed);
      dispatch({ type: 'start-game', game: createGame(difficulty) });
    },
    [injected, urlSeed],
  );

  const dismissThreatNotice = useCallback(() => {
    dispatch({ type: 'dismiss-threat-notice' });
  }, []);

  const performAction = useCallback(
    (action: GameAction) => {
      // Con el aviso de escalada abierto o con la confirmación de rendirse
      // puesta, la partida está congelada: el click solo descarta el aviso,
      // nunca ejecuta una acción.
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.surrenderPending
      ) {
        return;
      }

      setPreviousGame(state.game);
      setActionLog((previous) => [...previous, action]);
      const randomInt = injected ?? randomRef.current;
      const resolution = resolve(state.game, action, randomInt);
      if (resolution.state.status === 'dead') {
        const survived = resolution.state.end.turnsSurvived;
        setBest((previous) =>
          previous === null ? survived : Math.max(previous, survived),
        );
      }
      dispatch({ type: 'resolve-action', resolution });
    },
    [injected, resolve, state],
  );

  const surrender = useMemo<Surrender>(
    () => ({
      pending: state.screen === 'playing' && state.surrenderPending,
      ask: () => {
        dispatch({ type: 'ask-surrender' });
      },
      cancel: () => {
        dispatch({ type: 'cancel-surrender' });
      },
      confirm: () => {
        dispatch({ type: 'surrender' });
        if (state.screen === 'playing') {
          const survived = state.game.turn;
          setBest((previous) =>
            previous === null ? survived : Math.max(previous, survived),
          );
        }
      },
    }),
    [state],
  );

  const restart = useCallback(() => {
    setPreviousGame(null);
    setActionLog([]);
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
      best,
    );
  }, [best, previousGame, state]);

  const gameOverModel = useMemo(() => {
    if (state.screen !== 'dead' || seed === null) {
      return null;
    }

    return createGameOverViewModel(state.game, seed, actionLog);
  }, [actionLog, seed, state]);

  const shareUrl = useMemo(() => {
    if (state.screen !== 'dead' || seed === null || typeof window === 'undefined') {
      return null;
    }

    const query = encodeReplayQuery({
      seed,
      difficulty: state.game.difficulty,
      actions: actionLog,
    });
    return `${window.location.origin}${window.location.pathname}?${query}`;
  }, [actionLog, seed, state]);

  const threatNoticeModel = useMemo(() => {
    if (state.screen !== 'playing' || state.threatNotice === null) {
      return null;
    }

    return createThreatNoticeViewModel(state.threatNotice);
  }, [state]);

  // Reproducir una partida compartida. Se lee la URL una vez al montar y, si trae
  // semilla, dificultad y acciones, se recorre con el mismo motor sembrado: el
  // resultado es la partida original, con su autopsy y su parte. Se despacha la
  // última resolución real, así que la pantalla final es la de verdad y no un
  // resumen. Un enlace manipulado que no muere se queda en la pantalla de
  // dificultad, porque sin muerte no hay nada que reproducir.
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current) {
      return;
    }
    const link = readReplayLink();
    if (!isReplayLink(link)) {
      return;
    }
    replayed.current = true;

    const result = replayGame(link.seed, link.difficulty, link.actions);
    if (result.state.status === 'dead' && result.resolution !== null) {
      setSeed(link.seed);
      setActionLog(link.actions);
      dispatch({ type: 'resolve-action', resolution: result.resolution });
    }
  }, []);

  // Los atajos se desactivan con el aviso abierto y con la confirmación de
  // rendirse puesta, para que una tecla no ejecute acciones sobre una partida
  // congelada. Es la misma condición que protege el click, escrita donde el
  // teclado entra.
  useActionShortcuts(
    state.screen === 'playing' &&
      state.threatNotice !== null === false &&
      !state.surrenderPending,
    performAction,
  );

  return {
    state,
    gameModel,
    gameOverModel,
    threatNoticeModel,
    shareUrl,
    showDifficulty,
    selectDifficulty,
    performAction,
    dismissThreatNotice,
    surrender,
    restart,
  };
}
