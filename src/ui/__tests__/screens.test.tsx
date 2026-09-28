import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DifficultyScreen } from '../screens/DifficultyScreen';
import { StartScreen } from '../screens/StartScreen';

describe('StartScreen', () => {
  it('presenta el inicio sin selector de dificultad', () => {
    render(<StartScreen onBegin={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByText(/cada decisión cuenta/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Comenzar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/mientras la página permanezca abierta/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agonía/i })).toBeNull();
  });

  it('escribe «Sobrevive» y no el anglicismo que lo deformaba', () => {
    render(<StartScreen onBegin={vi.fn()} />);

    // La entradilla decía «Overvive». No es que se viese mal: es que la palabra
    // no es esa, y una comprobacion literal evita que vuelva a colarse.
    expect(screen.getByText(/Sobrevive todo lo que puedas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Overvive/i)).toBeNull();
  });

  it('emite el callback al comenzar', async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn();
    render(<StartScreen onBegin={onBegin} />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));

    expect(onBegin).toHaveBeenCalledOnce();
  });
});

describe('DifficultyScreen', () => {
  it('explica las dos dificultades y la escalada que comparten', () => {
    render(<DifficultyScreen onSelect={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Jugar en Normal' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Jugar en Agonía' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Eventos aleatorios pueden destruir el refugio, robar comida o quitarte salud\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Una partida sin eventos aleatorios/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hambre sube, la energía baja.*escalada/i),
    ).toBeInTheDocument();
  });

  it('no menciona los hitos de turnos 15 y 30, que la escalada sustituyo', () => {
    render(<DifficultyScreen onSelect={vi.fn()} />);

    // La Fase 2 sustituyo los hitos por escalada progresiva. El copy los
    // describia todavia, en su forma abreviada, y por eso hace falta una
    // comprobacion explicita y no solo la del bundle.
    expect(screen.queryByText(/hito/i)).toBeNull();
    expect(screen.queryByText(/15 y 30/)).toBeNull();
  });

  it('enseña la calavera con cuernos en Agonía y sin ella en Normal', () => {
    const { container } = render(<DifficultyScreen onSelect={vi.fn()} />);

    const agony = container.querySelector(
      '.difficulty-card--agony .skull',
    );
    const normal = container.querySelector(
      '.difficulty-card--normal .skull',
    );

    expect(agony).not.toBeNull();
    expect(agony?.querySelector('.skull__horns')).not.toBeNull();
    expect(normal).toBeNull();
  });

  it('no presenta el meteorito como muerte inmediata en Agonía', () => {
    render(<DifficultyScreen onSelect={vi.fn()} />);

    // El meteorito quita un punto de salud (Fase 1, I-03): el copy no puede
    // prometer una muerte, porque desde salud inicial no mata.
    expect(screen.queryByText(/provocar una muerte|matar al jugador/i)).toBeNull();
    expect(screen.queryByText(/quitarte toda la salud/i)).toBeNull();
  });

  it('no rotula las tarjetas con un modo que no existe', () => {
    const { container } = render(<DifficultyScreen onSelect={vi.fn()} />);

    // «Modo de supervivencia» era una etiqueta fija que no distinguía una
    // tarjeta de la otra: las dos son supervivencia, así que la etiqueta sobra.
    expect(container.querySelector('.difficulty-card__label')).toBeNull();
    expect(screen.queryByText(/modo de supervivencia/i)).toBeNull();
  });

  it('permite seleccionar con teclado', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DifficultyScreen onSelect={onSelect} />);

    const normalButton = screen.getByRole('button', { name: 'Jugar en Normal' });
    await user.tab();
    expect(normalButton).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('normal');
  });

  it.each([
    ['Normal', 'normal'],
    ['Agonía', 'agony'],
  ] as const)('selecciona %s mediante su botón', async (label, difficulty) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DifficultyScreen onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: `Jugar en ${label}` }));

    expect(onSelect).toHaveBeenCalledWith(difficulty);
  });
});
