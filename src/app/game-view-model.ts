import { actionCost } from '../game/action-cost';
import { MAX_HEALTH } from '../game';
import { createBreakdown } from './breakdown';
import { encodeSeed } from './seed';
import type {
  ActionOutcome,
  FinishedGameState,
  GameAction,
  GameCoreState,
  GameEvent,
  GameResolution,
  GameState,
} from '../game';
import type {
  ActionViewModel,
  EventViewModel,
  ForecastViewModel,
  GameOverViewModel,
  GameViewModel,
  ResourceDeltaViewModel,
  ResourceId,
  ResourceViewModel,
  ResolutionViewModel,
  ShelterViewModel,
  StatId,
  Tone,
} from '../ui/view-models/ui-types';

/**
 * Orden del panel: salud, energía, hambre y comida.
 *
 * La salud abre la lista porque es la única de las cuatro que puede acabar con la
 * partida: las otras tres avisan de un problema que aún se puede resolver, y esta
 * marca el borde a partir del cual no.
 *
 * Debajo van la energía y el hambre, juntas porque son los dos contadores que se
 * mueven en todos los turnos, los que se administran con los botones. Y la comida
 * va la última porque es la única que se acumula en vez de gastarse.
 */
const statIds: ReadonlyArray<StatId> = ['health', 'energy', 'hunger', 'food'];

/**
 * Bloques de cada barra. Las cifras comparten escala para que las filas queden
 * alineadas. Un valor por encima de la capacidad satura la barra, y la cifra
 * sigue siendo la verdad: la barra es una pista visual, no el dato.
 *
 * La salud usa su propio techo, que es el del cuerpo, y no 12 como las demás. No
 * es una excepción: es lo que la distingue de un recurso. Las otras tres son
 * contadores que suben y bajan; la salud es una reserva que solo baja si alguien
 * te hiere, y por eso tiene un final y las otras no.
 */
const barCapacity: Record<StatId, number> = {
  hunger: 12,
  energy: 12,
  food: 12,
  health: MAX_HEALTH,
};

function resourceValue(id: StatId, state: GameCoreState): string {
  switch (id) {
    case 'hunger':
      return `${state.hunger}`;
    case 'energy':
      return `${state.energy}`;
    case 'food':
      return `${state.food}`;
    case 'health':
      return `${state.health}`;
  }
}

function resourceUnits(id: StatId, state: GameCoreState): number {
  switch (id) {
    case 'hunger':
      return state.hunger;
    case 'energy':
      return state.energy;
    case 'food':
      return state.food;
    case 'health':
      return state.health;
  }
}

function resourceStateLabel(id: StatId, state: GameCoreState): string {
  switch (id) {
    case 'hunger':
      if (state.hunger === 0) {
        return 'Sin hambre';
      }
      if (state.hunger >= 10) {
        return 'Hambre al límite';
      }
      return 'Hambre creciente';
    case 'energy':
      if (state.energy <= 0) {
        return 'Sin energía';
      }
      if (state.energy <= 3) {
        return 'Reserva crítica';
      }
      return 'Energía disponible';
    case 'food':
      return state.food > 0 ? 'Provisiones disponibles' : 'Sin provisiones';
    case 'health':
      if (state.health <= 2) {
        return 'A un paso de la muerte';
      }
      if (state.health <= 5) {
        return 'Sangrando';
      }
      return 'Sin heridas';
  }
}

function resourceTone(id: StatId, state: GameCoreState): Tone {
  switch (id) {
    case 'hunger':
      return state.hunger >= 10
        ? 'warning'
        : state.hunger === 0
          ? 'positive'
          : 'neutral';
    case 'energy':
      return state.energy <= 3 ? 'warning' : 'positive';
    case 'food':
      return state.food > 0 ? 'positive' : 'warning';
    case 'health':
      return state.health <= 3 ? 'warning' : 'positive';
  }
}

function createResource(
  id: StatId,
  state: GameCoreState,
): ResourceViewModel {
  return {
    id,
    label: resourceLabel(id),
    value: resourceValue(id, state),
    stateLabel: resourceStateLabel(id, state),
    tone: resourceTone(id, state),
    units: resourceUnits(id, state),
    capacity: barCapacity[id],
  };
}

function resourceLabel(id: StatId): string {
  switch (id) {
    case 'hunger':
      return 'Hambre';
    case 'energy':
      return 'Energía';
    case 'food':
      return 'Comida';
    case 'health':
      return 'Salud';
  }
}

