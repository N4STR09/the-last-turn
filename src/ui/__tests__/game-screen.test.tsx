import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GameScreen } from '../screens/GameScreen';
import type { GameViewModel } from '../view-models/ui-types';

const model: GameViewModel = {
  difficulty: 'agony',
  turn: 3,
  resources: [
    {
      id: 'hunger',
      label: 'Hambre',
      value: '4 / 10',
      stateLabel: 'Empieza a pesar',
      tone: 'warning',
    },
    {
      id: 'energy',
      label: 'Energía',
      value: '8',
      stateLabel: 'Reserva estable',
      tone: 'positive',
    },
    {
      id: 'food',
      label: 'Comida',
      value: '2',
      stateLabel: 'Algo en la mochila',
      tone: 'positive',
    },
    {
      id: 'shelter',
      label: 'Refugio',
      value: 'Ausente',
      stateLabel: 'Sin protección',
      tone: 'warning',
    },
  ],
  resolution: {
    actionId: 'repair',
    headline: 'No logras reparar el refugio.',
    details: ['El attempt no encuentra piezas suficientes.'],
    deltas: [
      {
        id: 'energy',
        label: 'Energía',
        value: '−2',
        tone: 'warning',
      },
    ],
    event: {
      type: 'storm',
      headline: 'Tormenta',
      description: 'El refugio ha quedado expuesto.',
    },
    milestone: 'Hito del turno 15',
  },
};

describe('GameScreen', () => {
  it('muestra recursos sin revelar salud y presenta la partida', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'La partida' }),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByRole('region', { name: 'Recursos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hambre')).toBeInTheDocument();
    expect(screen.getByText('Energía')).toBeInTheDocument();
    expect(screen.getByText('Comida')).toBeInTheDocument();
    expect(screen.getByText('Refugio')).toBeInTheDocument();
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.queryByText('Salud')).toBeNull();

    const header = screen.getByRole('banner');
    expect(within(header).getByText('Turno')).toBeInTheDocument();
    expect(within(header).getByText('3')).toBeInTheDocument();
    expect(within(header).getByText('Agonía')).toBeInTheDocument();
  });

  it('anuncia la resolución en orden: acción, evento e hito', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    const resolution = screen.getByRole('status', { name: 'Última resolución' });

    expect(resolution).toHaveAttribute('aria-live', 'polite');
    expect(resolution).toHaveAttribute('aria-atomic', 'true');
    const text = resolution.textContent ?? '';
    expect(text.indexOf('No logras')).toBeLessThan(
      text.indexOf('El attempt'),
    );
    expect(text.indexOf('El attempt')).toBeLessThan(text.indexOf('Tormenta'));
    expect(text.indexOf('Tormenta')).toBeLessThan(
      text.indexOf('Hito del turno 15'),
    );
    expect(within(resolution).getByText('Energía: −2')).toBeInTheDocument();
  });

  it('renderiza un estado inicial de resolución sin resultado', () => {
    render(
      <GameScreen
        model={{ ...model, resolution: null }}
        onAction={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Todavía no has realizado ninguna acción.'),
    ).toBeInTheDocument();
  });

  it('omite listas y avisos cuando la resolución no tiene detalles opcionales', () => {
    render(
      <GameScreen
        model={{
          ...model,
          resolution: {
            actionId: 'help',
            headline: 'Consultas las reglas del refugio.',
            details: [],
            deltas: [],
            event: null,
            milestone: null,
          },
        }}
        onAction={vi.fn()}
      />,
    );

    const resolution = screen.getByRole('status', { name: 'Última resolución' });
    expect(resolution).toHaveTextContent('Consultas las reglas del refugio.');
    expect(
      within(resolution).queryByRole('list', { name: 'Detalles de la acción' }),
    ).toBeNull();
    expect(
      within(resolution).queryByRole('list', { name: 'Cambios de recursos' }),
    ).toBeNull();
  });

  it('emite las siete acciones con sus identificadores', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<GameScreen model={model} onAction={onAction} />);

    const actions = [
      ['Buscar comida', 'forage'],
      ['Descansar', 'rest'],
      ['Explorar', 'explore'],
      ['Fabricar o reparar refugio', 'repair'],
      ['Cazar o pescar', 'fish'],
      ['Comer', 'eat'],
      ['Ayuda', 'help'],
    ] as const;

    for (const [label] of actions) {
      await user.click(screen.getByRole('button', { name: label }));
    }

    expect(onAction).toHaveBeenCalledTimes(actions.length);
    for (const [label, action] of actions) {
      expect(onAction).toHaveBeenNthCalledWith(
        actions.findIndex(([candidate]) => candidate === label) + 1,
        action,
      );
    }
  });
});
