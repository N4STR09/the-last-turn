import { drawRandomInt } from './random';
import { extraEventRolls, foodRaid, threatLoad } from './threat';
import type { GameCoreState, GameEvent, RandomInt } from './types';

/**
 * Bordes de la tabla de eventos, sobre la tirada de 1 a 100.
 *
 * La tormenta baja del 10 % al 4 %. La medición lo pedía: apagarla entera sacaba
 * la mediana de Agonía de 29 a 44, y el 4 % se queda cerca de ese techo. La razón
 * está en que la tormenta no mataba por sí misma sino por lo que arrastraba:
 * quitaba el techo y gastaba un punto de energía, así que la mitad de las muertes
 * por energía de Agonía tenían una tormenta en los seis turnos previos. Subir el
 * coste de la reparación, que era la otra mitad de la propuesta, habría castigado
 * justo a quien ya moría por ahí.
 *
 * El mapache conserva su 9 % exactos. Lo que cambia es dónde está: antes ocupaba
 * el 51 al 59 con un agujero del 5 al 10 al que ya no le tocaba nada. Ahora las
 * tres bandas son contiguas desde el 1 y el d100 no tiene huecos muertos. La
 * probabilidad conjunta es la misma que se midió, 4 + 9 + 1, así que la mediana
 * de 38 se mantiene.
 */
const STORM_LIMIT = 4;
const RACCOON_LIMIT = 13;
const METEORITE_VALUE = 99;

/** Un solo evento, tirado pero todavía sin aplicar. */
function rollSingleEvent(randomInt: RandomInt): GameEvent | null {
  const value = drawRandomInt(randomInt, 1, 100);

  if (value <= STORM_LIMIT) {
    return { type: 'storm' };
  }

  if (value <= RACCOON_LIMIT) {
    return { type: 'raccoon' };
  }

  if (value === METEORITE_VALUE) {
    return { type: 'meteorite' };
  }

  return null;
}

/**
 * Tira los eventos del turno siguiente sin tocar el estado.
 *
 * Van aparte de la aplicación porque tienen que existir antes de que el jugador
 * elija. La medición dio que el 52 % de las partidas de Agonía terminaban en los
 * tres turnos siguientes a una tormenta, y el 90 % de las muertes por energía
 * tenían una a la vista. Ninguna interfaz puede avisar de un dado que el motor no
 * ha tirado todavía, así que el motor lo tira y lo guarda.
 */
export function rollRandomEvents(
  state: GameCoreState,
  randomInt: RandomInt,
): readonly GameEvent[] {
  if (state.difficulty === 'normal') {
    return [];
  }

  const rolls = 1 + extraEventRolls(state.threat);
  const events: GameEvent[] = [];

  for (let roll = 0; roll < rolls; roll += 1) {
    const event = rollSingleEvent(randomInt);

    if (event !== null) {
      events.push(event);
    }
  }

  return events;
}

function applySingleEvent(
  state: GameCoreState,
  event: GameEvent,
  energySurcharge: number,
): GameCoreState {
  const load = threatLoad(state.threat);

  switch (event.type) {
    case 'storm':
      return {
        ...state,
        hasShelter: false,
        energy: state.energy - energySurcharge,
      };
    case 'raccoon':
      return {
        ...state,
        // Saquea una cantidad fija en vez de vaciar el depósito. Vaciarlo era un
        // ruina económica: mataba a todos por igual y en el mismo turno, así que
        // decidía la partida antes de que la estrategia tuviera nada que decir.
        food: Math.max(0, state.food - foodRaid(state.threat)),
        energy: state.energy - energySurcharge,
        // A partir de la carga 3 el mapache también hiere.
        health: load >= 3 ? Math.max(0, state.health - 1) : state.health,
      };
    case 'meteorite':
      // El meteorito no cuesta energía: no es un fenómeno del tiempo, y si
      // consumiera el recargo del turno la tormenta que viniera detrás saldría
      // gratis. Por eso el recargo que recibe esta rama es 0.
      return { ...state, health: Math.max(0, state.health - 1) };
  }
}

/**
 * Aplica sobre el estado los eventos que ya se habían anunciado.
 *
 * El recargo de energía se cobra una sola vez por turno y no una por evento. Con
 * tres tiradas y un recargo por evento, el peor turno de Agonía costaba 3 de
 * energía contra un descanso que devolvía 1: una resta que no era dificultad sino
 * una fractura, porque encadenaba sola. La tormenta tiraba el refugio, sin
 * refugio descansar ya no rendía, y la partida se caía sin que hubiera turno en el
 * que decidir.
 */
export function applyRandomEvents(
  state: GameCoreState,
  events: readonly GameEvent[],
): GameCoreState {
  const canCharge = threatLoad(state.threat) >= 1;
  let current = state;
  let energyCharged = false;

  for (const event of events) {
    const charges = canCharge && !energyCharged && event.type !== 'meteorite';

    if (charges) {
      energyCharged = true;
    }

    current = applySingleEvent(current, event, charges ? 1 : 0);
  }

  return current;
}
