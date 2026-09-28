import type { GameCoreState, ThreatNotice } from './types';

/**
 * Carga mecánica máxima. `threat` sigue subiendo y sigue generando avisos, pero
 * los modificadores se saturan aquí para que la partida siga siendo jugable.
 */
export const MAX_THREAT_LOAD = 10;

export function threatLoad(threat: number): number {
  return Math.min(threat, MAX_THREAT_LOAD);
}

/** Turno exacto en el que se alcanza el nivel `level`. */
export function threatThreshold(level: number): number {
  return level * level + 9 * level;
}

/** Nivel de amenaza que corresponde a un turno dado. */
export function threatForTurn(turn: number): number {
  let level = 0;

  while (threatThreshold(level + 1) <= turn) {
    level += 1;
  }

  return level;
}

export function extraHungerPerTurn(threat: number): number {
  return Math.min(4, Math.floor(threatLoad(threat) / 3));
}

/**
 * Hambre que cuesta cada turno: el 1 del coste normal más el extra de amenaza.
 * Con amenaza 0 el extra es 0 y el coste es el de siempre.
 *
 * El extra se frena en 4 y divide entre 3, no entre 2. Con `min(6, ⌊carga/2⌋)`
 * el hambre por turno llegaba a 7 mientras una ración solo quitaba 10: el
 * sumidero de calorías se comía el presupuesto entero de turnos hacia la carga
 * 6 y el de medicina ya no se podía pagar, así que la partida no era renewable
 * por construcción y el techo absoluto se quedaba en el turno 97. Es el freno
 * que hace que la escalada siga apretando sin convertirse en un muro.
 *
 * Vive aquí y no en `actions.ts` porque la interfaz necesita mostrar el coste
 * por acción antes de que el jugador elija, y dos copias de la misma regla
 * acabarían discrepando en cuanto una cambiara.
 */
export function hungerPerTurn(threat: number): number {
  return 1 + extraHungerPerTurn(threat);
}

/** Hambre que quita el nivel normal de la Fase 1, sin escalada. */
export const BASE_FOOD_RELIEF = 4;

/**
 * Hambre que quita una ración.
 *
 * Sin esto, la escalada de hambre rompe la economía: con `load` 0 los números
 * reproducen la Fase 1, pero a partir de `load` 4 cada ración cuesta más hambre
 * de la que devuelve y la partida deja de ser superable por construcción. La
 * ración se vuelve más potente conforme sube la amenaza: el juego no se vuelve
 * más barato, se vuelve más estrecho, porque el margen de error llega a cero.
 *
 * El extra entra al **doble** que en `hungerPerTurn`, y esa asimetría es
 * deliberada. Con el mismo multiplicador en los dos, la ración solo tapaba
 * exactamente el gasto del turno más un margen fijo, así que la fracción de
 * turnos que había que dedicar a comer no bajaba nunca con la carga y el
 * presupuesto se cerraba solo. Al doblarlo, comer cubre más turnos conforme
 * sube la amenaza y explorar conserva su parte: la escalada sigue apretando,
 * pero con algo de holgura que comprar.
 */
export function foodRelief(threat: number): number {
  return BASE_FOOD_RELIEF + 2 * extraHungerPerTurn(threat);
}

/**
 * Techo de energía que devuelve descansar con refugio.
 *
 * El suelo 3 no es un detalle: hace que descansar con refugio siempre devuelva
 * más de lo que cuesta el turno, así que un jugador que administra la energía no
 * puede quedarse sin ella por sorpresa. Con suelo 2 el descanso se convertía en
 * un impuesto en carga alta —neto +1—, y descansar sin refugio es exactamente
 * neutro a propósito. Que la segunda partida se llevara el tanto no convertía al
 * descanso en una trampa, pero sí hacía que la energía se fuera de rositas en
 * silencio. La escalera se estrecha con la carga, pero sin llegar nunca a la
 * neutralidad.
 */
export function restEnergyCap(threat: number): number {
  return Math.max(3, 5 - Math.floor(threatLoad(threat) / 4));
}

