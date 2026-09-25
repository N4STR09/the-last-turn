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

  it('emite el callback al comenzar', async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn();
    render(<StartScreen onBegin={onBegin} />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));

    expect(onBegin).toHaveBeenCalledOnce();
  });
});

describe('DifficultyScreen', () => {
  it('explica las dos dificultades y los hitos compartidos', () => {
    render(<DifficultyScreen onSelect={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Jugar en Normal' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Jugar en Agonía' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Una partida sin eventos aleatorios/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Eventos aleatorios pueden/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hambre.*energía.*15.*30/i),
    ).toBeInTheDocument();
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
