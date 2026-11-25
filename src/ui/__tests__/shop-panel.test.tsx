import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopPanel } from '../components/ShopPanel';

const CARGA_ERROR = 'No se ha podido cargar la tienda. Inténtalo otra vez.';
const COMPRA_ERROR = 'No se ha podido completar la compra. Inténtalo otra vez.';
const FUERA = 'Inicia sesión en tu cuenta para comprar objetos.';

/**
 * La tienda se prueba con el servidor simulado en la frontera de `fetch`, que
 * es donde empieza lo que es de la interfaz y acaba lo que es del servidor. El
 * motor de compra ya está probado contra SQLite de verdad en
 * `functions/api/__tests__/shop.test.ts`; aquí lo que importa es qué pide la
 * interfaz, qué hace con cada respuesta y, sobre todo, qué no hace: sin
 * cuentas no se pinta nada ni se pregunta nada, y un fallo de consulta no se
 * disfraza de «no hay nada que comprar».
 */

function cuerpo(status: number, valor: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => valor,
  } as unknown as Response;
}

/** Lo que la consulta de tienda contesta por defecto: dentro, sin nada. */
const DENTRO_VACIO = { autenticado: true, balance: 0, objects: [] as string[] };

let consultas: string[];
let compras: string[];
let respuestaConsulta: () => Response;
let respuestaCompra: () => Response;
/** Las compras que se quedan esperando, para poder resolverlas a mano. */
let compraPendiente: Promise<Response> | null;
let resolversCompra: Array<(respuesta: Response) => void>;

/**
 * Espera a que el saldo esté pintado.
 *
 * El saldo comparte texto con los precios del catálogo —«10 monedas» es a la
 * vez un saldo y el precio de la Ceniza—, así que no se busca por el texto
 * sino dentro de su propio nodo.
 */
async function esperarSaldo(texto: string): Promise<HTMLElement> {
  return await waitFor(() => {
    const saldo = document.querySelector('.shop-panel__balance');
    if (saldo === null || saldo.textContent !== texto) {
      throw new Error(`el saldo todavía no dice «${texto}»`);
    }
    return saldo as HTMLElement;
  });
}

