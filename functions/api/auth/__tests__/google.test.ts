// @vitest-environment node

import type { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_COOKIE } from '../../../_lib/http';
import { toBase64Url, utf8Bytes } from '../../../_lib/bytes';
import { onRequestPost as alta } from '../register';
import { onRequestPost as google } from '../google';
import {
  TEST_GOOGLE_CLIENT_ID,
  contexto,
  cookieDe,
  post,
  testEnv,
  tokenDe,
} from '../../../__tests__/helpers/routes';

/**
 * La ruta del acceso con Google.
 *
 * La verificacion del token en si no se prueba aqui: esta probada en
 * `functions/_lib/__tests__/google.test.ts` con criptografia de verdad. Lo que
 * se comprueba en este archivo es el cableado de la ruta, y para eso el token
 * tambien es de verdad, firmado con un par de claves generado en la propia
 * prueba. La unica pieza que se sustituye es `fetch`, porque pedirle a Google
 * sus claves publicas es I/O y no cableado, y una prueba que depende de la red
 * es una prueba que no sabe si va a pasar.
 *
 * Ojo a la cache de claves: vive en el modulo de la ruta y por eso se comparte
 * entre todos los `it` de este archivo. Eso es deliberado y es ademas una de las
 * cosas que aqui se comprueba: mil accesos tienen que compartir un viaje.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';
const KID = 'kid-de-pruebas';

const par = (await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
)) as CryptoKeyPair;

/** Las peticiones a Google que se han hecho, para comprobar que se cachea. */
let pedidos: string[] = [];

let env: { DB: D1Database; PBKDF2_ITERATIONS: string; GOOGLE_CLIENT_ID: string };
let sqlite: DatabaseSync;

