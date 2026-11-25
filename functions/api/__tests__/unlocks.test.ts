// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../_lib/http';
import { onRequestGet as ver } from '../unlocks';
import { onRequestPost as anotar } from '../stats';
import { onRequestPost as registro } from '../auth/register';
import {
  contexto,
  get,
  post,
  testEnv,
  tokenDe,
} from '../../__tests__/helpers/routes';

/**
 * La ruta de la coleccion, cableada contra un D1 simulado sobre SQLite de veras.
 *
 * Lo que hay que comprobar aqui no es la formula de monedas, que ya se
 * comprueba en `_lib/unlocks.test.ts` contra la base real. Es el cableado:
 * que sin sesion no se lee nada, que lo que deja una partida es lo que trae
 * esta ruta, y que repetir un informe no cambia la respuesta.
 */

const CORREO = 'alguien@example.com';
const OTRO_CORREO = 'otra@example.com';
const CONTRASENA = 'una-contrasena-larga';

let env: { DB: D1Database };

beforeEach(() => {
  env = testEnv().env;
});

/** Crea la cuenta y devuelve la cookie de su sesion. */
async function dentro(correo: string = CORREO): Promise<string> {
  const respuesta = await registro(
    contexto(
      post('/api/auth/register', { email: correo, password: CONTRASENA }),
      env,
    ),
  );
  const token = tokenDe(respuesta);
  if (token === null) {
    throw new Error('El alta no ha puesto ninguna cookie de sesion.');
  }
  return `${SESSION_COOKIE}=${token}`;
}

/** Una partida bien escrita, para no repetirla en cada prueba. */
function partida(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { turns: 12, level: 2, difficulty: 'normal', seed: 4242, ...extra };
}

describe('GET /api/unlocks', () => {
  it('responde 200 con la cuenta ausente cuando no hay sesion', async () => {
    const respuesta = await ver(contexto(get('/api/unlocks'), env));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ autenticado: false });
  });

  it('responde igual con una cookie inventada', async () => {
    const respuesta = await ver(
      contexto(get('/api/unlocks', { cookie: `${SESSION_COOKIE}=inventado` }), env),
    );

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ autenticado: false });
  });

  it('trae la coleccion vacia de una cuenta que nunca ha jugado', async () => {
    const cookie = await dentro();

    const respuesta = await ver(contexto(get('/api/unlocks', { cookie }), env));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      coins: 0,
      unlocks: [],
      achievements: [],
      balance: 0,
      objects: [],
    });
  });

  it('trae lo que dejo una partida', async () => {
    const cookie = await dentro();
    await anotar(contexto(post('/api/stats', partida(), { cookie }), env));

    const respuesta = await ver(contexto(get('/api/unlocks', { cookie }), env));

    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      coins: 2,
      unlocks: ['explorador'],
      achievements: ['primera-partida'],
      balance: 2,
      objects: [],
    });
  });

  it('vuelve a responder lo mismo si el mismo informe llega dos veces', async () => {
    // El cliente reintenta y la respuesta se pierde. Si el duplicado
    // otorgara monedas, la coleccion creceria entre dos cargas de la misma
    // pantalla y nadie sabria por que.
    const cookie = await dentro();
    await anotar(contexto(post('/api/stats', partida(), { cookie }), env));
    await anotar(contexto(post('/api/stats', partida(), { cookie }), env));

    const respuesta = await ver(contexto(get('/api/unlocks', { cookie }), env));

    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      coins: 2,
      unlocks: ['explorador'],
      achievements: ['primera-partida'],
      balance: 2,
      objects: [],
    });
  });

  it('cada cuenta trae su propia coleccion', async () => {
    // La misma partida de dos cuentas no se mezcla: quien no ha jugado sigue
    // con la coleccion vacia aunque otro la haya llenado.
    const cookie = await dentro();
    await anotar(contexto(post('/api/stats', partida(), { cookie }), env));
    const otra = await dentro(OTRO_CORREO);

    const respuesta = await ver(contexto(get('/api/unlocks', { cookie: otra }), env));

    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      coins: 0,
      unlocks: [],
      achievements: [],
      balance: 0,
      objects: [],
    });
  });

  it('sin sesion no se otorga nada', async () => {
    // La coleccion solo se puede llenar por una partida anotada, y anotar
    // exige sesion. El recuento de filas es la comprobacion de verdad: la
    // respuesta 401 podria mentir sobre lo que escribio.
    const { env: entorno, sqlite } = testEnv();

    const respuesta = await anotar(contexto(post('/api/stats', partida()), entorno));

    expect(respuesta.status).toBe(401);
    const filas = sqlite
      .prepare('SELECT count(*) AS total FROM player_unlocks')
      .get() as { total: number };
    expect(filas.total).toBe(0);
  });
});
