import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchStats, reportGame } from '../stats';

/**
 * La frontera de red de las estadísticas, simulada en `fetch`.
 *
 * Lo que hay que probar aquí no es el servidor —eso ya está probado contra
 * SQLite de verdad en `functions/`— sino el comportamiento que la página
 * promete cuando el servidor no está: que nada de esto se cae, que un fallo se
 * lee como "no hay marca" y que la partida se sigue jugando.
 */

/** Una respuesta con cuerpo, de las que `fetch` devuelve. */
function respuesta(cuerpo: unknown, ok = true): Response {
  return {
    ok,
    json: async () => cuerpo,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchStats', () => {
  it('lee la marca de una cuenta que está dentro', async () => {
    vi.stubGlobal('fetch', async () =>
      respuesta({ autenticado: true, bestTurns: 47, gamesPlayed: 6 }),
    );

    await expect(fetchStats()).resolves.toEqual({ bestTurns: 47 });
  });

  it('lee una cuenta que todavía no tiene marca', async () => {
    vi.stubGlobal('fetch', async () =>
      respuesta({ autenticado: true, bestTurns: null, gamesPlayed: 0 }),
    );

    await expect(fetchStats()).resolves.toEqual({ bestTurns: null });
  });

  it('no da marca cuando no hay sesión', async () => {
    vi.stubGlobal('fetch', async () => respuesta({ autenticado: false }));

    await expect(fetchStats()).resolves.toBeNull();
  });

  it.each([
    ['una frase', 'esto no es un cuerpo'],
    ['nada', null],
    ['una lista', [1, 2, 3]],
  ])('no da marca cuando el servidor contesta %s', async (_nombre, cuerpo) => {
    vi.stubGlobal('fetch', async () => respuesta(cuerpo));

    await expect(fetchStats()).resolves.toBeNull();
  });

  it.each(['cuarenta y siete', 47.5, -3, undefined, true])(
    'no da marca cuando el récord viene como %s',
    async (bestTurns) => {
      vi.stubGlobal('fetch', async () =>
        respuesta({ autenticado: true, bestTurns }),
      );

      await expect(fetchStats()).resolves.toBeNull();
    },
  );

  it('no da marca cuando la red no está', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('sin red');
    });

    await expect(fetchStats()).resolves.toBeNull();
  });

  it('no da marca cuando el cuerpo no se puede leer', async () => {
    vi.stubGlobal('fetch', async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('cuerpo roto');
        },
      }) as unknown as Response,
    );

    await expect(fetchStats()).resolves.toBeNull();
  });
});

describe('reportGame', () => {
  it('manda la partida y devuelve verdadero cuando el servidor la cuenta', async () => {
    let mandado: unknown;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      mandado = { url, init };
      return respuesta({ autenticado: true });
    });

    await expect(
      reportGame({ turns: 12, level: 2, difficulty: 'agony' }),
    ).resolves.toBe(true);

    expect(mandado).toEqual({
      url: '/api/stats',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turns: 12, level: 2, difficulty: 'agony' }),
      },
    });
  });

  it('devuelve falso cuando el servidor no la cuenta', async () => {
    vi.stubGlobal('fetch', async () => respuesta({}, false));

    await expect(reportGame({ turns: 1, level: 0, difficulty: 'normal' })).resolves.toBe(
      false,
    );
  });

  it('devuelve falso cuando la red no está', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('sin red');
    });

    await expect(reportGame({ turns: 1, level: 0, difficulty: 'normal' })).resolves.toBe(
      false,
    );
  });
});
