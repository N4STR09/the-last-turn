import { drawRandomInt } from './random';
import { extraEventRolls, foodRaid, threatLoad } from './threat';
import type { GameCoreState, GameEvent, RandomInt } from './types';

export interface RandomEventResolution {
  readonly state: GameCoreState;
  readonly events: readonly GameEvent[];
}

interface SingleEventResolution {
  readonly state: GameCoreState;
  readonly event: GameEvent | null;
  /** Si este evento ha cobrado ya el recargo de energía del turno. */
  readonly chargedEnergy: boolean;
}

function resolveSingleEvent(
  state: GameCoreState,
  randomInt: RandomInt,
  energyAlreadyCharged: boolean,
): SingleEventResolution {
  const value = drawRandomInt(randomInt, 1, 100);
  const load = threatLoad(state.threat);
  // A partir de la carga 1, tormenta y mapache cuestan energía, y lo cobran una
  // sola vez por turno en vez de una por evento. Con tres tiradas y un recargo
  // por evento, el peor turno de Agonía costaba 3 de energía contra un descanso
  // que devolvía 1: una resta que no era dificultad sino una fractura, porque
  // encadenaba sola. La tormenta tiraba el refugio, sin refugio descansar ya no
  // rendía, y la partida se caía sin que hubiera turno en el que decidir.
  const chargesEnergy = load >= 1 && !energyAlreadyCharged;
  const energySurcharge = chargesEnergy ? 1 : 0;

  if (value <= 10) {
    return {
      state: {
        ...state,
        hasShelter: false,
        energy: state.energy - energySurcharge,
      },
      event: { type: 'storm' },
      // La marca es del turno, no del evento: si el segundo evento no cobra, no
      // puede devolver la marca a «sin cobrar» o el tercero cobraría otra vez.
      chargedEnergy: energyAlreadyCharged || chargesEnergy,
    };
  }

  if (value >= 51 && value <= 59) {
    return {
      state: {
        ...state,
        // Saquea una cantidad fija en vez de vaciar el depósito. Vaciarlo era un
        // ruina económica: mataba a todos por igual y en el mismo turno, así que
        // decidía la partida antes de que la estrategia tuviera nada que decir.
        food: Math.max(0, state.food - foodRaid(state.threat)),
        energy: state.energy - energySurcharge,
        // A partir de la carga 3 el mapache también hiere.
        health: load >= 3 ? Math.max(0, state.health - 1) : state.health,
      },
      event: { type: 'raccoon' },
      chargedEnergy: energyAlreadyCharged || chargesEnergy,
    };
  }

  if (value === 99) {
    return {
      state: { ...state, health: Math.max(0, state.health - 1) },
      event: { type: 'meteorite' },
      // El meteorito no cuesta energía, así que el recargo del turno sigue
      // como estaba. Si consumiera la marca, el segundo evento de la tirada
      // cobraría un recargo que este no se gastó.
      chargedEnergy: energyAlreadyCharged,
    };
  }

  return { state, event: null, chargedEnergy: energyAlreadyCharged };
}

export function resolveRandomEvents(
  state: GameCoreState,
  randomInt: RandomInt,
): RandomEventResolution {
  if (state.difficulty === 'normal') {
    return { state, events: [] };
  }

  const rolls = 1 + extraEventRolls(state.threat);
  let current = state;
  const events: GameEvent[] = [];
  let energyCharged = false;

  for (let roll = 0; roll < rolls; roll += 1) {
    const resolution = resolveSingleEvent(current, randomInt, energyCharged);
    current = resolution.state;
    energyCharged = resolution.chargedEnergy;

    if (resolution.event !== null) {
      events.push(resolution.event);
    }
  }

  return { state: current, events };
}
