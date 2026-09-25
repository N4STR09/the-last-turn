import type {
  ActionOutcome,
  FinishedGameState,
  GameAction,
  GameCoreState,
  GameEvent,
  GameResolution,
  GameState,
  Milestone,
} from '../game';
import type {
  EventViewModel,
  GameOverViewModel,
  GameViewModel,
  ResourceDeltaViewModel,
  ResourceId,
  ResourceViewModel,
  ResolutionViewModel,
  Tone,
} from '../ui/view-models/ui-types';

const resourceIds: ReadonlyArray<ResourceId> = [
  'hunger',
  'energy',
  'food',
  'shelter',
];

function resourceValue(id: ResourceId, state: GameCoreState): string {
  switch (id) {
    case 'hunger':
      return `${state.hunger}`;
    case 'energy':
      return `${state.energy}`;
    case 'food':
      return `${state.food}`;
    case 'shelter':
      return state.hasShelter ? 'Presente' : 'Ausente';
  }
}

function resourceStateLabel(id: ResourceId, state: GameCoreState): string {
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
    case 'shelter':
      return state.hasShelter ? 'Bajo techo' : 'Expuesto';
  }
}

function resourceTone(id: ResourceId, state: GameCoreState): Tone {
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
    case 'shelter':
      return state.hasShelter ? 'positive' : 'warning';
  }
}

function createResource(
  id: ResourceId,
  state: GameCoreState,
): ResourceViewModel {
  return {
    id,
    label: resourceLabel(id),
    value: resourceValue(id, state),
    stateLabel: resourceStateLabel(id, state),
    tone: resourceTone(id, state),
  };
}

function resourceLabel(id: ResourceId): string {
  switch (id) {
    case 'hunger':
      return 'Hambre';
    case 'energy':
      return 'Energía';
    case 'food':
      return 'Comida';
    case 'shelter':
      return 'Refugio';
  }
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

  if (id === 'energy') {
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
  const numericResources = [
    { id: 'hunger' as const, label: 'Hambre' },
    { id: 'energy' as const, label: 'Energía' },
    { id: 'food' as const, label: 'Comida' },
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
      value: current.hasShelter ? 'Presente' : 'Ausente',
      tone: deltaTone('shelter', 0, current.hasShelter),
    });
  }

  return deltas;
}

function actionIdForOutcome(outcome: ActionOutcome): GameAction {
  switch (outcome.type) {
    case 'help':
      return 'help';
    case 'forage-found':
    case 'forage-empty':
      return 'forage';
    case 'rest-without-shelter':
    case 'rest-shelter-miss':
    case 'rest-shelter-success':
      return 'rest';
    case 'explore-shelter':
    case 'explore-food':
    case 'explore-empty':
      return 'explore';
    case 'repair-failed':
    case 'repair-succeeded':
      return 'repair';
    case 'fish-catch':
    case 'fish-failed':
      return 'fish';
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
    case 'help':
      return {
        headline: 'Consultas las reglas del refugio.',
        details: [
          'La ayuda no consume un turno. En Agonía todavía puede ocurrir un evento.',
        ],
      };
    case 'forage-found':
      return {
        headline: 'Encuentras comida.',
        details: ['La búsqueda añade 1 comida.'],
      };
    case 'forage-empty':
      return {
        headline: 'No encuentras comida.',
        details: ['La búsqueda no cambia la comida.'],
      };
    case 'rest-without-shelter':
      return {
        headline: 'Intentas descansar, pero no tienes refugio.',
        details: ['Sin refugio, el descanso no recupera energía.'],
      };
    case 'rest-shelter-miss':
      return {
        headline: 'Descansas, pero la recuperación es menor.',
        details: ['Recuperas 3 de energía antes del coste del turno.'],
      };
    case 'rest-shelter-success':
      return {
        headline: 'El refugio te permite recuperar más energía.',
        details: [
          `Recuperas ${outcome.energyRecovered} de energía antes del coste del turno.`,
        ],
      };
    case 'explore-shelter':
      return {
        headline: 'Descubres un lugar donde construir un refugio.',
        details: ['La exploración da con un lugar seguro.'],
      };
    case 'explore-food':
      return {
        headline: 'Encuentras comida durante la exploración.',
        details: ['La exploración añade 1 comida.'],
      };
    case 'explore-empty':
      return {
        headline: 'La exploración no te lleva a nada.',
        details: ['No encuentras refugio ni comida.'],
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
    case 'fish-failed':
      return {
        headline: 'La pesca no consigue nada.',
        details: [
          `La pesca agota ${outcome.attempts} intentos y no añade comida.`,
        ],
      };
    case 'fish-catch': {
      const attempts = outcome.attempts;
      return {
        headline:
          attempts === 1 ? 'Capturas un pez.' : `Capturas ${attempts} peces.`,
        details: [
          `La pesca consume ${attempts} ${attempts === 1 ? 'turno' : 'turnos'} y añade 3 comidas.`,
        ],
      };
    }
    case 'eat-consumed':
      return {
        headline: 'Comes una ración.',
        details: [
          `Consumes 1 comida y reduces el hambre en ${outcome.hungerReduced}.`,
          outcome.healthRecovered === 1
            ? 'La comida te ayuda a recuperar 1 de salud.'
            : 'Tu salud ya estaba al máximo.',
        ],
      };
    case 'eat-no-food':
      return {
        headline: 'No tienes nada que comer.',
        details: [
          'Comer no consume comida; el turno aumenta el hambre en 1 y reduce la energía en 1.',
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

function milestoneCopy(milestone: Milestone): string {
  switch (milestone.type) {
    case 'turn-15':
      return 'El ambiente empieza a desprender un aura rara. Una presión inicial castiga tu cuerpo...';
    case 'turn-30':
      return 'Has cruzado otro umbral. Esto cada vez resulta más difícil, pero todavía puedes sobrevivir...';
  }
}

export function createResolutionViewModel(
  resolution: GameResolution,
  previousState?: GameCoreState,
): ResolutionViewModel {
  return {
    actionId: actionIdForOutcome(resolution.actionOutcome),
    ...outcomeCopy(resolution.actionOutcome),
    deltas: createDeltas(previousState, resolution.state),
    event:
      resolution.randomEvent === null
        ? null
        : eventCopy(resolution.randomEvent),
    milestone:
      resolution.milestone === null
        ? null
        : milestoneCopy(resolution.milestone),
  };
}

export function createGameViewModel(
  game: GameState,
  resolution: GameResolution | null,
  previousState?: GameCoreState,
): GameViewModel {
  return {
    difficulty: game.difficulty,
    turn: game.turn,
    resources: resourceIds.map((id) => createResource(id, game)),
    resolution:
      resolution === null
        ? null
        : createResolutionViewModel(resolution, previousState),
  };
}

export function createGameOverViewModel(
  game: FinishedGameState,
): GameOverViewModel {
  return {
    difficulty: game.difficulty,
    reportedCause: game.end.reportedCause,
    turnsSurvived: game.end.turnsSurvived,
  };
}
