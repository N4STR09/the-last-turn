import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { createGame, resolveTurn, surrenderGame } from '../game';
import type {
  FinishedGameState,
  GameAction,
  GameResolution,
  GameState,
  PlayingGameState,
  RandomInt,
} from '../game';
import type { SurrenderControl as Surrender } from '../ui/components/SurrenderControl';
import type { SettingsControl as Settings } from '../ui/components/SettingsMenu';
import type {
  GameOverViewModel,
  GameViewModel,
  ThreatNoticeViewModel,
} from '../ui/view-models/ui-types';
import { appReducer } from './app-reducer';
import type { AppState } from './app-state';
import { bootState, readBoot } from './boot';
import { browserRandomInt } from './browser-random';
import {
  createGameOverViewModel,
  createGameViewModel,
} from './game-view-model';
import { createRulesViewModel } from './rules';
import { fetchStats, reportGame } from './stats';
import type { GameReport, StatsSummary } from './stats';
import { createThreatNoticeViewModel } from './threat-copy';
import { useActionShortcuts } from './app-keyboard';
import { buildShareUrl, readSeedOnly } from './seed-url';
import { createRandomSeed, createSeededRandomInt, encodeSeed } from './seed';

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
  /** El menú de ajustes y la hoja de reglas. Nulo fuera de la partida. */
  readonly settings: Settings | null;
  readonly restart: () => void;
  /**
   * Lo que hace falta cuando cambia la cuenta, que lo sabe el panel y no aquí.
   *
   * Es el único punto por el que la cuenta entra en esta sesión, y entra como un
   * aviso y no como estado: sigue sin arrastrar ningún cambio de pantalla. Lo
   * que se hace con el aviso es subir lo que quedó pendiente y volver a leer la
   * marca, que son las dos cosas que solo se pueden hacer cuando ya hay con quién
   * hablar.
   */
  readonly accountChanged: (autenticado: boolean) => Promise<void>;
}

