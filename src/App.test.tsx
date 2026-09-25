import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

async function startNormalGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Comenzar' }));
  await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
}

describe('App', () => {
  it('conecta inicio, dificultad y partida moviendo el foco', async () => {
    const user = userEvent.setup();
    render(<App />);

    const startHeading = screen.getByRole('heading', {
      level: 1,
      name: 'The Last Turn',
    });
    expect(startHeading).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Jugar en Normal' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'La partida' }),
    ).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Recursos' })).toBeVisible();
  });

  it('muestra los cambios de una acción sin recargar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startNormalGame(user);

    await user.click(screen.getByRole('button', { name: 'Descansar' }));

    const header = screen.getByRole('banner');
    expect(within(header).getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Última resolución' }),
    ).toHaveTextContent('Intentas descansar, pero no tienes refugio.');
    expect(screen.getByText('Hambre: +1')).toBeInTheDocument();
    expect(screen.getByText('Energía: −1')).toBeInTheDocument();
  });

  it('lleva una muerte en Agonía a la pantalla final y reinicia', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.98);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Agonía' }));
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
    );

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toHaveFocus();
  });

  it('una nueva.renderización de la aplicación comienza en Inicio', () => {
    const firstRender = render(<App />);
    firstRender.unmount();

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toBeInTheDocument();
  });
});
