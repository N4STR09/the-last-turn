// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fromBase64Url, toBase64Url, utf8Bytes } from '../bytes';
import {
  GOOGLE_JWKS_URL,
  createGoogleKeySource,
  googleTokenMessage,
  verifyGoogleIdToken,
  type GoogleJwksFetcher,
  type GoogleKeySource,
} from '../google';

/**
 * Verificacion con criptografia de verdad.
 *
 * No se simula ninguna firma: el archivo genera un par de claves RSA con
 * `crypto.subtle`, firma con la privada y verifica con la publica, que es
 * exactamente el recorrido que hace un identificador de Google. Falsificar la
 * firma aqui seria probar que un doble de mentira se parece a si mismo.
 *
 * El unico punto que se sustituye es la peticion a Google, que es I/O y no
 * criptografia: `createGoogleKeySource` acepta quien hace la peticion, y las
 * pruebas le devuelven un `Response` con el juego de claves dentro.
 */

const KID = 'kid-de-pruebas';
const AUDIENCIA = 'cliente.apps.googleusercontent.com';

/**
 * El reloj de estas pruebas, en milisegundos.
 *
 * Esta fijo para que `exp` se pueda escribir con respecto a el y para que la
 * caducidad de la cache se pueda comprobar sin esperar. No es la hora de
 * verdad: ninguna de estas pruebas depende de que lo sea.
 */
const AHORA = 1_760_000_000_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function codificar(texto: string): string {
  return toBase64Url(utf8Bytes(texto));
}

function pieza(valor: unknown): string {
  return codificar(JSON.stringify(valor));
}

/** Un identificador firmado con nuestra clave privada. */
async function firmar(header: unknown, cuerpo: unknown): Promise<string> {
  const entrada = `${pieza(header)}.${pieza(cuerpo)}`;
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    par.privateKey,
    utf8Bytes(entrada),
  );
  return `${entrada}.${toBase64Url(new Uint8Array(firma))}`;
}

/** Un identificador con la cabecera normal y el cuerpo que se le pida. */
async function firmado(cuerpo: unknown): Promise<string> {
  return firmar({ alg: 'RS256', kid: KID, typ: 'JWT' }, cuerpo);
}

/** El cuerpo de un identificador correcto, con lo que se le quiera cambiar. */
function cuerpo(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: AUDIENCIA,
    sub: '111222333',
    email: 'alguien@example.com',
    email_verified: true,
    iat: Math.floor(AHORA / 1000) - 60,
    exp: Math.floor(AHORA / 1000) + 1800,
    ...cambios,
  };
}

/** La respuesta que hace de Google: el juego de claves con nuestra `kid`. */
async function juegoDeClaves(cabecera: string | null = 'public, max-age=3600'): Promise<Response> {
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  const encabezados: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (cabecera !== null) {
    encabezados['cache-control'] = cabecera;
  }
  return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] }), {
    headers: encabezados,
  });
}

/** Una fuente de claves que siempre responde con la de arriba. */
function fuente(cabecera: string | null = 'public, max-age=3600'): GoogleKeySource {
  return createGoogleKeySource(() => juegoDeClaves(cabecera));
}

/** Un `fetch` que responde lo que se le pida, contando las llamadas. */
function conRespuesta(
  responder: () => Promise<Response>,
): { fetcher: GoogleJwksFetcher; llamadas: () => number } {
  let total = 0;
  return {
    fetcher: async () => {
      total += 1;
      return responder();
    },
    llamadas: () => total,
  };
}

