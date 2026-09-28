import type { Difficulty, GameAction, RandomInt } from '../game/types';

/**
 * Semilla y enlaces de partida.
 *
 * El motor ya es determinista: todo el azar entra por un `RandomInt` inyectado y
 * ninguna acción tira más de una vez por turno. Lo que faltaba era decidir de
 * dónde sale ese azar y poder escribirlo. Este módulo es la pieza que lo decide,
 * y es puro a propósito: ni el navegador ni React aparecen aquí, así que se
 * puede probar sin jsdom y el motor sigue sin dependencias.
 *
 * Semilla: un entero de 32 bits sin signo, escrito en base 36 para que ocupe
 * poco en la URL. Enlace de partida: la semilla, la dificultad y la lista de
 * acciones, una letra por turno. Con eso, y solo con eso, la página reproduce la
 * partida exacta, porque el motor replayea con la misma semilla y las mismas
 * acciones. No hay nada que guardar en ningún sitio: el enlace es el estado.
 */

/** Máximo de una semilla de 32 bits sin signo. */
const MAX_SEED = 0xffffffff;

/**
 * Generador mulberry32. Es el mismo con el que se midió el endgame, así que una
 * partida sembrada con esta función es comparable con las de la medición y no
 * con otra familia de números.
 *
 * Devuelve valores en [0, 1). Entero de 32 bits, operaciones en aritmética de 32
 * bits sin signo, sin estado oculto más allá de la propia semilla.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fuente de azar determinista para una semilla dada. Es la única función del
 * módulo que el motor llega a ejecutar.
 */
export function createSeededRandomInt(seed: number): RandomInt {
  const next = mulberry32(seed);

  return (min, max) => min + Math.floor(next() * (max - min + 1));
}

/**
 * Semilla nueva para una partida que no viene de un enlace. Es el único sitio
 * del proyecto donde se llama a `Math.random`: a partir de aquí, la partida vive
 * de su semilla y no del azar del navegador.
 */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

/** Escribe la semilla en base 36 para la URL. */
export function encodeSeed(seed: number): string {
  return (seed >>> 0).toString(36);
}

/**
 * Lee una semilla de la URL. Devuelve `null` si no es un entero válido dentro
 * del rango, para que un enlace corrupto arranque una partida normal en vez de
 * romper la página.
 */
export function decodeSeed(text: string): number | null {
  if (text.length === 0 || !/^[0-9a-z]+$/i.test(text)) {
    return null;
  }

  const value = Number.parseInt(text, 36);
  if (!Number.isInteger(value) || value < 0 || value > MAX_SEED) {
    return null;
  }

  return value;
}

/**
 * Una letra por acción, una acción por turno. Son las mismas letras que los
 * atajos de teclado —explorar, comer, curar, descansar, reparar— para que un
 * enlace se lea con el mismo alfabeto con el que se juega.
 */
const actionLetters: Readonly<Record<GameAction, string>> = {
  explore: 'e',
  eat: 'c',
  cure: 's',
  rest: 'd',
  repair: 'r',
};

const letterActions: Readonly<Record<string, GameAction>> = {
  e: 'explore',
  c: 'eat',
  s: 'cure',
  d: 'rest',
  r: 'repair',
};

/** Codifica la lista de acciones como una cadena de letras. */
export function encodeActionLog(actions: readonly GameAction[]): string {
  return actions.map((action) => actionLetters[action]).join('');
}

/** Lee la lista de acciones de un enlace. `null` si hay alguna letra desconocida. */
export function decodeActionLog(text: string): GameAction[] | null {
  const actions: GameAction[] = [];

  for (const letter of text) {
    const action = letterActions[letter];
    if (action === undefined) {
      return null;
    }
    actions.push(action);
  }

  return actions;
}

const difficultyLetters: Readonly<Record<Difficulty, string>> = {
  normal: 'n',
  agony: 'a',
};

const letterDifficulties: Readonly<Record<string, Difficulty>> = {
  n: 'normal',
  a: 'agony',
};

export function encodeDifficulty(difficulty: Difficulty): string {
  return difficultyLetters[difficulty];
}

export function decodeDifficulty(text: string): Difficulty | null {
  return letterDifficulties[text] ?? null;
}

export interface ReplayLink {
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly actions: readonly GameAction[];
}

/**
 * Monta la parte de la URL que reproduce una partida. Solo la query: quien quiera
 * el enlace entero lo junta con la ruta.
 *
 * La lista de acciones se escapa con `encodeURIComponent` aunque hoy sean letras
 * ASCII, para que el enlace siga siendo válido si el alfabeto crece.
 */
export function encodeReplayQuery(link: ReplayLink): string {
  const seed = encodeSeed(link.seed);
  const difficulty = encodeDifficulty(link.difficulty);
  const actions = encodeActionLog(link.actions);
  return `seed=${seed}&d=${difficulty}&a=${encodeURIComponent(actions)}`;
}

/**
 * Lee una URL de partida. Devuelve `null` si falta la semilla, la dificultad o
 * la lista, o si cualquiera de las tres está corrupta. Un enlace roto no puede
 * romper la aplicación: se cae a una partida normal.
 */
export function parseReplayQuery(search: string): ReplayLink | null {
  const params = new URLSearchParams(search);
  const rawSeed = params.get('seed');
  const rawDifficulty = params.get('d');
  const rawActions = params.get('a');

  if (rawSeed === null || rawDifficulty === null || rawActions === null) {
    return null;
  }

  const seed = decodeSeed(rawSeed);
  const difficulty = decodeDifficulty(rawDifficulty);
  const actions = decodeActionLog(rawActions);

  if (seed === null || difficulty === null || actions === null) {
    return null;
  }

  return { seed, difficulty, actions };
}

/**
 * ¿Es esta URL una partida compartida? Lo que la distingue de una semilla suelta
 * es que trae las acciones: sin ellas hay una semilla que abrir, que es otra
 * cosa, y con ellas hay una partida que reproducir.
 */
export function isReplayLink(link: ReplayLink | null): link is ReplayLink {
  return link !== null && link.actions.length > 0;
}
