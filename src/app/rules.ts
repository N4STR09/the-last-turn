import {
  actionCost,
  CURE_FOOD_COST,
  cureAmount,
  exploreWound,
  foodRelief,
  REPAIR_TURNS,
  restEnergyCap,
  REST_ENERGY_WITHOUT_SHELTER,
} from '../game';
import { shortcutKeyForAction } from './app-keyboard';
import { createActions } from './game-view-model';
import type { GameAction, GameState } from '../game';
import type {
  RulesActionViewModel,
  RulesSectionViewModel,
  RulesViewModel,
} from '../ui/view-models/ui-types';

/**
 * El gasto de un turno suelto.
 *
 * Sale de `actionCost` sobre una acción de un solo turno en vez de escribir los
 * dos números aquí. La energía por turno también la decide el motor, y una hoja de
 * ayuda con números propios empieza a mentir en cuanto el motor cambia los suyos,
 * que es lo único que una ayuda no puede permitirse.
 */
function turnCost(threat: number): { hunger: number; energy: number } {
  const cost = actionCost('rest', threat);

  return { hunger: cost.hungerPerTurn, energy: cost.energy };
}

/**
 * Qué hace cada acción, en una línea, con las cifras del motor dentro.
 *
 * Es la única parte de la hoja que no sale del modelo de la partida, porque no
 * está en ningún sitio: el motor resuelve acciones, no las explica. Lo que sí sale
 * del motor son los números que se citan, para que la explicación no envejezca
 * sola la primera vez que se toque una constante.
 */
function actionEffects(game: GameState): Record<GameAction, string> {
  const threat = game.threat;

  return {
    explore:
      'La única forma de conseguir comida: cuatro raciones con un hallazgo grande, ' +
      'dos con uno pequeño, o ninguna. El grande se paga con salud y el pequeño, con 1. ' +
      `Ahora el grande cuesta ${exploreWound(threat)}, y con el nivel alto cuesta más.`,
    eat:
      `Gasta 1 ración y baja el hambre ${foodRelief(threat)} puntos, sin pasar por ` +
      'debajo de cero. No cura: para las heridas está curar.',
    cure:
      `Gasta ${CURE_FOOD_COST} raciones y devuelve hasta ${cureAmount(threat)} de salud, ` +
      'sin pasar del tope. Sin esas raciones el turno se pierde igual.',
    rest:
      `Devuelve energía. Con refugio, 2 o 4 hasta un tope de ${restEnergyCap(threat)}; ` +
      `sin refugio, ${REST_ENERGY_WITHOUT_SHELTER}, que es justo lo que cuesta el turno.`,
    repair:
      'Levanta el refugio si no lo tienes, o lo arregla si está caído. ' +
      `Cuesta ${REPAIR_TURNS} turnos y la tirada puede fallar: un fallo puede derribarlo.`,
  };
}

/**
 * Los eventos, contados según la dificultad.
 *
 * En Normal no existen: el motor solo los tira en Agonía. Decirlo es parte de la
 * hoja, porque quien empieza en Normal y no ve ninguno no tiene forma de saber si
 * es que no pasan o es que no ha llegado.
 */
function eventLines(game: GameState): readonly string[] {
  if (game.difficulty === 'normal') {
    return [
      'En Normal no hay eventos aleatorios. El único peligro son tus propias cuentas.',
    ];
  }

  return [
    'En Agonía, cada turno se tira si pasa algo. La tormenta se lleva el refugio y cuesta energía; el mapache roba comida y hiere cuando la carga es alta; el meteorito quita salud. Ninguno es frecuente: la mayoría de los turnos no pasa nada.',
    'Lo que va a pasar el turno siguiente se sabe antes de elegir, y la terminal lo enseña. Con el nivel alto hay más tiradas por turno, así que el aviso deja de ser un aviso y empieza a ser un plan.',
  ];
}

/**
 * De qué se muere una partida, contando solo lo que existe en esta dificultad.
 *
 * Lo que mata de verdad no lo matan las cinco acciones: es la salud a cero, la
 * energía a cero y el hambre por encima de 10. Las tres son fijas y las tres se
 * diga como se diga. La línea de la salud sí cambia, porque en Agonía hay dos
 * cosas más que la bajan y en Normal no hay ninguna: nombrar el meteorito en
 * Normal dejaría a quien jugara Normal esperando un cielo que no cae nunca.
 */
function endLines(game: GameState): readonly string[] {
  const wounds =
    game.difficulty === 'normal'
      ? 'Se pierde explorando.'
      : 'Se pierde explorando, y en Agonía con el meteorito o con el mapache.';

  return [
    `La salud a cero. ${wounds}`,
    'La energía a cero.',
    'El hambre por encima de 10.',
    'Rendirse, que termina la partida sin que nadie muera.',
  ];
}

/**
 * La hoja de reglas de la partida que está en curso.
 *
 * El gasto de cada acción y la etiqueta salen de `createActions`, que es la misma
 * función que dibuja los botones. No hay una segunda lista de precios: si el precio
 * cambiara, la ayuda y el botón cambiarían a la vez, que es la única forma de que
 * una ayuda no acabe contradiciendo a lo que ayuda.
 */
export function createRulesViewModel(game: GameState): RulesViewModel {
  const turn = turnCost(game.threat);
  const effects = actionEffects(game);

  const actions: RulesActionViewModel[] = createActions(game.threat).map(
    (action) => ({
      id: action.id,
      label: action.label,
      cost: action.cost,
      shortcut: shortcutKeyForAction(action.id),
      effect: effects[action.id],
    }),
  );

  const sections: RulesSectionViewModel[] = [
    {
      title: 'Cada turno',
      lines: [
        `A este nivel, cada turno cuesta ${turn.hunger} de hambre y ${turn.energy} de energía. La energía vale siempre uno; el hambre se encarece con el nivel, así que cuanto más aguantas, más caro es cada turno.`,
        'El gasto se cobra por turno y no por acción, así que aparece en las cinco por igual, y reparar lo paga dos veces.',
      ],
    },
    { title: 'Los eventos', lines: eventLines(game) },
    { title: 'Cómo acaba', lines: endLines(game) },
    {
      title: 'Las barras',
      lines: [
        'Cada bloque es una unidad y la cifra de al lado es la verdad: la barra es una pista para leer de un vistazo, no el dato.',
        'Cuando hay más unidades que bloques, un + al final avisa de que la barra se ha quedado corta. Cuánto sobra lo sigue diciendo la cifra.',
      ],
    },
    {
      title: 'El teclado',
      lines: [
        'Cada acción tiene su tecla, la inicial de su verbo, y sale en su propia fila. Rendirse no la tiene: una decisión que borra la partida se confirma con el botón.',
      ],
    },
    {
      title: 'La semilla',
      lines: [
        'La partida no se guarda: dura mientras esta página siga abierta.',
        'Todo el azar sale de la semilla, que puedes ver en Ajustes. Al morir recibes un enlace con ella y con tus acciones: quien lo abra ve tu partida y tu muerte, y desde ahí puede empezar la suya.',
      ],
    },
  ];

  return {
    title: 'Cómo se juega',
    lead: 'Nunca se gana: se aguanta. Cada turno cuesta hambre y energía, y tu trabajo es que ninguna de las tres cuentas que llevas llegue a su límite.',
    actionsTitle: 'Las cinco acciones',
    actions,
    sections,
  };
}