describe('verifyGoogleIdToken', () => {
  it('acepta un identificador firmado por Google para este cliente', async () => {
    const token = await firmado(cuerpo());

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.identity).toEqual({
        subject: '111222333',
        email: 'alguien@example.com',
      });
    }
  });

  it('acepta los dos emisores que usa Google', async () => {
    for (const iss of ['https://accounts.google.com', 'accounts.google.com']) {
      const token = await firmado(cuerpo({ iss }));

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado.ok, iss).toBe(true);
    }
  });

  it('rechaza una firma alterada', async () => {
    const token = await firmado(cuerpo());
    const corte = token.lastIndexOf('.');
    const firma = fromBase64Url(token.slice(corte + 1));
    firma[0] = (firma[0] ?? 0) ^ 0xff;
    const roto = `${token.slice(0, corte + 1)}${toBase64Url(firma)}`;

    const resultado = await verifyGoogleIdToken(roto, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'firma' });
  });

  it('rechaza un algoritmo que no es RS256', async () => {
    // La confusion de algoritmos: con `HS256` la "clave" con la que se verifica
    // seria la publica, que cualquiera lee. Ninguna firma se llega a comprobar.
    const token = await firmar({ alg: 'HS256', kid: KID }, cuerpo());

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'estructura' });
  });

  it('rechaza una cabecera sin `kid` o con un `kid` que no dice nada', async () => {
    for (const header of [
      { alg: 'RS256' },
      { alg: 'RS256', kid: '' },
      { alg: 'RS256', kid: 7 },
    ]) {
      const token = await firmar(header, cuerpo());

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado, JSON.stringify(header)).toEqual({ ok: false, failure: 'estructura' });
    }
  });

  it('rechaza una cabecera que no es un objeto', async () => {
    const token = `${pieza(42)}.${pieza(cuerpo())}.aa`;

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'estructura' });
  });

  it('rechaza una estructura que no son tres piezas', async () => {
    for (const candidato of [
      'no-es-un-jwt',
      '.b.c',
      'a..c',
      'a.b',
      'a.b.c.d',
      'a.b.',
      `${pieza({ alg: 'RS256', kid: KID })}.${pieza(cuerpo())}.!!!!`,
    ]) {
      const resultado = await verifyGoogleIdToken(candidato, AUDIENCIA, fuente(), AHORA);

      expect(resultado, candidato.slice(0, 12)).toEqual({ ok: false, failure: 'estructura' });
    }
  });

  it('rechaza un `kid` que Google no publica', async () => {
    const token = await firmar({ alg: 'RS256', kid: 'otro' }, cuerpo());

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'firma' });
  });

  it.each([
    ['un numero', '42'],
    ['un nulo', 'null'],
    ['una lista', '[1, 2]'],
    ['una frase', 'esto no es json'],
  ])('rechaza un cuerpo que no es un objeto: %s', async (_etiqueta, texto) => {
    const token = await firmar({ alg: 'RS256', kid: KID }, codificar(texto));

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'estructura' });
  });

  it('rechaza un emisor que no es Google', async () => {
    const token = await firmado(cuerpo({ iss: 'https://otro.example.com' }));

    const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

    expect(resultado).toEqual({ ok: false, failure: 'origen' });
  });

  it('rechaza una audiencia que no es esta', async () => {
    for (const aud of ['otro-cliente.apps.googleusercontent.com', 7, undefined]) {
      const token = await firmado(cuerpo({ aud }));

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado, String(aud)).toEqual({ ok: false, failure: 'audiencia' });
    }
  });

  it('rechaza un identificador caducado o sin caducidad', async () => {
    for (const exp of [Math.floor(AHORA / 1000) - 1, undefined]) {
      const token = await firmado(cuerpo({ exp }));

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado, String(exp)).toEqual({ ok: false, failure: 'caducado' });
    }
  });

  it('rechaza un correo que Google no ha confirmado', async () => {
    for (const cambios of [
      { email_verified: false },
      { email_verified: 'true' },
      { email: undefined },
      { email: '' },
    ]) {
      const token = await firmado(cuerpo(cambios));

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado, JSON.stringify(cambios)).toEqual({ ok: false, failure: 'correo' });
    }
  });

  it('rechaza un identificador sin sujeto', async () => {
    for (const sub of [undefined, '']) {
      const token = await firmado(cuerpo({ sub }));

      const resultado = await verifyGoogleIdToken(token, AUDIENCIA, fuente(), AHORA);

      expect(resultado).toEqual({ ok: false, failure: 'estructura' });
    }
  });
});

describe('googleTokenMessage', () => {
  it('distingue lo que se arregla reintentando de lo que no', () => {
    expect(googleTokenMessage('caducado')).toMatch(/caducado/i);
    expect(googleTokenMessage('correo')).toMatch(/confirmado la direccion/i);
  });

  it('dice lo mismo de todos los fallos de verificacion', () => {
    // Estructura, firma, origen y audiencia: cuatro razones internas y un solo
    // texto, porque los cuatro significan "este token no vale aqui".
    for (const failure of ['estructura', 'firma', 'origen', 'audiencia'] as const) {
      expect(googleTokenMessage(failure)).toBe(
        'No se ha podido verificar el identificador de Google.',
      );
    }
  });
});

