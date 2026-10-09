// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../_lib/http';
import { onRequestGet as ver, onRequestPost as anotar } from '../stats';
import { onRequestPost as registro } from '../auth/register';
import {
  contexto,
  get,
  post,
  testEnv,
  tokenDe,
} from '../../__tests__/helpers/routes';

/**
 * La ruta de estadisticas, cableada contra un D1 simulado sobre SQLite de veras.
 *
 * Lo que hay que comprobar aqui no es el `MAX` de la suma, que ya se comprueba
 * en `_lib/stats.test.ts` contra la base real. Es el cableado: quien puede leer,
 * quien puede escribir, y que un cuerpo torpe no acaba en una fila.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';

let env: { DB: D1Database };

beforeEach(() => {
  env = testEnv().env;
});

/** Crea la cuenta y devuelve la cookie de su sesion. */
async function dentro(): Promise<string> {
  const respuesta = await registro(
    contexto(
      post('/api/auth/register', { email: CORREO, password: CONTRASENA }),
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
  return { turns: 12, level: 2, difficulty: 'normal', ...extra };
}

describe('GET /api/stats', () => {
  it('responde 200 sin nada que traer cuando no hay sesion', async () => {
    const respuesta = await ver(contexto(get('/api/stats'), env));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ autenticado: false });
  });

  it('responde lo mismo con una cookie inventada', async () => {
    const respuesta = await ver(
      contexto(get('/api/stats', { cookie: `${SESSION_COOKIE}=inventado` }), env),
    );

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ autenticado: false });
  });

  it('trae el cajon vacio de una cuenta que nunca ha jugado', async () => {
    const cookie = await dentro();

    const respuesta = await ver(contexto(get('/api/stats', { cookie }), env));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      bestTurns: null,
      gamesPlayed: 0,
      totalTurns: 0,
      hardestLevel: 0,
    });
  });

  it('trae lo que dejo una partida', async () => {
    const cookie = await dentro();
    await anotar(
      contexto(post('/api/stats', partida(), { cookie }), env),
    );

    const respuesta = await ver(contexto(get('/api/stats', { cookie }), env));

    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      bestTurns: 12,
      gamesPlayed: 1,
      totalTurns: 12,
      hardestLevel: 2,
    });
  });
});

describe('POST /api/stats', () => {
  it('anota la partida y devuelve el acumulado', async () => {
    const cookie = await dentro();

    const respuesta = await anotar(
      contexto(post('/api/stats', partida(), { cookie }), env),
    );

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      bestTurns: 12,
      gamesPlayed: 1,
      totalTurns: 12,
      hardestLevel: 2,
    });
  });

  it('no deja escribir sin sesion', async () => {
    const respuesta = await anotar(
      contexto(post('/api/stats', partida()), env),
    );

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toEqual({
      error: 'Inicia sesion para guardar tus estadisticas.',
    });
  });

  it('no acepta peticiones de otra pagina', async () => {
    const cookie = await dentro();

    const respuesta = await anotar(
      contexto(
        post('/api/stats', partida(), { cookie, 'sec-fetch-site': 'cross-site' }),
        env,
      ),
    );

    expect(respuesta.status).toBe(403);
    await expect(respuesta.json()).resolves.toEqual({
      error: 'No se puede hacer esta peticion desde aqui.',
    });
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const cookie = await dentro();

    const respuesta = await anotar(
      contexto(post('/api/stats', 'esto no es json', { cookie }), env),
    );

    expect(respuesta.status).toBe(400);
    await expect(respuesta.json()).resolves.toEqual({
      error: 'El cuerpo de la peticion no es valido.',
    });
  });

  it('rechaza un cuerpo con la forma equivocada sin tocar la base de datos', async () => {
    const cookie = await dentro();

    const respuesta = await anotar(
      contexto(post('/api/stats', partida({ turns: 'doce' }), { cookie }), env),
    );

    expect(respuesta.status).toBe(400);

    const despues = await ver(contexto(get('/api/stats', { cookie }), env));
    await expect(despues.json()).resolves.toEqual({
      autenticado: true,
      bestTurns: null,
      gamesPlayed: 0,
      totalTurns: 0,
      hardestLevel: 0,
    });
  });

  it('suma dos partidas de la misma cuenta', async () => {
    const cookie = await dentro();
    await anotar(contexto(post('/api/stats', partida(), { cookie }), env));

    const respuesta = await anotar(
      contexto(post('/api/stats', partida({ turns: 5, level: 1 }), { cookie }), env),
    );

    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      bestTurns: 12,
      gamesPlayed: 2,
      totalTurns: 17,
      hardestLevel: 2,
    });
  });
});