/**
 * Energía que devuelve descansar sin techo: 1, o sea exactamente lo que cuesta.
 *
 * El refugio por lo tanto multiplica, no habilita. Antes de esto descansar sin
 * techo no devolvía nada, y en Agonía eso era una fractura: la tormenta tiraba el
 * refugio, el descanso dejaba de funcionar y la partida se caía sola. Perder el
 * techo tiene que doler sin ser una sentencia.
 */
export const REST_ENERGY_WITHOUT_SHELTER = 1;

/** Raciones que cuesta cerrar las heridas. */
export const CURE_FOOD_COST = 2;

/**
 * Salud que devuelve cerrar las heridas.
 *
 * Comer ya no cura: bajar el hambre y curarse son dos decisiones distintas que
 * pagan con la misma comida, y esa es la razón de que `cure` exista. Si comer
 * curara, curar sería siempre la opción dominante y la barra de salud dejaría de
 * ser un presupuesto para pasar el rato.
 *
 * Sigue a la herida del hallazgo grande en vez de llevar una escalera propia. Con
 * escaleras separadas, a carga 6 el hallazgo grande costaba 4 de salud y
 * cerrar las heridas devolvía 3: cada hallazgo grande salía a 1 de comida por
 * punto de salud, mientras el hallazgo pequeño —2 de comida por 1 de salud— era
 * el doble de rentable. El premio grande se convertía en la peor jugada de la
 * tabla. Al curarse lo que el hallazgo grande abrió, ambos tiers se pagan a lo
 * mismo y explorar deja de tener una opción mala.
 */
export function cureAmount(threat: number): number {
  return Math.max(2, exploreWound(threat));
}

/** Tope del hallazgo grande al explorar. */
export function exploreRichLimit(threat: number): number {
  return Math.max(2, 6 - Math.floor(threatLoad(threat) / 2));
}

/** Tope del hallazgo normal al explorar. */
export function exploreFindLimit(threat: number): number {
  return Math.max(10, 16 - Math.floor(threatLoad(threat) / 2));
}

/**
 * Salud que arranca el hallazgo grande.
 *
 * Sube con la carga porque al final del juego la comida vale más que la piel: es
 * el precio explícito de explorar lejos, y es lo que convierte la barra de salud
 * en la partida corta de quien no la mira.
 */
export function exploreWound(threat: number): number {
  return 2 + Math.floor(threatLoad(threat) / 3);
}

/**
 * Radio de la banda de fallo al reparar. El radio 0 conserva el comportamiento
 * heredado, que fallaba solo cuando la tirada salía 5; la banda se ensancha
 * hacia ambos lados conforme sube la carga.
 */
export function repairFailureRadius(threat: number): number {
  return Math.min(4, Math.floor(threatLoad(threat) / 2));
}

/** Turnos que cuesta reparar. Fijo: es lo que hace su coste comunicable. */
export const REPAIR_TURNS = 2;

/**
 * Raciones que se lleva el mapache.
 *
 * Antes lo dejaba a cero. Eso era una ruina económica: mataba a todos por igual y
 * en el mismo turno, así que la partida se decidía antes de que la estrategia
 * tuviera nada que decir. Robar una cantidad fija golpea a quien tiene el
 * depósito lleno, que es una decisión —¿guardo o gasto?— y no una sentencia.
 */
export function foodRaid(threat: number): number {
  return Math.max(2, 3 + Math.floor(threatLoad(threat) / 3));
}

/** Tiradas de evento aleatorio por turno: una más las que permite la carga. */
export function extraEventRolls(threat: number): number {
  return Math.min(2, Math.floor(threatLoad(threat) / 4));
}

export interface ThreatResolution {
  readonly state: GameCoreState;
  readonly notice: ThreatNotice | null;
}

/**
 * Sube `threat` al nivel que corresponde al turno alcanzado. Una acción
 * multiturno puede cruzar varios umbrales: se aplica el más alto y se emite un
 * único aviso, porque la dificultad sí saltó de golpe.
 */
export function applyThreat(state: GameCoreState): ThreatResolution {
  const level = threatForTurn(state.turn);

  if (level <= state.threat) {
    return { state, notice: null };
  }

  return {
    state: { ...state, threat: level },
    notice: { threat: level, load: threatLoad(level) },
  };
}
