import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GameScreen } from '../screens/GameScreen';
import type { GameViewModel } from '../view-models/ui-types';

const model: GameViewModel = {
  difficulty: 'agony',
  turn: 3,
  threat: 1,
  resources: [
    {
      id: 'hunger',
      label: 'Hambre',
      value: '4',
      stateLabel: 'Hambre al límite',
      tone: 'warning',
      units: 4,
      capacity: 12,
      critical: false,
    },
    {
      id: 'energy',
      label: 'Energía',
      value: '8',
      stateLabel: 'Energía disponible',
      tone: 'positive',
      units: 8,
      capacity: 12,
      critical: false,
    },
    {
      id: 'food',
      label: 'Comida',
      value: '2',
      stateLabel: 'Provisiones disponibles',
      tone: 'positive',
      units: 2,
      capacity: 12,
      critical: false,
    },
    {
      id: 'shelter',
      label: 'Refugio',
      value: 'Ausente',
      stateLabel: 'Expuesto',
      tone: 'warning',
      units: 0,
      capacity: 1,
      critical: false,
    },
  ],
  resolution: {
    actionId: 'repair',
    headline: 'No consigues reparar el refugio.',
    details: ['El refugio conserva su estado anterior.'],
    deltas: [
      {
        id: 'energy',
        label: 'Energía',
        value: '−2',
        tone: 'warning',
      },
    ],
    events: [
      {
        type: 'storm',
        headline: 'Tormenta',
        description: 'Tu refugio ha resultado dañado por las fuertes tormentas!',
      },
    ],
  },
  actions: [
    { id: 'forage', label: 'Buscar comida', cost: '(+1 hambre, −1 energía)' },
    { id: 'rest', label: 'Descansar', cost: '(+1 hambre, −1 energía)' },
    { id: 'explore', label: 'Explorar', cost: '(+1 hambre, −1 energía)' },
    { id: 'repair', label: 'Reparar refugio', cost: '(+4 hambre, −2 energía)' },
    { id: 'fish', label: 'Cazar o pescar', cost: '(hasta +6 hambre, −6 energía)' },
    { id: 'eat', label: 'Comer', cost: '(+1 hambre, −1 energía)' },
    { id: 'help', label: 'Ayuda', cost: '(sin coste)' },
  ],
};