/**
 * El refugio no es un stat: es un interruptor. Por eso no se mezcla con las
 * cifras en la misma rejilla, sino que va debajo como una línea con su propio
 * bloque, y por eso su estado se dice con una palabra entera en vez de con una
 * cifra o un aviso. Las dos cosas salen de la misma bandera para que no puedan
 * contradecirse.
 */
function createShelter(state: GameCoreState): ShelterViewModel {
  return {
    label: 'Refugio',
    hasShelter: state.hasShelter,
    status: shelterStatus(state.hasShelter),
    tone: state.hasShelter ? 'positive' : 'warning',
  };
}

/** Palabra del refugio, en un solo sitio: la fila y el cambio de la terminal. */
function shelterStatus(hasShelter: boolean): 'Construido' | 'Destruido' {
  return hasShelter ? 'Construido' : 'Destruido';
}

function formatDelta(value: number): string {
  if (value === 0) {
    return '0';
  }

  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

function deltaTone(
  id: ResourceId,
  difference: number,
  hasShelter: boolean,
): Tone {
  if (id === 'shelter') {
    return hasShelter ? 'positive' : 'warning';
  }

  if (id === 'hunger') {
    return difference > 0 ? 'warning' : 'positive';
  }

  if (id === 'energy' || id === 'health') {
    return difference < 0 ? 'warning' : 'positive';
  }

  return difference > 0 ? 'positive' : 'warning';
}

function createDeltas(
  previous: GameCoreState | undefined,
  current: GameCoreState,
): ReadonlyArray<ResourceDeltaViewModel> {
  if (previous === undefined) {
    return [];
  }

  const deltas: ResourceDeltaViewModel[] = [];
  // El mismo orden que el panel, para que la lista de cambios se lea mirando la
  // rejilla de arriba y no haya que buscar cada fila por su color. Sale de
  // `statIds` y no de una lista propia: las dos tienen que ser la misma, o un
  // cambio de orden en el panel dejaría los cambios de la terminal sin reordenar.
  const numericResources: ReadonlyArray<{ id: StatId; label: string }> = [
    { id: 'health', label: 'Salud' },
    { id: 'energy', label: 'Energía' },
    { id: 'hunger', label: 'Hambre' },
    { id: 'food', label: 'Comida' },
  ];

  for (const resource of numericResources) {
    const difference = current[resource.id] - previous[resource.id];
    if (difference !== 0) {
      deltas.push({
        id: resource.id,
        label: resource.label,
        value: formatDelta(difference),
        tone: deltaTone(resource.id, difference, current.hasShelter),
      });
    }
  }

  if (current.hasShelter !== previous.hasShelter) {
    deltas.push({
      id: 'shelter',
      label: 'Refugio',
      value: shelterStatus(current.hasShelter),
      tone: deltaTone('shelter', 0, current.hasShelter),
    });
  }

  return deltas;
}

function actionIdForOutcome(outcome: ActionOutcome): GameAction {
  switch (outcome.type) {
    case 'rest-without-shelter':
    case 'rest-shelter-success':
      return 'rest';
    case 'explore-rich':
    case 'explore-find':
    case 'explore-empty':
      return 'explore';
    case 'repair-failed':
    case 'repair-succeeded':
      return 'repair';
    case 'cure-done':
    case 'cure-no-food':
      return 'cure';
    case 'eat-consumed':
    case 'eat-no-food':
      return 'eat';
  }
}

interface OutcomeCopy {
  readonly headline: string;
  readonly details: readonly string[];
}

function outcomeCopy(outcome: ActionOutcome): OutcomeCopy {
  switch (outcome.type) {
    case 'rest-without-shelter':
      return {
        headline: 'Descansas al aire libre.',
        details: [
          'Sin refugio solo recuperas lo que cuesta el turno. El refugio multiplica el descanso, no lo habilita.',
        ],
      };
    case 'rest-shelter-success':
      return {
        headline: 'El techo te devuelve lo que cuesta el turno.',
        details: [
          `Recuperas ${outcome.energyRecovered} de energía antes del coste del turno.`,
        ],
      };
    case 'explore-rich':
      return {
        headline: 'Aguantas más de lo previsto y vuelves cargado.',
        details: [
          `La exploración añade ${outcome.foodGained} comidas y te cuesta ${outcome.healthLost} de salud.`,
        ],
      };
    case 'explore-find':
      return {
        headline: 'Vuelves con algo y con algún rasguño.',
        details: [
          `La exploración añade ${outcome.foodGained} comidas y te cuesta ${outcome.healthLost} de salud.`,
        ],
      };
    case 'explore-empty':
      return {
        headline: 'La exploración no te lleva a nada.',
        details: ['No encuentras comida, y al menos no te hiere.'],
      };
    case 'repair-failed':
      return {
        headline: 'No consigues reparar el refugio.',
        details: ['El refugio conserva su estado anterior.'],
      };
    case 'repair-succeeded':
      return {
        headline: 'Levantas o reparas el refugio.',
        details: ['El trabajo consume dos turnos.'],
      };
    case 'cure-done':
      return {
        headline: 'Te vendas las heridas.',
        details: [
          `Gastas ${outcome.foodSpent} comidas y recuperas ${outcome.healthRecovered} de salud.`,
        ],
      };
    case 'cure-no-food':
      return {
        headline: 'No tienes material para curarte.',
        details: [
          'Cerrar las heridas cuesta 2 comidas, y come comida que no te va a bajar el hambre.',
        ],
      };
    case 'eat-consumed':
      return {
        headline: 'Comes una ración.',
        details: [
          `Consumes 1 comida y reduces el hambre en ${outcome.hungerReduced}.`,
          'Comer no cura: para eso están las heridas.',
        ],
      };
    case 'eat-no-food':
      return {
        headline: 'No tienes nada que comer.',
        details: [
          'Comer no consume comida; el turno solo aumenta el hambre y reduce la energía en 1.',
        ],
      };
  }
}

function eventCopy(event: GameEvent): EventViewModel {
  switch (event.type) {
    case 'storm':
      return {
        type: event.type,
        headline: 'Tormenta',
        description: 'Tu refugio ha resultado dañado por las fuertes tormentas!',
      };
    case 'raccoon':
      return {
        type: event.type,
        headline: 'Mapache',
        description: 'Un mapache te ha robado tu comida!',
      };
    case 'meteorite':
      return {
        type: event.type,
        headline: 'Meteorito',
        description: 'Un meteorito te golpea y te deja herido.',
      };
  }
}

/**
 * Aviso previo a cada evento, en el mismo orden en que la partida los usa.
 *
 * La tormenta va primera porque es la que se lleva el refugio, y sin techo
 * descansar deja de rendir, así que es la que encadena. El meteorito va segundo
 * porque quita salud directamente. El mapache va el último porque solo roba
 * comida, que se recupera.
 */
const forecastCopy: Record<GameEvent['type'], Omit<ForecastViewModel, 'count'>> = {
  storm: {
    headline: 'El aire pesa.',
    detail: 'Algo baja desde el norte. El refugio no lo va a resistir.',
  },
  raccoon: {
    headline: 'Algo se mueve entre los árboles.',
    detail: 'No es el viento. Huele a comida.',
  },
  meteorite: {
    headline: 'Una luz cruza el cielo.',
    detail: 'Va a hacer daño.',
  },
};

const forecastOrder: readonly GameEvent['type'][] = ['storm', 'meteorite', 'raccoon'];

/**
 * Traduce la cola de eventos a un aviso.
 *
 * Con carga alta hay dos o tres tiradas por turno y la cola puede traer el mismo
 * evento repetido. Se anuncia el que más pesa y se cuenta cuántos son, en vez de
 * listarlos: una lista de tres líneas empuja los botones fuera de la pantalla, y
 * lo que el jugador necesita para decidir es si viene algo grave y cuántas veces.
 */
function createForecast(pending: readonly GameEvent[]): ForecastViewModel | null {
  const worst = forecastOrder.find((type) =>
    pending.some((event) => event.type === type),
  );

  if (worst === undefined) {
    return null;
  }

  return { ...forecastCopy[worst], count: pending.length };
}

const actionLabels: Record<GameAction, string> = {
  explore: 'Explorar',
  eat: 'Comer',
  cure: 'Curar heridas',
  rest: 'Descansar',
  repair: 'Reparar refugio',
};

/**
 * Orden de la rejilla. Va por recursos, no por importancia: primero lo que produce
 * comida, después lo que la gasta, después lo que sostiene la energía y al final
 * lo que sostiene el techo. Rendirse no aparece: va aparte, debajo.
 */
const gridActions: readonly GameAction[] = [
  'explore',
  'eat',
  'cure',
  'rest',
  'repair',
];

/**
 * Gasto de una acción en hambre y energía, en tres o cuatro palabras.
 *
 * Hambre y energía se gastan por turno, no por acción, así que la cifra sale de
 * la amenaza vigente. Todas las acciones tienen un coste fijo y conocido, así que
 * aquí no hay peor caso que enunciar: el número que se dice es el que va a
 * pasar, y es con el que el jugador decide.
 */
export function actionCostLabel(action: GameAction, threat: number): string {
  const cost = actionCost(action, threat);

  return `(+${cost.hunger} hambre, −${cost.energy} energía)`;
}

function createAction(action: GameAction, threat: number): ActionViewModel {
  return {
    id: action,
    label: actionLabels[action],
    cost: actionCostLabel(action, threat),
  };
}

/**
 * Las cinco acciones con su gasto vigente, en el orden de la rejilla.
 *
 * Se exporta porque la hoja de reglas lista las mismas cinco con el mismo precio y
 * los mismos atajos. Sacarlas de aquí, en vez de volver a recorrer la rejilla por
 * su cuenta, es lo que impide que la ayuda y los botones acaben contradiciéndose
 * sobre lo que cuesta una acción, que es el peor sitio posible para una
 * contradicción: uno en el que el jugador ya ha decidido.
 */
export function createActions(
  threat: number,
): readonly ActionViewModel[] {
  return gridActions.map((id) => createAction(id, threat));
}

export function createResolutionViewModel(
  resolution: GameResolution,
  previousState?: GameCoreState,
): ResolutionViewModel {
  return {
    actionId: actionIdForOutcome(resolution.actionOutcome),
    ...outcomeCopy(resolution.actionOutcome),
    deltas: createDeltas(previousState, resolution.state),
    events: resolution.randomEvents.map((event) => eventCopy(event)),
  };
}

export function createGameViewModel(
  game: GameState,
  resolution: GameResolution | null,
  previousState?: GameCoreState,
  personalBest: number | null = null,
): GameViewModel {
  return {
    difficulty: game.difficulty,
    turn: game.turn,
    personalBest,
    threat: game.threat,
    stats: statIds.map((id) => createResource(id, game)),
    shelter: createShelter(game),
    forecast: createForecast(game.pendingEvents),
    resolution:
      resolution === null
        ? null
        : createResolutionViewModel(resolution, previousState),
    actions: createActions(game.threat),
  };
}

/**
 * El parte final.
 *
 * Reutiliza `createResource` y `createShelter` a propósito: el estado final se
 * muestra con exactamente la misma lectura que durante la partida, porque un
 * jugador que acaba de perder está mirando los mismos cuatro bloques que una
 * pantalla antes. Si el parte los dibujara de otra manera, el jugador tendría
 * que traducir entre dos sistemas para entender por qué perdió.
 *
 * El orden de los recursos es el de `statIds`: salud, energía, hambre y comida.
 * La salud va la primera porque es la única de las cuatro que puede haber
 * terminado la partida.
 *
 * `previousBest` es la mejor partida **anterior** a esta, no la mejor de la
 * sesión incluyendo esta. La diferencia importa: al morir, la marca ya se ha
 * actualizado con esta misma partida, así que preguntarle por la marca actual
 * daría siempre un empate y el aviso nunca aparecería. Y es el mejor de antes de
 * empezar, no el mejor de antes de morir, porque solo eso distingue «batiste tu
 * récord» de «esta fue tu primera partida y por lo tanto es la mejor».
 */
export function createGameOverViewModel(
  game: FinishedGameState,
  records: readonly GameAction[],
  seed: number,
  replayed: boolean,
  previousBest: number | null = null,
): GameOverViewModel {
  return {
    difficulty: game.difficulty,
    reportedCause: game.end.reportedCause,
    turnsSurvived: game.end.turnsSurvived,
    newRecord: isNewRecord(game, replayed, previousBest),
    stats: statIds.map((id) => createResource(id, game)),
    shelter: createShelter(game),
    breakdown: createBreakdown(records),
    seed: encodeSeed(seed),
    replayed,
  };
}

/**
 * Si esta partida bate la marca que había antes de jugarla.
 *
 * Tres condiciones, y las tres importan:
 *
 * - **No puede ser la primera partida de la sesión.** Sin marca previa no hay
 *   récord que batir, y llamarlo «nuevo récord» en la primera muerte sería
 *   felicitar a alguien por perder. Es la misma razón por la que el rival fantasma
 *   no dice nada hasta que ha muerto alguna partida.
 * - **Empate no es superar.** `>` y no `>=`, porque quedarse exactamente en la
 *   marca es haber igualado, no haber pasado. El rival fantasma juega con la
 *   misma regla, y por eso llegar a tu mejor turno no te convierte en récord.
 * - **Una partida reproducida no bate nada.** La muerte es de otra persona, así
 *   que no compite contigo y no puede ocupar tu récord.
 */
function isNewRecord(
  game: FinishedGameState,
  replayed: boolean,
  previousBest: number | null,
): boolean {
  return (
    !replayed && previousBest !== null && game.end.turnsSurvived > previousBest
  );
}
