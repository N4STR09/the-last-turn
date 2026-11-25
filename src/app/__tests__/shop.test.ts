import { afterEach, describe, expect, it, vi } from 'vitest';

import { SHOP_ITEMS, fetchShopState, purchaseObject } from '../shop';

/**
 * La frontera de red de la tienda, simulada en `fetch`.
 *
 * Mismo trato que `progression.test.ts`: lo que hay que probar aquí no es el
 * servidor —eso está probado en `functions/api/__tests__/shop.test.ts` contra
 * SQLite de verdad— sino lo que este módulo promete cuando el servidor no
 * está: que nada de esto se cae, que cada fallo se traduce a un resultado que
 * la interfaz sabe pintar y que la compra manda solo un identificador.
 */

/** Una respuesta con cuerpo, de las que `fetch` devuelve. */
function respuesta(cuerpo: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => cuerpo,
  } as unknown as Response;
}

/** La llamada que `fetch` recibió, para poder mirar dentro. */
function ultimaLlamada(): { url: string; init: RequestInit | undefined } {
  const mock = vi.mocked(fetch);
  const llamada = mock.mock.calls.at(-1);
  expect(llamada).toBeDefined();
  return { url: llamada?.[0] as string, init: llamada?.[1] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SHOP_ITEMS', () => {
  it('enseña el catálogo cerrado, en orden y con precios enteros', () => {
    expect(SHOP_ITEMS.map((item) => item.id)).toEqual([
      'ceniza',
      'superviviente',
      'ambar',
      'oxido',
      'calavera-doble',
      'nomada',
    ]);
    expect(SHOP_ITEMS.every((item) => Number.isInteger(item.precio) && item.precio > 0)).toBe(
      true,
    );
  });

  it('nombra cada objeto con las tildes con las que se enseña', () => {
    const nombres = SHOP_ITEMS.map((item) => item.nombre);
    expect(nombres).toContain('Ámbar');
    expect(nombres).toContain('Óxido');
    expect(nombres).toContain('Nómada');
  });
});

describe('fetchShopState', () => {
  it('lee el saldo y los objetos de una cuenta que está dentro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ autenticado: true, balance: 25, objects: ['ceniza'] }),
    ));

    await expect(fetchShopState()).resolves.toEqual({
      kind: 'dentro',
      balance: 25,
      objects: ['ceniza'],
    });
    expect(ultimaLlamada().url).toBe('/api/unlocks');
  });

  it('lee una cuenta que todavía no tiene nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ autenticado: true, balance: 0, objects: [] }),
    ));

    await expect(fetchShopState()).resolves.toEqual({
      kind: 'dentro',
      balance: 0,
      objects: [],
    });
  });

  it('no es un fallo cuando no hay sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ autenticado: false })));

    await expect(fetchShopState()).resolves.toEqual({ kind: 'fuera' });
  });

  it.each([
    ['una frase', 'esto no es un cuerpo'],
    ['nada', null],
    ['una lista', [1, 2, 3]],
  ])('es error cuando el servidor contesta %s', async (_nombre, cuerpo) => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(cuerpo)));

    await expect(fetchShopState()).resolves.toEqual({ kind: 'error' });
  });

  it.each(['25', 25.5, -1, undefined, true, null])(
    'es error cuando el saldo viene como %s',
    async (balance) => {
      vi.stubGlobal('fetch', vi.fn(async () =>
        respuesta({ autenticado: true, balance, objects: [] }),
      ));

      await expect(fetchShopState()).resolves.toEqual({ kind: 'error' });
    },
  );

  it.each<[string, Record<string, unknown>]>([
    ['falta', {}],
    ['no es una lista', { objects: 'ceniza' }],
    ['trae números', { objects: [7] }],
    ['trae un objeto', { objects: [{ id: 'ceniza' }] }],
  ])('es error si los objetos vienen mal: %s', async (_nombre, parcial) => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ autenticado: true, balance: 1, ...parcial }),
    ));

    await expect(fetchShopState()).resolves.toEqual({ kind: 'error' });
  });

  it('es error cuando la red no está', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('sin red');
    }));

    await expect(fetchShopState()).resolves.toEqual({ kind: 'error' });
  });

  it('es error cuando el cuerpo no se puede leer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('cuerpo roto');
        },
      }) as unknown as Response,
    ));

    await expect(fetchShopState()).resolves.toEqual({ kind: 'error' });
  });
});

describe('purchaseObject', () => {
  it('manda solo el identificador, en POST y con el tipo correcto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ autenticado: true, balance: 15, objects: ['ceniza'] }),
    ));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: true,
      balance: 15,
      objects: ['ceniza'],
    });

    const llamada = ultimaLlamada();
    expect(llamada.url).toBe('/api/shop/purchase');
    expect(llamada.init?.method).toBe('POST');
    expect(llamada.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(llamada.init?.body).toBe(JSON.stringify({ objeto: 'ceniza' }));
  });

  it('devuelve el saldo de la compra cuando todo va bien', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ autenticado: true, balance: 0, objects: ['ceniza', 'ambar'] }),
    ));

    await expect(purchaseObject('ambar')).resolves.toEqual({
      ok: true,
      balance: 0,
      objects: ['ceniza', 'ambar'],
    });
  });

  it('enseña el mensaje del servidor cuando la compra se rechaza', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuesta({ error: 'Saldo insuficiente: necesitas 15 monedas' }, false, 409),
    ));

    await expect(purchaseObject('superviviente')).resolves.toEqual({
      ok: false,
      message: 'Saldo insuficiente: necesitas 15 monedas',
    });
  });

  it('usa el mensaje propio cuando el rechazo no trae ninguno', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({}, false, 400)));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });

  it('usa el mensaje propio cuando el rechazo trae uno que no sirve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ error: 7 }, false, 500)));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });

  it('usa el mensaje propio cuando el rechazo trae un cuerpo roto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('cuerpo roto');
        },
      }) as unknown as Response,
    ));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });

  it('no da el saldo cuando el 2xx trae un cuerpo que no se entiende', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ autenticado: false })));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });

  it('no da el saldo cuando el 2xx trae un cuerpo roto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('cuerpo roto');
        },
      }) as unknown as Response,
    ));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });

  it('no se cae cuando la red no está', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('sin red');
    }));

    await expect(purchaseObject('ceniza')).resolves.toEqual({
      ok: false,
      message: 'No se ha podido completar la compra. Inténtalo otra vez.',
    });
  });
});