describe('createGoogleKeySource', () => {
  it('trae las claves una vez y las reutiliza', async () => {
    const { fetcher, llamadas } = conRespuesta(() => juegoDeClaves());
    const source = createGoogleKeySource(fetcher);

    expect(await source.key(KID)).not.toBeNull();
    expect(await source.key(KID)).not.toBeNull();

    expect(llamadas()).toBe(1);
  });

  it('devuelve `null` para un `kid` que no esta publicada', async () => {
    const source = fuente();

    expect(await source.key('otro')).toBeNull();
  });

  it('no lanza cuando la peticion a Google falla', async () => {
    const source = createGoogleKeySource(async () => {
      throw new Error('sin red');
    });

    expect(await source.key(KID)).toBeNull();
  });

  it('no guarda nada cuando Google responde con un error', async () => {
    const source = createGoogleKeySource(
      async () => new Response('no encontrado', { status: 404 }),
    );

    expect(await source.key(KID)).toBeNull();
  });

  it('no guarda nada cuando el cuerpo no es un juego de claves', async () => {
    for (const texto of ['"hola"', 'null', '{"otra_cosa": []}', '{"keys": {}}']) {
      const source = createGoogleKeySource(
        async () => new Response(texto, { headers: { 'content-type': 'application/json' } }),
      );

      expect(await source.key(KID), texto).toBeNull();
    }
  });

  it.each([
    ['una cadena', ['hola']],
    ['un nulo', [null]],
    ['una entrada sin `kid`', [{ kty: 'RSA', n: 'AA', e: 'AQAB' }]],
    ['una entrada con `kid` vacio', [{ kid: '', kty: 'RSA', n: 'AA', e: 'AQAB' }]],
    ['una entrada que no es RSA', [{ kid: 'x', kty: 'oct', n: 'AA', e: 'AQAB' }]],
    ['una entrada sin `n`', [{ kid: 'x', kty: 'RSA', e: 'AQAB' }]],
    ['una entrada sin `e`', [{ kid: 'x', kty: 'RSA', n: 'AA' }]],
    [
      'una clave que no se puede importar',
      [{ kid: 'x', kty: 'RSA', n: 'no-es-base64url!', e: 'AQAB' }],
    ],
  ])('ignora %s en el juego de claves', async (_etiqueta, entradas) => {
    const source = createGoogleKeySource(
      async () => new Response(JSON.stringify({ keys: entradas }), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(await source.key(KID)).toBeNull();
  });

  it('vuelve a pedir las claves cuando se le acaba el tiempo', async () => {
    const ahora = vi.spyOn(Date, 'now').mockReturnValue(0);
    const { fetcher, llamadas } = conRespuesta(() => juegoDeClaves('max-age=7200'));
    const source = createGoogleKeySource(fetcher);

    await source.key(KID);
    ahora.mockReturnValue(7_199_999);
    await source.key(KID);
    expect(llamadas()).toBe(1);

    ahora.mockReturnValue(7_200_000);
    await source.key(KID);
    expect(llamadas()).toBe(2);
  });

  it('guarda las claves durante el tiempo que dice Google, siempre acotado', async () => {
    const casos: ReadonlyArray<readonly [string, string | null, number]> = [
      ['sin cabecera de cache', null, 3_600_000],
      ['con una cabecera sin max-age', 'no-cache', 3_600_000],
      ['con un max-age que no es un numero', 'public, max-age=abc', 3_600_000],
      ['con un max-age bajo el suelo', 'max-age=1', 300_000],
      ['con un max-age sobre el techo', 'max-age=999999999', 86_400_000],
      ['con un max-age normal', 'public, max-age=7200', 7_200_000],
    ];

    for (const [etiqueta, cabecera, esperado] of casos) {
      const ahora = vi.spyOn(Date, 'now').mockReturnValue(0);
      const { fetcher, llamadas } = conRespuesta(() => juegoDeClaves(cabecera));
      const source = createGoogleKeySource(fetcher);

      await source.key(KID);
      ahora.mockReturnValue(esperado - 1);
      await source.key(KID);
      expect(llamadas(), etiqueta).toBe(1);

      ahora.mockReturnValue(esperado);
      await source.key(KID);
      expect(llamadas(), etiqueta).toBe(2);
      ahora.mockRestore();
    }
  });

  it('usa el `fetch` del entorno si no le dan con que responder', async () => {
    const pedidos: string[] = [];
    vi.stubGlobal('fetch', async (input: string) => {
      pedidos.push(input);
      return juegoDeClaves();
    });

    const source = createGoogleKeySource();

    expect(await source.key(KID)).not.toBeNull();
    expect(pedidos).toEqual([GOOGLE_JWKS_URL]);
  });

  it('espera un rato tras un fallo en vez de probar en cada peticion', async () => {
    const ahora = vi.spyOn(Date, 'now').mockReturnValue(0);
    const { fetcher, llamadas } = conRespuesta(async () => {
      throw new Error('sin red');
    });
    const source = createGoogleKeySource(fetcher);

    await source.key(KID);
    ahora.mockReturnValue(29_999);
    await source.key(KID);
    expect(llamadas()).toBe(1);

    ahora.mockReturnValue(30_000);
    await source.key(KID);
    expect(llamadas()).toBe(2);
  });
});
