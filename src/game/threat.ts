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
  return Math.min(6, Math.floor(threatLoad(threat) / 2));
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
 */
export function foodRelief(threat: number): number {
  return BASE_FOOD_RELIEF + extraHungerPerTurn(threat);
}

export function restEnergyCap(threat: number): number {
  return Math.max(1, 5 - Math.floor(threatLoad(threat) / 3));
}

export function extraEventRolls(threat: number): number {
  return Math.min(2, Math.floor(threatLoad(threat) / 4));
}

export function forageSuccessLimit(threat: number): number {
  return Math.max(1, 3 - Math.floor(threatLoad(threat) / 3));
}

/**
 * Radio de la banda de fallo al reparar. El radio 0 conserva el comportamiento
 * heredado, que fallaba solo cuando la tirada salía 5; la banda se ensancha
 * hacia ambos lados conforme sube la carga.
 */
export function repairFailureRadius(threat: number): number {
  return Math.min(4, Math.floor(threatLoad(threat) / 2));
}

export function repairTurnCost(threat: number): number {
  return Math.min(5, 2 + Math.floor(threatLoad(threat) / 5));
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