/** El primer botón de comprar que se puede pulsar —el de más a la izquierda. */
function comprarDisponible(): HTMLElement {
  const botones = screen
    .getAllByRole('button', { name: 'Comprar' })
    .filter((boton) => !boton.hasAttribute('disabled'));
  const boton = botones[0];
  if (boton === undefined) {
    throw new Error('no hay ningún objeto comprable');
  }
  return boton;
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  vi.stubEnv('VITE_ACCOUNTS', '1');

  consultas = [];
  compras = [];
  respuestaConsulta = () => cuerpo(200, DENTRO_VACIO);
  respuestaCompra = () => cuerpo(200, DENTRO_VACIO);
  compraPendiente = null;
  resolversCompra = [];

  vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) => {
    const ruta = String(input);
    if (init?.method === 'POST') {
      compras.push(ruta);
      if (compraPendiente !== null) {
        return compraPendiente;
      }
      return Promise.resolve(respuestaCompra());
    }
    consultas.push(ruta);
    return Promise.resolve(respuestaConsulta());
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('ShopPanel', () => {
  it('no pinta nada ni pregunta nada cuando no hay cuentas', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '');

    const { container } = render(<ShopPanel />);
    await waitFor(() => expect(consultas).toEqual([]));

    expect(container.firstChild).toBeNull();
    expect(compras).toEqual([]);
  });

  it('deja el panel oculto mientras consulta y lo abre cuando responde', async () => {
    respuestaConsulta = () => cuerpo(200, { autenticado: true, balance: 20, objects: [] });

    const { container } = render(<ShopPanel />);

    const panel = container.querySelector('aside');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('hidden');

    expect(await esperarSaldo('20 monedas')).toBeInTheDocument();
    expect(panel).not.toHaveAttribute('hidden');
    expect(consultas).toEqual(['/api/unlocks']);
  });

  it('enseña el catálogo con nombres, precios y saldo', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 25, objects: ['ceniza'] });

    render(<ShopPanel />);

    expect(await esperarSaldo('25 monedas')).toBeInTheDocument();
    expect(screen.getByText('Ceniza')).toBeInTheDocument();
    expect(screen.getByText('10 monedas')).toBeInTheDocument();
    expect(screen.getByText('Nómada')).toBeInTheDocument();
    // Lo que ya está comprado no se vuelve a comprar: no tiene botón, y el
    // resto del catálogo —cinco objetos— sí.
    expect(screen.getByText('Comprado')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Comprar' })).toHaveLength(5);
  });

  it('deshabilita los objetos que no se pueden pagar', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 15, objects: [] });

    render(<ShopPanel />);

    expect(await esperarSaldo('15 monedas')).toBeInTheDocument();
    // Con 15 monedas caben Ceniza (10) y Superviviente (15); los otros cuatro
    // —Ámbar, Óxido, Calavera doble y Nómada— no.
    const botones = screen.getAllByRole('button', { name: 'Comprar' });
    expect(botones).toHaveLength(6);
    expect(botones.filter((boton) => !boton.hasAttribute('disabled'))).toHaveLength(2);
    expect(botones.filter((boton) => boton.hasAttribute('disabled'))).toHaveLength(4);
  });

  it('escribe «1 moneda» y no «1 monedas»', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 1, objects: [] });

    render(<ShopPanel />);

    expect(await esperarSaldo('1 moneda')).toBeInTheDocument();
  });

  it('enseña el mensaje de carga con su reintento cuando la consulta no se lee', async () => {
    respuestaConsulta = () => cuerpo(200, 'esto no es un cuerpo');

    render(<ShopPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(CARGA_ERROR);
    expect(consultas).toEqual(['/api/unlocks']);
  });

  it('vuelve a consultar con el reintento y se abre si esta vez responde', async () => {
    respuestaConsulta = () => cuerpo(200, 'esto no es un cuerpo');

    render(<ShopPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent(CARGA_ERROR);

    respuestaConsulta = () => cuerpo(200, DENTRO_VACIO);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await esperarSaldo('0 monedas')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(consultas).toEqual(['/api/unlocks', '/api/unlocks']);
  });

  it('no es un fallo cuando no hay sesión: enseña cómo entrar', async () => {
    respuestaConsulta = () => cuerpo(200, { autenticado: false });

    render(<ShopPanel />);

    expect(await screen.findByText(FUERA)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comprar' })).toBeNull();
  });

  it('compra un objeto, actualiza el saldo y lo marca como comprado', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 10, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('10 monedas')).toBeInTheDocument();

    respuestaCompra = () =>
      cuerpo(200, { autenticado: true, balance: 0, objects: ['ceniza'] });
    await userEvent.click(comprarDisponible());

    expect(await screen.findByText('Comprado')).toBeInTheDocument();
    expect(await esperarSaldo('0 monedas')).toBeInTheDocument();
    expect(compras).toEqual(['/api/shop/purchase']);
  });

  it('manda solo el identificador del objeto que se pulsa', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 40, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('40 monedas')).toBeInTheDocument();

    const botones = screen.getAllByRole('button', { name: 'Comprar' });
    await userEvent.click(botones[3] as HTMLElement);

    await waitFor(() => expect(compras).toHaveLength(1));
    // La comprobación de qué cuerpo viaja es de `shop.test.ts`; aquí basta con
    // que la ruta sea la de compra y no la de consulta.
    expect(compras[0]).toBe('/api/shop/purchase');
    expect(consultas).toEqual(['/api/unlocks']);
  });

  it('avisa con el mensaje del servidor cuando el saldo no llega', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 10, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('10 monedas')).toBeInTheDocument();

    respuestaCompra = () =>
      cuerpo(409, { error: 'Saldo insuficiente: necesitas 15 monedas' });
    await userEvent.click(comprarDisponible());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Saldo insuficiente: necesitas 15 monedas',
    );
    // El aviso no deja la pantalla roja: el catálogo sigue ahí y usable.
    expect(screen.getByText('Ceniza')).toBeInTheDocument();
    expect(await esperarSaldo('10 monedas')).toBeInTheDocument();
  });

  it('usa su propio mensaje cuando el rechazo no trae ninguno aprovechable', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 10, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('10 monedas')).toBeInTheDocument();

    respuestaCompra = () => cuerpo(500, {});
    await userEvent.click(comprarDisponible());

    expect(await screen.findByRole('alert')).toHaveTextContent(COMPRA_ERROR);
  });

  it('marca la compra que está en marcha y no deja pulsar otra', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 40, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('40 monedas')).toBeInTheDocument();

    compraPendiente = new Promise<Response>((resolve) => {
      resolversCompra.push(resolve);
    });

    const botones = screen.getAllByRole('button', { name: 'Comprar' });
    await userEvent.click(botones[0] as HTMLElement);

    expect(await screen.findByRole('button', { name: 'Comprando...' })).toBeInTheDocument();
    for (const boton of screen.getAllByRole('button', { name: 'Comprar' })) {
      expect(boton).toBeDisabled();
    }

    resolversCompra[0]?.(
      cuerpo(200, { autenticado: true, balance: 30, objects: ['ceniza'] }),
    );

    expect(await screen.findByText('Comprado')).toBeInTheDocument();
    expect(await esperarSaldo('30 monedas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprando...' })).toBeNull();
  });

  it('borra el aviso anterior cuando se intenta otra compra', async () => {
    respuestaConsulta = () =>
      cuerpo(200, { autenticado: true, balance: 10, objects: [] });

    render(<ShopPanel />);
    expect(await esperarSaldo('10 monedas')).toBeInTheDocument();

    respuestaCompra = () => cuerpo(409, { error: 'Saldo insuficiente' });
    await userEvent.click(comprarDisponible());
    expect(await screen.findByRole('alert')).toHaveTextContent('Saldo insuficiente');

    respuestaCompra = () =>
      cuerpo(200, { autenticado: true, balance: 0, objects: ['ceniza'] });
    await userEvent.click(comprarDisponible());

    expect(await screen.findByText('Comprado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no escribe en la pantalla si la consulta llega después de retirarse', async () => {
    respuestaConsulta = () => cuerpo(200, DENTRO_VACIO);

    const resolvers: Array<(respuesta: Response) => void> = [];
    vi.stubGlobal('fetch', () =>
      new Promise<Response>((resolve) => {
        resolvers.push(resolve);
      }),
    );

    const { unmount } = render(<ShopPanel />);
    unmount();

    expect(resolvers).toHaveLength(1);
    resolvers[0]?.(cuerpo(200, DENTRO_VACIO));

    await waitFor(() => expect(document.querySelector('[role="complementary"]')).toBeNull());
    expect(document.body.textContent).not.toContain('monedas');
  });
});