describe('GameScreen', () => {
  it('abre con el nombre del juego y el foco listo para recibirlo', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('sitúa la ronda y el nivel de escalada como lo más brillante del banner', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('3')).toBeInTheDocument();
    expect(within(banner).getByText('1')).toBeInTheDocument();
    expect(within(banner).getByText('Ronda')).toBeInTheDocument();
    expect(within(banner).getByText('Nivel')).toBeInTheDocument();
  });

  it('muestra los cuatro recursos sin revelar salud', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    for (const label of ['Hambre', 'Energía', 'Comida', 'Refugio']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.queryByText('Salud')).toBeNull();
  });

  it('dibuja un bloque encendido por unidad y apaga el resto', () => {
    const { container } = render(
      <GameScreen model={model} onAction={vi.fn()} />,
    );

    const energy = container.querySelector(
      '[data-resource-id="energy"] .stat__bar',
    );
    const blocks = energy?.querySelectorAll('.stat__block--filled') ?? [];

    expect(energy?.querySelectorAll('.stat__block')).toHaveLength(12);
    expect(blocks).toHaveLength(8);
  });

  it('apaga la barra entera cuando el recurso está a cero', () => {
    const { container } = render(
      <GameScreen model={model} onAction={vi.fn()} />,
    );

    const food = container.querySelector(
      '[data-resource-id="food"] .stat__bar',
    );
    // La barra que se vacía del todo es la del refugio: un único bloque, sin
    // encender mientras no haya techo.
    const shelter = container.querySelector(
      '[data-resource-id="shelter"] .stat__bar',
    );

    expect(food?.querySelectorAll('.stat__block--filled')).toHaveLength(2);
    expect(shelter?.querySelectorAll('.stat__block')).toHaveLength(1);
    expect(shelter?.querySelectorAll('.stat__block--filled')).toHaveLength(0);
  });

  it('escribe el aviso en texto solo cuando hay algo que avisar', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    expect(screen.getByText('Hambre al límite')).toBeInTheDocument();
    expect(screen.getByText('Expuesto')).toBeInTheDocument();
    // 'Energía disponible' y 'Provisiones disponibles' no se escriben: la fila
    // se limita a etiqueta, cifra y barra cuando no hay peligro.
    expect(screen.queryByText('Energía disponible')).toBeNull();
    expect(screen.queryByText('Provisiones disponibles')).toBeNull();
  });

  it('marca el estado crítico para que el aviso no dependa del color', () => {
    render(
      <GameScreen
        model={{
          ...model,
          resources: model.resources.map((resource) =>
            resource.id === 'energy'
              ? {
                  ...resource,
                  value: '2',
                  units: 2,
                  tone: 'warning',
                  stateLabel: 'Reserva crítica',
                  critical: true,
                }
              : resource,
          ),
        }}
        onAction={vi.fn()}
      />,
    );

    const energy = document.querySelector('[data-resource-id="energy"]');
    expect(energy).toHaveClass('stat--critical');
    expect(energy).toHaveAttribute('data-critical', 'true');
    expect(screen.getByText('Reserva crítica')).toBeInTheDocument();
  });

  it('anuncia la resolución en orden: acción, detalles y evento', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    const resolution = screen.getByRole('status');

    expect(resolution).toHaveAttribute('aria-live', 'polite');
    expect(resolution).toHaveAttribute('aria-atomic', 'true');
    const text = resolution.textContent ?? '';
    expect(text.indexOf('No consigues')).toBeLessThan(
      text.indexOf('El refugio conserva'),
    );
    expect(text.indexOf('El refugio conserva')).toBeLessThan(
      text.indexOf('Tormenta'),
    );
    expect(within(resolution).getByText(/Energía −2/)).toBeInTheDocument();
  });

  it('abre la terminal esperando órdenes antes del primer turno', () => {
    render(
      <GameScreen
        model={{ ...model, resolution: null }}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin órdenes todavía.')).toBeInTheDocument();
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
            events: [],
          },
        }}
        onAction={vi.fn()}
      />,
    );

    const resolution = screen.getByRole('status');
    expect(resolution).toHaveTextContent('Consultas las reglas del refugio.');
    expect(
      within(resolution).queryByRole('list', { name: 'Cambios de recursos' }),
    ).toBeNull();
  });

  it('pone la calavera de Agonía con cuornos y ojos rojos en la terminal', () => {
    const { container } = render(
      <GameScreen model={model} onAction={vi.fn()} />,
    );

    const skull = container.querySelector('.terminal .skull');
    expect(skull).toHaveAttribute('data-difficulty', 'agony');
    expect(skull?.querySelector('.skull__horns')).not.toBeNull();
  });

  it('quita los cuernos en Normal', () => {
    const { container } = render(
      <GameScreen
        model={{ ...model, difficulty: 'normal' }}
        onAction={vi.fn()}
      />,
    );

    const skull = container.querySelector('.terminal .skull');
    expect(skull).toHaveAttribute('data-difficulty', 'normal');
    expect(skull?.querySelector('.skull__horns')).toBeNull();
  });

  it('emite las siete acciones con su gasto y sus identificadores', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<GameScreen model={model} onAction={onAction} />);

    const expected = [
      ['Buscar comida', 'forage'],
      ['Descansar', 'rest'],
      ['Explorar', 'explore'],
      ['Reparar refugio', 'repair'],
      ['Cazar o pescar', 'fish'],
      ['Comer', 'eat'],
      ['Ayuda', 'help'],
    ] as const;

    for (const [label] of expected) {
      await user.click(screen.getByRole('button', { name: new RegExp(label) }));
    }

    expect(onAction).toHaveBeenCalledTimes(expected.length);
    expected.forEach(([, action], index) => {
      expect(onAction).toHaveBeenNthCalledWith(index + 1, action);
    });
  });

  it('imprime el gasto real de cada acción junto a su nombre', () => {
    render(<GameScreen model={model} onAction={vi.fn()} />);

    const actions = screen.getByRole('group', { name: 'Acciones' });
    expect(within(actions).getByText('(+4 hambre, −2 energía)')).toBeInTheDocument();
    expect(
      within(actions).getByText('(hasta +6 hambre, −6 energía)'),
    ).toBeInTheDocument();
    expect(within(actions).getByText('(sin coste)')).toBeInTheDocument();
  });
});
