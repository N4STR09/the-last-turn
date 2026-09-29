import { describe, expect, it } from 'vitest';

import {
  actionCost,
  createGame,
  cureAmount,
  exploreWound,
  foodRelief,
  restEnergyCap,
} from '../../game';
import {
  shortcutActionForKey,
  shortcutKeyForAction,
} from '../app-keyboard';
import { createActions } from '../game-view-model';
import { createRulesViewModel } from '../rules';
import type { GameAction, GameState } from '../../game';
import type { RulesViewModel } from '../../ui/view-models/ui-types';

const actions: readonly GameAction[] = [
  'explore',
  'eat',
  'cure',
  'rest',
  'repair',
];

const alphabet = 'abcdefghijklmnopqrstuvwxyz';

/** Partida en marcha en un nivel de amenaza concreto. */
function gameAt(
  threat: number,
  difficulty: GameState['difficulty'] = 'agony',
): GameState {
  return { ...createGame(difficulty), threat };
}

/** Todo el texto de la hoja en un solo hilo, para poder buscar dentro. */
function textOf(model: RulesViewModel): string {
  return [
    model.title,
    model.lead,
    model.actionsTitle,
    ...model.actions.flatMap((action) => [
      action.label,
      action.cost,
      action.effect,
    ]),
    ...model.sections.flatMap((section) => [section.title, ...section.lines]),
  ].join(' | ');
}

function sectionOf(model: RulesViewModel, title: string): readonly string[] {
  return model.sections.find((section) => section.title === title)?.lines ?? [];
}

