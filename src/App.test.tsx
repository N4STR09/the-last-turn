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
    // El h1 de la partida es el nombre del juego, igual que en el inicio: solo
    // hay una pantalla montada a la vez, así que no hay ambigüedad.
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('list', { name: 'Lo que te mantiene en pie' }),
    ).toBeVisible();
  });

  it('muestra los cambios de una acción sin recargar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startNormalGame(user);

    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Descansas al aire libre.',
    );
    const deltas = within(
      screen.getByRole('list', { name: 'Cambios de recursos' }),
    );
    expect(deltas.getByText(/Hambre \+1/)).toBeInTheDocument();
    // La energía no sale entre los cambios: sin refugio se recuperan 1 y el turno
    // cuesta 1, así que el delta es cero y la terminal no inventa un número para
    // rellenar. Descansar al aire libre ya no es un fallo que se enuncia como
    // tal: es una decisión, y su precio se ve en la cifra que no se movió.
    expect(deltas.queryByText(/Energía/)).toBeNull();
  });

  it('lleva una muerte en Agonía a la pantalla final y reinicia', async () => {
    const user = userEvent.setup();
    // Cada tirada sale 99, que es el meteorito: un punto de salud por turno.
    vi.spyOn(Math, 'random').mockReturnValue(0.98);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    await user.click(screen.getByRole('button', { name: 'Jugar en Agonía' }));

    // El umbral 1 cae en el turno 10, así que el noveno descanso es el último
    // antes del aviso de escalada.
    for (let rest = 0; rest < 9; rest += 1) {
      await user.click(screen.getByRole('button', { name: /^Descansar/ }));
    }

    await user.click(screen.getByText('Haz click para continuar...'));
    await user.click(screen.getByRole('button', { name: /^Descansar/ }));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toHaveFocus();
    // Salud y energía se agotan el mismo turno, y el hambre también llega a 10.
    // El motor dice el hambre porque es el número que el jugador llevaba
    // viendo subir desde el primer descanso.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    );
    expect(screen.getByText('10 turnos aguantados')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Volver a jugar' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige dificultad' }),
    ).toHaveFocus();
  });

  it('rendirse pide confirmación y no se llega a la derrota sin pulsarla dos veces', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startNormalGame(user);

    await user.click(screen.getByRole('button', { name: /Rendirse/ }));

    expect(
      screen.getByRole('dialog', { name: /¿Seguro que te rindes?/ }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Seguir jugando' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rendirse/ }));
    await user.click(screen.getByRole('button', { name: 'Rendirme' }));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'La partida ha terminado',
      }),
    ).toHaveFocus();
    expect(screen.getByText('Fin voluntario')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Te has autoeliminado con un botón. El refugio queda intacto y tú, desinstalado.',
    );
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
