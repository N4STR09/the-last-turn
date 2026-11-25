import { afterEach, describe, expect, it, vi } from 'vitest';

import { achievementLabel, characterLabel, fetchUnlocks } from '../progression';

/**
 * La frontera de red de la colección, simulada en `fetch`.
 *
 * Mismo trato que `stats.test.ts`: lo que hay que probar aquí no es el
 * servidor —eso está probado en `functions/api/__tests__/unlocks.test.ts`
 * contra SQLite de verdad— sino lo que esta página promete cuando el servidor
 * no está: que nada de esto se cae, que un fallo se lee como «no hay nada que
 * enseñar» y que la cuenta sigue funcionando igual.
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

describe('fetchUnlocks', () => {
  it('lee la colección de una cuenta que está dentro', async () => {
    vi.stubGlobal('fetch', async () =>
      respuesta({
        autenticado: true,
        coins: 12,
        unlocks: ['explorador', 'insomne'],
        achievements: ['primera-partida'],
      }),
    );

    await expect(fetchUnlocks()).resolves.toEqual({
      coins: 12,
      unlocks: ['explorador', 'insomne'],
      achievements: ['primera-partida'],
    });
  });

  it('lee una cuenta que todavía no ha ganado nada', async () => {
    vi.stubGlobal('fetch', async () =>
      respuesta({ autenticado: true, coins: 0, unlocks: [], achievements: [] }),
    );

    await expect(fetchUnlocks()).resolves.toEqual({
      coins: 0,
      unlocks: [],
      achievements: [],
    });
  });

  it('no da colección cuando no hay sesión', async () => {
    vi.stubGlobal('fetch', async () => respuesta({ autenticado: false }));

    await expect(fetchUnlocks()).resolves.toBeNull();
  });

  it.each([
    ['una frase', 'esto no es un cuerpo'],
    ['nada', null],
    ['una lista', [1, 2, 3]],
  ])('no da colección cuando el servidor contesta %s', async (_nombre, cuerpo) => {
    vi.stubGlobal('fetch', async () => respuesta(cuerpo));

    await expect(fetchUnlocks()).resolves.toBeNull();
  });

  it.each(['12', 12.5, -1, undefined, true, null])(
    'no da colección cuando el saldo viene como %s',
    async (coins) => {
      vi.stubGlobal('fetch', async () =>
        respuesta({
          autenticado: true,
          coins,
          unlocks: [],
          achievements: [],
        }),
      );

      await expect(fetchUnlocks()).resolves.toBeNull();
    },
  );

  it.each<[string, Record<string, unknown>]>([
    ['falta', {}],
    ['no es una lista', { unlocks: 'explorador' }],
    ['trae números', { unlocks: ['explorador', 7] }],
    ['trae un objeto', { unlocks: [{ id: 'explorador' }] }],
  ])('no da colección si los personajes vienen mal: %s', async (_nombre, parcial) => {
    vi.stubGlobal('fetch', async () =>
      respuesta({
        autenticado: true,
        coins: 1,
        achievements: [],
        ...parcial,
      }),
    );

    await expect(fetchUnlocks()).resolves.toBeNull();
  });

  it('no da colección si los logros no son una lista de textos', async () => {
    vi.stubGlobal('fetch', async () =>
      respuesta({
        autenticado: true,
        coins: 1,
        unlocks: [],
        achievements: [false],
      }),
    );

    await expect(fetchUnlocks()).resolves.toBeNull();
  });

  it('no da colección cuando la red no está', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('sin red');
    });

    await expect(fetchUnlocks()).resolves.toBeNull();
  });

  it('no da colección cuando el cuerpo no se puede leer', async () => {
    vi.stubGlobal('fetch', async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('cuerpo roto');
        },
      }) as unknown as Response,
    );

    await expect(fetchUnlocks()).resolves.toBeNull();
  });
});

/**
 * El vocabulario de la colección.
 *
 * Los mapas viven en `progression.ts` porque pertenecen al id que manda el
 * servidor, no a la pantalla que lo pinta: aquí se comprueba lo único que
 * puede fallar, que un id conocido se traduzca y que uno desconocido se
 * enseñe tal cual en lugar de desaparecer.
 */
describe('el vocabulario de la colección', () => {
  it.each([
    ['explorador', 'Explorador'],
    ['veterano', 'Veterano'],
    ['insomne', 'Insomne'],
    ['huesped', 'Huésped'],
  ] as const)('traduce el personaje %s', (id, nombre) => {
    expect(characterLabel(id)).toBe(nombre);
  });

  it.each([
    ['primera-partida', 'Primera partida'],
    ['turno-50', '50 turnos'],
    ['turno-100', '100 turnos'],
    ['agonia-50', '50 turnos en Agonía'],
  ] as const)('traduce el logro %s', (id, nombre) => {
    expect(achievementLabel(id)).toBe(nombre);
  });

  it('enseña tal cual un personaje que todavía no conoce', () => {
    expect(characterLabel('futuro')).toBe('futuro');
  });

  it('enseña tal cual un logro que todavía no conoce', () => {
    expect(achievementLabel('logro-nuevo')).toBe('logro-nuevo');
  });
});