describe('createRulesViewModel', () => {
  it('reutiliza los botones: mismo orden, mismo nombre y mismo precio', () => {
    const game = gameAt(3);
    const model = createRulesViewModel(game);
    const buttons = createActions(game.threat);

    // La hoja no tiene una segunda lista de acciones. Si el precio de una
    // cambiara, tiene que cambiar en los dos sitios a la vez, porque el jugador
    // ya ha decidido cuando lee la ayuda.
    expect(model.actions.map((action) => action.id)).toEqual(
      buttons.map((button) => button.id),
    );
    expect(model.actions.map((action) => action.label)).toEqual(
      buttons.map((button) => button.label),
    );
    expect(model.actions.map((action) => action.cost)).toEqual(
      buttons.map((button) => button.cost),
    );
  });

  it('da la vuelta entre teclas y acciones en los dos sentidos', () => {
    for (const action of actions) {
      expect(
        shortcutActionForKey(shortcutKeyForAction(action).toLowerCase()),
      ).toBe(action);
    }

    for (const key of alphabet) {
      const action = shortcutActionForKey(key);

      if (action !== null) {
        expect(shortcutKeyForAction(action).toLowerCase()).toBe(key);
      }
    }

    // Y son exactamente cinco teclas las que tienen atajo: una sexta acción sin
    // la suya se contaría aquí, que es de donde saldría el fallo.
    const mapped = [...alphabet].filter(
      (key) => shortcutActionForKey(key) !== null,
    );

    expect(mapped).toHaveLength(actions.length);
  });

  it('pone en cada acción la tecla que el teclado escucha de verdad', () => {
    const model = createRulesViewModel(gameAt(0));

    expect(model.actions.map((action) => action.shortcut)).toEqual(
      actions.map((action) => shortcutKeyForAction(action)),
    );
  });

  it('cifra el gasto de un turno con los números del motor', () => {
    const cost = actionCost('rest', 0);
    const [primera] = sectionOf(createRulesViewModel(gameAt(0)), 'Cada turno');

    expect(primera).toContain(`${cost.hungerPerTurn} de hambre`);
    expect(primera).toContain(`${cost.energy} de energía`);
  });

  it('recalcula las cifras cuando sube la amenaza', () => {
    // La prueba de que los números no están escritos a mano en la hoja: si lo
    // estuvieran, estas dos hojas dirían lo mismo y mentirían en la segunda.
    const bajo = textOf(createRulesViewModel(gameAt(0)));
    const alto = textOf(createRulesViewModel(gameAt(8)));

    expect(bajo).not.toBe(alto);
    expect(alto).toContain(String(exploreWound(8)));
    expect(alto).toContain(String(foodRelief(8)));
    expect(alto).toContain(String(cureAmount(8)));
    expect(alto).toContain(String(restEnergyCap(8)));
    expect(bajo).not.toContain(String(foodRelief(8)));
  });

  it('cambia la sección de eventos según la dificultad', () => {
    const normal = textOf(createRulesViewModel(gameAt(0, 'normal')));
    const agony = textOf(createRulesViewModel(gameAt(0, 'agony')));

    // En Normal no hay eventos, y decirlo es parte de la ayuda: quien no ve
    // ninguno no tiene forma de saber si es que no pasan o que no han llegado.
    expect(normal).toContain('En Normal no hay eventos aleatorios');
    expect(normal).not.toContain('meteorito');

    expect(agony).toContain('tormenta');
    expect(agony).toContain('mapache');
    expect(agony).toContain('meteorito');
  });

  it('no nombra como matadores cosas que en esa dificultad no existen', () => {
    // La sección de cómo acaba nombra el meteorito y el mapache, y en Normal
    // ninguno de los dos llega a tirar. Un jugador de Normal al que se le
    // nombra un meteorito se queda esperando un cielo que no cae nunca.
    const normal = sectionOf(createRulesViewModel(gameAt(0, 'normal')), 'Cómo acaba');
    const agony = sectionOf(createRulesViewModel(gameAt(0, 'agony')), 'Cómo acaba');

    expect(normal.join(' ')).not.toContain('meteorito');
    expect(normal.join(' ')).not.toContain('mapache');
    expect(agony.join(' ')).toContain('meteorito');
    expect(agony.join(' ')).toContain('mapache');
  });

  it('sale con las secciones en orden y ninguna vacía', () => {
    const model = createRulesViewModel(gameAt(0));

    expect(model.title).toBe('Cómo se juega');
    expect(model.lead).not.toBe('');
    expect(model.actionsTitle).toBe('Las cinco acciones');
    expect(model.sections.map((section) => section.title)).toEqual([
      'Cada turno',
      'Los eventos',
      'Cómo acaba',
      'Las barras',
      'El teclado',
      'La semilla',
    ]);
    expect(
      model.sections.every((section) => section.lines.length > 0),
    ).toBe(true);
  });

  it('explica las cinco acciones y no deja ninguna sin texto', () => {
    const model = createRulesViewModel(gameAt(0));

    expect(model.actions).toHaveLength(actions.length);

    for (const action of model.actions) {
      expect(action.effect).not.toBe('');
      expect(action.shortcut).toMatch(/^[A-Z]$/);
      // El gasto se cita con el mismo formato que el botón, sin «hasta».
      expect(action.cost).toMatch(/^\(\+\d+ hambre, −\d+ energía\)$/);
    }
  });

  it('dice las tres maneras de morir y la de rendirse', () => {
    const text = textOf(createRulesViewModel(gameAt(0)));

    expect(text).toContain('La salud a cero');
    expect(text).toContain('La energía a cero');
    expect(text).toContain('El hambre por encima de 10');
    expect(text).toContain('Rendirse');
  });

  it('explica el + de la barra y dónde está la semilla', () => {
    const model = createRulesViewModel(gameAt(0));

    // Son las dos cosas que el jugador no puede deducir solo mirando la
    // pantalla, y por eso están: el `+` es un signo y no un número, y la semilla
    // vive en un sitio que la hoja tiene que nombrar.
    expect(textOf(model)).toContain('+');
    expect(sectionOf(model, 'La semilla').join(' ')).toContain('Ajustes');
  });
});