export function useGameSession(
  options: GameSessionOptions = {},
): GameSession {
  const injected = options.randomInt;
  const resolve = options.resolveTurn ?? resolveTurn;

  // Lo que la URL dice al abrir se lee una vez y decide el arranque entero: o la
  // página viene con un enlace de partida y nace ya muerta, o nace normal. No hay
  // un efecto que lo cambie después, porque eso pintaría primero la pantalla de
  // inicio y luego saltaría a la de muerte, y ese parpadeo se lee como un fallo.
  const [boot] = useState(readBoot);
  const [state, dispatch] = useReducer(appReducer, boot, bootState);
  const [previousGame, setPreviousGame] = useState<PlayingGameState | null>(
    null,
  );

  // Semilla, registro de acciones y mejor marca viven aquí y no en el reducer: son
  // cosas de la sesión, no de la pantalla. La semilla decide el azar y construye
  // el enlace, el registro da el desglose y las letras del enlace, y la mejor
  // marca es el rival fantasma. El reducer sigue siendo un `switch` sobre la
  // pantalla, que es lo que tiene que seguir siendo.
  //
  // Cuando la página se abre con un enlace, los tres empiezan ya puestos: la
  // partida viene con su semilla y su registro, y no hay forma de que la
  // reproducible se parezca a la jugada sin ellos.
  const [seed, setSeed] = useState<number | null>(boot?.link.seed ?? null);
  const [records, setRecords] = useState<readonly GameAction[]>(
    boot?.result.records ?? [],
  );
  const [best, setBest] = useState<number | null>(null);
  // La mejor partida de antes de empezar la que se está jugando. Es la única que
  // puede decir si la actual es un récord, y por eso se fija al empezar y no se
  // toca al morir.
  const [bestBefore, setBestBefore] = useState<number | null>(null);
  const [replayed, setReplayed] = useState(boot !== null);

  // El azar de la partida viva. Es un `ref` y no un `state` a propósito: la fuente
  // sembrada lleva su propio estado interno y tiene que ser la misma instancia
  // durante toda la partida, sin que un turno la vuelva a crear.
  const randomRef = useRef<RandomInt>(injected ?? browserRandomInt);

  // Si la URL trae una semilla suelta, esa semilla es la de la primera partida.
  // Se lee una vez, al montar, con inicialización perezosa. Un enlace de partida
  // también trae semilla, pero esa ya está en `boot` y es de una partida muerta:
  // abrirla en Normal daría una partida nueva con el mismo azar, que es otra
  // cosa distinta de repetirla.
  const [urlSeed] = useState(() => (boot === null ? readSeedOnly() : null));

  // Las estadísticas de la cuenta.
  //
  // `pending` es la cola de partidas que el servidor todavía no ha reconocido.
  // Vive en un `ref` y no en estado porque no pinta nada: no cambia ninguna
  // pantalla y no hace falta que renderice nadie para leerla. Mientras no hay
  // sesión las partidas se quedan aquí y se suben la primera vez que la hay,
  // que es lo que significa "subir lo jugado de invitado".
  //
  // `signedIn` dice si hay con quién hablar. Se pone con la respuesta de la
  // propia consulta al arrancar y con el aviso del panel de cuenta, y no se
  // deduce de una petición fallida: "el servidor no ha contestado" y "no hay
  // sesión" son dos cosas distintas y solo una de las dos se arregla sola.
  //
  // `reported` es la muerte ya subida, guardada por identidad de objeto. El
  // efecto que la cuenta solo se mueve cuando cambia su estado, y eso no ocurre
  // dos veces por la misma muerte; lo que sí ocurre es que un cambio en este
  // archivo durante el desarrollo vuelva a lanzar los efectos con la misma
  // pantalla encima, y entonces haría falta esto para no subir dos veces una
  // partida cuyo contador no baja.
  const pending = useRef<GameReport[]>([]);
  const signedIn = useRef(false);
  const reported = useRef<FinishedGameState | null>(null);

  const showDifficulty = useCallback(() => {
    setPreviousGame(null);
    dispatch({ type: 'show-difficulty' });
  }, []);

  const selectDifficulty = useCallback(
    (difficulty: GameState['difficulty']) => {
      setPreviousGame(null);
      setRecords([]);
      // A partir de aquí la partida es del visitante. Si venía de un enlace, deja
      // de serlo: su muerte no era suya y no puede quedarse con su marca.
      setReplayed(false);
      // La marca de antes de empezar. La de ahora mismo no sirve para saber si esta
      // partida es un récord, porque al morir ya incluye a esta misma partida y
      // saldría siempre un empate.
      setBestBefore(best);
      const gameSeed = urlSeed ?? createRandomSeed();
      setSeed(gameSeed);
      randomRef.current = injected ?? createSeededRandomInt(gameSeed);
      dispatch({ type: 'start-game', game: createGame(difficulty) });
    },
    [best, injected, urlSeed],
  );

  const dismissThreatNotice = useCallback(() => {
    dispatch({ type: 'dismiss-threat-notice' });
  }, []);

  const performAction = useCallback(
    (action: GameAction) => {
      // Con el aviso de escalada abierto, con la confirmación de rendirse puesta o
      // con el menú o la ayuda encima, la partida está congelada: el click solo
      // descarta el aviso, nunca ejecuta una acción.
      if (
        state.screen !== 'playing' ||
        state.threatNotice !== null ||
        state.surrenderPending ||
        state.overlay !== 'none'
      ) {
        return;
      }

      setPreviousGame(state.game);
      setRecords((previous) => [...previous, action]);
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
          // La cuenta la hace el motor y no esta capa. Calcularla aquí aparte
          // sería copiar la regla del contador, y las dos copias ya discreparon
          // una vez: la partida se anunciaba como un turno aguantado y la marca la
          // guardaba como dos. Preguntándoselo al motor no puede pasar.
          const survived = surrenderGame(state.game).end.turnsSurvived;
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
    setRecords([]);
    dispatch({ type: 'restart' });
  }, []);

  // Fundir la marca del servidor con la de esta sesión.
  //
  // Con `Math.max` y no con una asignación. Las dos son marcas de lo mismo —cuánto
  // se aguantó— y por eso la de esta sesión no borra la de la cuenta ni al revés:
  // si aquí se sobrevivió más, aquí está la marca que hay que batir.
  const mergeBest = useCallback((summary: StatsSummary | null) => {
    if (summary === null || summary.bestTurns === null) {
      return;
    }
    const remote = summary.bestTurns;
    setBest((previous) =>
      previous === null ? remote : Math.max(previous, remote),
    );
  }, []);

  // Sube lo que queda pendiente, mientras haya con quién.
  //
  // La partida se saca de la cola antes de mandarla y se devuelve al frente si
  // no pudo subirse. Sacarla antes es lo que hace imposible que dos envíos se
  // lleven la misma: entre comprobar que queda algo y sacarlo no hay ningún
  // `await`, y JavaScript no deja que entre nada por el medio. Así que no hace
  // falta un guardia que impida dos envíos a la vez —que, aun existiendo,
  // repartirían la cola en vez de duplicarla—.
  const flushReports = useCallback(async () => {
    if (!signedIn.current) {
      return;
    }

    while (pending.current.length > 0) {
      // No puede faltar: el `while` acaba de comprobar que queda algo. El `!`
      // está ahí porque el compilador no sabe leer esa comprobación, no porque
      // se ignore una posibilidad.
      const siguiente = pending.current.shift()!;
      if (!(await reportGame(siguiente))) {
        // Sin sesión o sin red. La partida vuelve a la cola: lo que no se pudo
        // subir no se pierde, se vuelve a intentar en el próximo aviso.
        pending.current.unshift(siguiente);
        break;
      }
    }
  }, []);

  // Lo que hace falta cuando el panel de cuenta sabe que la sesión ha cambiado.
  //
  // No es estado de la partida y no mueve ninguna pantalla: es un aviso. Al
  // entrar se sube primero lo de invitado y se lee después, para que la marca
  // que llega ya incluya lo que se acaba de subir. Al salir se tira la cola y se
  // deja de subir: sin forma de saber de qué cuenta eran esas partidas,
  // mandárselas al siguiente que entre sería peor que perderlas.
  //
  // La marca no se borra al salir. Las partidas de esta sesión se jugaron aquí,
  // siguen estando en la sesión, y quitarlas haría que la comparación del
  // récord dependiera de si alguien entró o salió en mitad de la página.
  const accountChanged = useCallback(
    async (autenticado: boolean) => {
      if (!autenticado) {
        signedIn.current = false;
        pending.current = [];
        return;
      }

      signedIn.current = true;
      await flushReports();
      mergeBest(await fetchStats());
    },
    [flushReports, mergeBest],
  );

  // La marca del servidor, al abrir.
  //
  // Se hace aquí y no dentro del panel de cuenta porque la marca es de la sesión
  // de juego: es con la que se compara al empezar y con la que se enseña al
  // morir. El panel solo sabe si hay alguien dentro, que es lo que necesita para
  // dibujarse.
  useEffect(() => {
    let alive = true;
    void fetchStats().then((summary) => {
      if (!alive) {
        return;
      }
      if (summary !== null) {
        signedIn.current = true;
      }
      mergeBest(summary);
      void flushReports();
    });

    return () => {
      alive = false;
    };
  }, [flushReports, mergeBest]);

  // Subir la partida al morir.
  //
  // Va en un efecto y no dentro de `performAction` ni de la rendición por dos
  // motivos. El primero es que así no hay una tercera forma de morir que pueda
  // olvidarse de avisar: haya las que haya, hay un solo sitio que las cuenta. El
  // segundo es que el estado de la pantalla `dead` es lo que el motor acaba de
  // devolver, con su cuenta de turnos y su nivel, así que se le pregunta una
  // vez más y en su sitio.
  //
  // `replayed` no sube nada. La muerte de un enlace no es del que la ve, y eso
  // ya está dicho en `selectDifficulty`, que es donde la partida pasa a ser
  // suya.
  useEffect(() => {
    if (
      state.screen !== 'dead' ||
      replayed ||
      state.game === reported.current
    ) {
      return;
    }

    reported.current = state.game;
    pending.current.push({
      turns: state.game.end.turnsSurvived,
      level: state.game.threat,
      difficulty: state.game.difficulty,
    });
    void flushReports();
  }, [flushReports, replayed, state]);

  // El menú de ajustes y la hoja de reglas.
  //
  // Nace aquí y no dentro del modelo del juego porque la hoja no es el estado del
  // tablero: es una referencia que apenas cambia, y meterla en el modelo obligaría a
  // reconstruirla y compararla en cada turno para nada. La semilla sí es de la
  // partida, y por eso se enseña en el menú: es el único sitio donde el jugador
  // puede verla mientras juega, y es lo que hace que el enlace de después
  // signifique algo.
  //
  // Mismo corte que el parte: sin partida en curso no hay hoja que escribir, porque
  // la hoja habla de los precios y el nivel de esta partida, y sin semilla no hay
  // nada que enseñar en el menú.
  const settings = useMemo<Settings | null>(() => {
    if (state.screen !== 'playing' || seed === null) {
      return null;
    }

    return {
      overlay: state.overlay,
      seedLabel: encodeSeed(seed),
      rules: createRulesViewModel(state.game),
      open: () => {
        dispatch({ type: 'open-settings' });
      },
      showRules: () => {
        dispatch({ type: 'open-rules' });
      },
      close: () => {
        dispatch({ type: 'close-overlay' });
      },
    };
  }, [seed, state]);

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

  // `replayed` marca que esta muerte es la de otra persona, no la del visitante.
  // Vive en la sesión porque la reproducción ocurre al montar y el estado del
  // juego no tiene por qué saber por qué llegó a ese punto. `bestBefore` viaja
  // aquí por lo mismo: el récord es una comparación entre partidas, y esa
  // comparación no le corresponde al motor.
  const gameOverModel = useMemo(() => {
    if (state.screen !== 'dead' || seed === null) {
      return null;
    }

    return createGameOverViewModel(
      state.game,
      records,
      seed,
      replayed,
      bestBefore,
    );
  }, [bestBefore, records, replayed, seed, state]);

  const threatNoticeModel = useMemo(() => {
    if (state.screen !== 'playing' || state.threatNotice === null) {
      return null;
    }

    return createThreatNoticeViewModel(state.threatNotice);
  }, [state]);

  // El enlace de esta muerte. Se construye desde la semilla y el registro, que
  // son las dos únicas cosas que identifican una partida. La barra de direcciones
  // no se toca: el enlace existe, pero solo cuando alguien lo pide.
  const shareUrl = useMemo(() => {
    if (
      state.screen !== 'dead' ||
      seed === null ||
      typeof window === 'undefined'
    ) {
      return null;
    }

    return buildShareUrl({
      seed,
      difficulty: state.game.difficulty,
      actions: records,
    });
  }, [records, seed, state]);

  // Los atajos se desactivan con el aviso abierto, con la confirmación de rendirse
  // puesta y con el menú o la ayuda encima, para que una tecla no ejecute acciones
  // sobre una partida congelada. Es la misma condición que protege el click,
  // escrita donde el teclado entra.
  useActionShortcuts(
    state.screen === 'playing' &&
      state.threatNotice === null &&
      !state.surrenderPending &&
      state.overlay === 'none',
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
    settings,
    restart,
    accountChanged,
  };
}