beforeEach(() => {
  pedidos = [];
  const creado = testEnv();
  env = creado.env;
  sqlite = creado.sqlite;
  vi.stubGlobal('fetch', async (input: string) => {
    pedidos.push(input);
    return juegoDeClaves();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** El juego de claves que Google devolveria, con la clave de la prueba dentro. */
async function juegoDeClaves(): Promise<Response> {
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  return new Response(
    JSON.stringify({ keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}

/**
 * Un identificador firmado con la clave de la prueba.
 *
 * Por defecto es correcto: `cambios` es lo que se le quita para provocar cada
 * fallo. `kid` se puede cambiar para pedir una clave que no esta publicada.
 */
async function identificador(
  cambios: Record<string, unknown> = {},
  kid = KID,
): Promise<string> {
  const cuerpo = {
    iss: 'https://accounts.google.com',
    aud: TEST_GOOGLE_CLIENT_ID,
    sub: 'sub-1',
    email: CORREO,
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 1800,
    ...cambios,
  };
  const pieza = (valor: unknown) => toBase64Url(utf8Bytes(JSON.stringify(valor)));
  const entrada = `${pieza({ alg: 'RS256', kid, typ: 'JWT' })}.${pieza(cuerpo)}`;
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    par.privateKey,
    utf8Bytes(entrada),
  );
  return `${entrada}.${toBase64Url(new Uint8Array(firma))}`;
}

/** Crea una cuenta con contrasena por su propia ruta y devuelve su cookie. */
async function cuentaCreada(correo = CORREO): Promise<string> {
  const creada = await alta(
    contexto(post('/api/auth/register', { email: correo, password: CONTRASENA }), env),
  );
  if (creada.status !== 201) {
    throw new Error(`el alta previa deberia haber funcionado, dio ${creada.status}`);
  }
  const token = tokenDe(creada);
  if (token === null || token === '') {
    throw new Error('el alta previa deberia haber puesto la cookie');
  }
  return `${SESSION_COOKIE}=${token}`;
}

/** Manda el identificador que se le pida. */
async function entrar(credential: string, cabeceras: Record<string, string> = {}) {
  return google(contexto(post('/api/auth/google', { credential }, cabeceras), env));
}

describe('POST /api/auth/google', () => {
  it('no deja pasar una peticion que viene de otra pagina', async () => {
    const respuesta = await google(
      contexto(
        post('/api/auth/google', {}, { 'sec-fetch-site': 'cross-site' }),
        env,
      ),
    );

    expect(respuesta.status).toBe(403);
  });

  it('responde 503 si el despliegue no tiene cliente de Google', async () => {
    // Se comprueba aqui y no solo en la interfaz porque la ruta se puede llamar a
    // mano: sin cliente no hay nada con que verificar, y eso es un problema del
    // servidor y no de quien manda la peticion.
    const sinCliente = [{ DB: env.DB }, { DB: env.DB, GOOGLE_CLIENT_ID: '' }];

    for (const entorno of sinCliente) {
      const respuesta = await google(
        contexto(post('/api/auth/google', { credential: 'cualquiera' }), entorno),
      );

      expect(respuesta.status).toBe(503);
      expect(await respuesta.json()).toEqual({
        error: 'El acceso con Google no esta configurado.',
      });
    }
  });

  it('responde 400 si el cuerpo no es JSON', async () => {
    const respuesta = await google(
      contexto(post('/api/auth/google', 'esto no es un objeto'), env),
    );

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({
      error: 'El cuerpo de la peticion no es valido.',
    });
  });

  it('responde 400 si falta el identificador o no es una cadena', async () => {
    for (const cuerpo of [{}, { credential: 7 }, { credential: null }]) {
      const respuesta = await google(contexto(post('/api/auth/google', cuerpo), env));

      expect(respuesta.status, JSON.stringify(cuerpo)).toBe(400);
      expect(await respuesta.json()).toEqual({
        error: 'Falta el identificador de Google.',
      });
    }
  });

  it('responde 401 con un mensaje generico si el token no se puede verificar', async () => {
    for (const credential of [
      'basura',
      'a.b.c',
      await identificador({ aud: 'otro-cliente.apps.googleusercontent.com' }),
      await identificador({}, 'kid-que-no-esta'),
    ]) {
      const respuesta = await entrar(credential);

      expect(respuesta.status).toBe(401);
      expect(await respuesta.json()).toEqual({
        error: 'No se ha podido verificar el identificador de Google.',
      });
      expect(cookieDe(respuesta)).toBeNull();
    }
  });

  it('explica cuando Google no ha confirmado el correo', async () => {
    const respuesta = await entrar(await identificador({ email_verified: false }));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({
      error: 'Google no ha confirmado la direccion de correo de esta cuenta.',
    });
  });

  it('responde 401 si el correo que trae Google no tiene forma', async () => {
    // Google no manda esto nunca: su correo ya viene verificado y con su arroba.
    // Se comprueba igual, porque es la segunda puerta de una sola de cuyas
    // piezas depende en que cuenta se acaba entrando, y una segunda puerta no
    // deberia dejar pasar algo que la primera dejo pasar por descuido.
    const respuesta = await entrar(await identificador({ email: 'sin-arroba' }));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({
      error: 'Google no ha devuelto una direccion de correo valida.',
    });
    expect(cookieDe(respuesta)).toBeNull();
  });

  it('crea la cuenta, pone la cookie y no devuelve el token en el cuerpo', async () => {
    const respuesta = await entrar(await identificador());

    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.text();
    expect(cuerpo).toContain(CORREO);
    expect(cuerpo).not.toContain('token');

    const cookie = cookieDe(respuesta);
    expect(cookie).not.toBeNull();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');

    const fila = sqlite.prepare('SELECT password_hash, google_subject FROM players').get() as
      | { password_hash: string | null; google_subject: string }
      | undefined;
    expect(fila?.['password_hash']).toBeNull();
    expect(fila?.['google_subject']).toBe('sub-1');
  });

  it('trae las claves de Google una sola vez para todos los accesos', async () => {
    // Con dos accesos seguidos. Si cada peticion trajera su propio juego de
    // claves, aqui habria dos viajes; con la cache, uno cuando mucho. El
    // `menor que dos` y no `igual a uno` es a proposito: si otra prueba del
    // archivo ha calentado la cache antes, este caso no vuelve a pedir nada, y
    // eso tambien es un exito.
    expect((await entrar(await identificador())).status).toBe(200);
    expect((await entrar(await identificador())).status).toBe(200);

    expect(pedidos.length).toBeLessThan(2);
  });

  it('responde 409 si el correo ya tiene una cuenta con contrasena', async () => {
    await cuentaCreada();

    const respuesta = await entrar(await identificador({ sub: 'sub-atrapa' }));

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({
      error:
        'Ya hay una cuenta con este correo y no se puede abrir con Google. Entra con tu contrasena.',
    });
    expect(cookieDe(respuesta)).toBeNull();
    const fila = sqlite.prepare('SELECT google_subject FROM players').get() as
      | { google_subject: string | null }
      | undefined;
    expect(fila?.['google_subject']).toBeNull();
  });

  it('enlaza Google cuando ya hay sesion con el mismo correo', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await entrar(await identificador(), { cookie });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ email: CORREO, displayName: 'alguien' });
    const fila = sqlite.prepare('SELECT google_subject FROM players').get() as
      | { google_subject: string }
      | undefined;
    expect(fila?.['google_subject']).toBe('sub-1');
  });

  it('no enlaza con la sesion de otra cuenta', async () => {
    const cookie = await cuentaCreada('otra@example.com');
    await cuentaCreada();

    const respuesta = await entrar(await identificador({ sub: 'sub-atrapa' }), { cookie });

    expect(respuesta.status).toBe(409);
    const fila = sqlite
      .prepare('SELECT google_subject FROM players WHERE email = ?')
      .get(CORREO) as { google_subject: string | null } | undefined;
    expect(fila?.['google_subject']).toBeNull();
  });

  it('no pone cookie de sesion en ningun fallo', async () => {
    // El token de Google solo sirve para abrir una sesion cuando todo ha ido
    // bien. Un 401 o un 409 dejan el navegador exactamente donde estaba.
    const fallos = [
      await entrar('basura'),
      await entrar(await identificador({ email_verified: false })),
      await entrar(await identificador({}, 'kid-que-no-esta')),
    ];

    for (const respuesta of fallos) {
      expect(respuesta.status).toBe(401);
      expect(respuesta.headers.get('set-cookie')).toBeNull();
    }
  });
});
