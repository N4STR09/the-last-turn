import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePanel } from '../components/ProfilePanel';
import type { ProgressionSummary } from '../../app/progression';

/** Una respuesta con cuerpo, de las que `fetch` devuelve. */
function cuerpo(status: number, valor: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => valor,
  } as unknown as Response;
}

/**
 * El perfil se prueba con la frontera de `fetch` simulada, porque el panel
 * consulta dos cosas: la marca, con `fetchStats`. Lo que importa es el
 * silencio —`null` no es un error, una lista vacía no ocupa nada y una marca
 * que no se pudo leer no se inventa— y el vocabulario: un id desconocido se
 * enseña crudo, no se calla.
 */
const CORREO = 'alguien@example.com';

/** Lo que `/api/stats` contesta por defecto: dentro, sin marca todavía. */
const SIN_MARCA = { autenticado: true, bestTurns: null };

function coleccion(
  cambios: Partial<ProgressionSummary> = {},
): ProgressionSummary {
  return { coins: 0, unlocks: [], achievements: [], ...cambios };
}

let mejorRespuesta: () => Response;
let consultas: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mejorRespuesta = () => cuerpo(200, SIN_MARCA);
  consultas = vi.fn(async () => mejorRespuesta());
  vi.stubGlobal('fetch', consultas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProfilePanel', () => {
  it('enseña el correo y la salida con la colección pendiente', () => {
    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText(CORREO)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/monedas/)).toBeNull();
    expect(screen.queryByText('Personajes')).toBeNull();
    expect(screen.queryByText('Logros')).toBeNull();
  });

  it('cuenta las monedas en singular y en plural', () => {
    const { rerender } = render(
      <ProfilePanel
        email={CORREO}
        progression={coleccion({ coins: 1 })}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText('1 moneda')).toBeInTheDocument();

    rerender(
      <ProfilePanel
        email={CORREO}
        progression={coleccion({ coins: 12 })}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText('12 monedas')).toBeInTheDocument();
  });

  it('traduce personajes y logros y separa con punto', () => {
    render(
      <ProfilePanel
        email={CORREO}
        progression={coleccion({
          coins: 3,
          unlocks: ['explorador', 'insomne'],
          achievements: ['primera-partida', 'turno-50'],
        })}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByText('Personajes')).toBeInTheDocument();
    expect(screen.getByText('Explorador · Insomne')).toBeInTheDocument();
    expect(screen.getByText('Logros')).toBeInTheDocument();
    expect(
      screen.getByText('Primera partida · 50 turnos'),
    ).toBeInTheDocument();
  });

  it('enseña tal cual un identificador que todavía no conoce', () => {
    // Una actualización del servidor que añada un personaje o un logro no
    // puede dejar la línea muda en una página desplegada ayer: el id se
    // enseña crudo hasta que la interfaz aprenda su nombre.
    render(
      <ProfilePanel
        email={CORREO}
        progression={coleccion({
          coins: 3,
          unlocks: ['futuro'],
          achievements: ['logro-nuevo'],
        })}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.getByText('futuro')).toBeInTheDocument();
    expect(screen.getByText('logro-nuevo')).toBeInTheDocument();
  });

  it('calla las listas vacías', () => {
    render(
      <ProfilePanel email={CORREO} progression={coleccion()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('0 monedas')).toBeInTheDocument();
    expect(screen.queryByText('Personajes')).toBeNull();
    expect(screen.queryByText('Logros')).toBeNull();
  });

  it('avisa al pulsar la salida', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={onSignOut} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

/**
 * La marca dentro del perfil.
 *
 * Se consulta con la misma frontera que usa la sesión de juego y se enseña
 * solo cuando hay cifra: sin marca todavía, sin red o con un cuerpo que no se
 * entiende no hay nada que pintar, y la línea no aparece en lugar de
 * enseñar un cero inventado. La singular también cuenta: una marca de una es
 * «1 turno», no «1 turnos».
 */
describe('ProfilePanel · la marca', () => {
  /**
   * El párrafo de la marca, no su etiqueta.
   *
   * `findByText(/Mejor marca/)` se queda en el `<span>` interno, que solo
   * contiene la clave; la cifra es un hermano de texto. Sube al párrafo para
   * poder mirar las dos cosas.
   */
  async function buscarLineaDeMarca(): Promise<HTMLElement> {
    const clave = await screen.findByText('Mejor marca');
    const linea = clave.closest('p');
    if (linea === null) {
      throw new Error('la marca no está en un párrafo');
    }
    return linea as HTMLElement;
  }

  it('enseña la marca que ha batido la cuenta', async () => {
    mejorRespuesta = () => cuerpo(200, { autenticado: true, bestTurns: 47 });

    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );

    const linea = await buscarLineaDeMarca();
    expect(linea).toHaveTextContent('Mejor marca');
    expect(linea).toHaveTextContent('47 turnos');
  });

  it('cuenta la marca de un turno en singular', async () => {
    mejorRespuesta = () => cuerpo(200, { autenticado: true, bestTurns: 1 });

    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );

    expect(await buscarLineaDeMarca()).toHaveTextContent('1 turno');
  });

  it('no enseña marca cuando la cuenta todavía no tiene ninguna', async () => {
    // La respuesta se resuelve a mano para que el test no dependa de cuándo
    // se procesan las microtareas: se espera a que la consulta salga, se
    // contesta y se mira después.
    const resolvers: Array<(respuesta: Response) => void> = [];
    consultas.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    resolvers[0]?.(cuerpo(200, SIN_MARCA));
    await waitFor(() => expect(screen.queryByText(/Mejor marca/)).toBeNull());

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no enseña marca si la consulta no se puede hacer', async () => {
    const rechazos: Array<(error: Error) => void> = [];
    consultas.mockImplementation(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rechazos.push(reject);
        }),
    );

    render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );
    await waitFor(() => expect(rechazos).toHaveLength(1));

    rechazos[0]?.(new Error('sin red'));
    await waitFor(() => expect(screen.queryByText(/Mejor marca/)).toBeNull());

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no escribe la marca si el perfil se va antes de la respuesta', async () => {
    const resolvers: Array<(respuesta: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { unmount } = render(
      <ProfilePanel email={CORREO} progression={null} onSignOut={vi.fn()} />,
    );
    await waitFor(() => expect(resolvers).toHaveLength(1));

    unmount();
    resolvers[0]?.(cuerpo(200, { autenticado: true, bestTurns: 47 }));
    await waitFor(() => expect(screen.queryByText(/Mejor marca/)).toBeNull());
  });
});
