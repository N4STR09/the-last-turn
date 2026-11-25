// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../_lib/http';
import { onRequestPost as compra } from '../shop';
import { onRequestGet as ver } from '../unlocks';
import { onRequestPost as registro } from '../auth/register';
import {
  contexto,
  get,
  post,
  testEnv,
  tokenDe,
} from '../../__tests__/helpers/routes';

/**
 * La ruta de compra, cableada contra un D1 simulado sobre SQLite de verdad.
 *
 * Lo que hay que comprobar aquí no es la fórmula del saldo, que ya se comprueba
 * en `_lib/unlocks.test.ts` contra la base real. Es el cableado: quién puede
 * comprar, con qué cuerpo, qué responde cada caso y —la parte que no se puede
 * ver con una petición cada vez— que dos compras a la vez no gastan dos veces
 * la misma moneda. La concurrencia se prueba con dos invocaciones del manejador
 * lanzadas juntas: las sentencias de SQLite son atómicas, así que el orden en
 * que se crucen no cambia el resultado, y por eso las aserciones miran el
 * conjunto y no quién llegó primero.
 *
 * Los mensajes se comprueban literal a propósito: son los que ve la persona en
 * pantalla, y todos tienen que llegar con sus tildes.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';

const SIN_SESION = 'Inicia sesión para comprar objetos.';
const OTRA_PAGINA = 'No se puede hacer esta petición desde aquí.';
const CUERPO_MALO = 'El cuerpo de la petición no es válido.';
const FUERA_DEL_CATALOGO = 'Ese objeto no está en la tienda.';
const SIN_SALDO =
  'No tienes saldo suficiente: necesitas 10 monedas y tienes 0.';

let env: { DB: D1Database };
let sqlite: ReturnType<typeof testEnv>['sqlite'];

beforeEach(() => {
  const fixture = testEnv();
  env = fixture.env;
  sqlite = fixture.sqlite;
});

/** Crea la cuenta y devuelve la cookie de su sesión. */
async function dentro(): Promise<string> {
  const respuesta = await registro(
    contexto(
      post('/api/auth/register', { email: CORREO, password: CONTRASENA }),
      env,
    ),
  );
  const token = tokenDe(respuesta);
  if (token === null) {
    throw new Error('El alta no ha puesto ninguna cookie de sesión.');
  }
  return `${SESSION_COOKIE}=${token}`;
}

/**
 * Pone `cantidad` monedas directamente en la cuenta creada.
 *
 * La tienda necesita un saldo que normalmente deja un informe, y aquí lo que se
 * prueba es la compra: la fórmula de monedas tiene sus propias pruebas en
 * `_lib`.
 */
function monedas(cantidad: number): void {
  const fila = sqlite.prepare('SELECT id FROM players LIMIT 1').get() as {
    id: string;
  };
  const valores = Array.from({ length: cantidad }, () => '(?, ?, ?, 1)').join(', ');
  const parametros = Array.from({ length: cantidad }, (_empty, index) => [
    fila.id,
    'moneda',
    `moneda-${index}`,
  ]).flat();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO player_unlocks (player_id, kind, id, obtained_at) VALUES ${valores}`,
    )
    .run(...parametros);
}

/** Cuenta de objetos comprados en la base, sin pasar por la ruta. */
function objetosEscritos(): number {
  const fila = sqlite
    .prepare("SELECT count(*) AS total FROM player_unlocks WHERE kind = 'objeto'")
    .get() as { total: number };
  return Number(fila.total);
}

function errorDe(respuesta: Response): Promise<unknown> {
  return respuesta
    .json()
    .then((payload) => (payload as { error?: unknown }).error);
}

describe('POST /api/shop/purchase', () => {
  it('sin sesión no se compra nada y el mensaje está acentuado', async () => {
    const respuesta = await compra(
      contexto(post('/api/shop/purchase', { objeto: 'ceniza' }), env),
    );

    expect(respuesta.status).toBe(401);
    await expect(errorDe(respuesta)).resolves.toBe(SIN_SESION);
    expect(objetosEscritos()).toBe(0);
  });

  it('otra página no puede comprar', async () => {
    const cookie = await dentro();
    const respuesta = await compra(
      contexto(
        post(
          '/api/shop/purchase',
          { objeto: 'ceniza' },
          { cookie, 'sec-fetch-site': 'cross-site' },
        ),
        env,
      ),
    );

    expect(respuesta.status).toBe(403);
    await expect(errorDe(respuesta)).resolves.toBe(OTRA_PAGINA);
    expect(objetosEscritos()).toBe(0);
  });

  it('un cuerpo que no es JSON no se puede leer', async () => {
    const cookie = await dentro();
    const respuesta = await compra(
      contexto(post('/api/shop/purchase', 'texto crudo', { cookie }), env),
    );

    expect(respuesta.status).toBe(400);
    await expect(errorDe(respuesta)).resolves.toBe(CUERPO_MALO);
  });

  it.each([null, 42, {}, { objeto: 10 }])(
    'un cuerpo %j no pide ningún objeto con nombre',
    async (cuerpo) => {
      const cookie = await dentro();
      const respuesta = await compra(
        contexto(post('/api/shop/purchase', cuerpo, { cookie }), env),
      );

      expect(respuesta.status).toBe(400);
      await expect(errorDe(respuesta)).resolves.toBe(CUERPO_MALO);
      expect(objetosEscritos()).toBe(0);
    },
  );

  it('un objeto fuera del catálogo ni toca la base', async () => {
    const cookie = await dentro();
    monedas(100);

    const respuesta = await compra(
      contexto(post('/api/shop/purchase', { objeto: 'inventado' }, { cookie }), env),
    );

    expect(respuesta.status).toBe(400);
    await expect(errorDe(respuesta)).resolves.toBe(FUERA_DEL_CATALOGO);
    expect(objetosEscritos()).toBe(0);
  });

  it('sin saldo no se compra y el mensaje trae las dos cifras', async () => {
    const cookie = await dentro();

    const respuesta = await compra(
      contexto(post('/api/shop/purchase', { objeto: 'ceniza' }, { cookie }), env),
    );

    expect(respuesta.status).toBe(409);
    await expect(errorDe(respuesta)).resolves.toBe(SIN_SALDO);
    expect(objetosEscritos()).toBe(0);
  });

  it('con saldo exacto se compra el objeto más caro', async () => {
    const cookie = await dentro();
    monedas(40);

    const respuesta = await compra(
      contexto(post('/api/shop/purchase', { objeto: 'nomada' }, { cookie }), env),
    );

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      autenticado: true,
      objeto: 'nomada',
      balance: 0,
      objects: ['nomada'],
    });
    expect(objetosEscritos()).toBe(1);
  });

  it('repetir la compra responde el mismo cuerpo y no descuenta dos veces', async () => {
    const cookie = await dentro();
    monedas(40);
    const peticion = () =>
      contexto(post('/api/shop/purchase', { objeto: 'nomada' }, { cookie }), env);

    const primera = await compra(peticion());
    const segunda = await compra(peticion());

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    await expect(segunda.json()).resolves.toEqual(await primera.json());
    expect(objetosEscritos()).toBe(1);

    const lectura = await ver(contexto(get('/api/unlocks', { cookie }), env));
    await expect(lectura.json()).resolves.toEqual({
      autenticado: true,
      coins: 40,
      unlocks: [],
      achievements: [],
      balance: 0,
      objects: ['nomada'],
    });
  });

  it('GET /api/unlocks devuelve el saldo restante y los objetos comprados', async () => {
    const cookie = await dentro();
    monedas(12);
    await compra(
      contexto(post('/api/shop/purchase', { objeto: 'ceniza' }, { cookie }), env),
    );

    const lectura = await ver(contexto(get('/api/unlocks', { cookie }), env));

    expect(lectura.status).toBe(200);
    await expect(lectura.json()).resolves.toEqual({
      autenticado: true,
      coins: 12,
      unlocks: [],
      achievements: [],
      balance: 2,
      objects: ['ceniza'],
    });
  });

  it('dos compras distintas a la vez con saldo para una solo escriben una fila', async () => {
    // El saldo es de 15: caben ceniza (10) o superviviente (15), no las dos.
    // Cada invocación hace la comprobación y la escritura en una sola
    // sentencia, así que la segunda ve ya el gasto de la primera sea cual sea
    // el orden en que se crucen, y una de las dos se queda fuera.
    const cookie = await dentro();
    monedas(15);

    const [una, otra] = await Promise.all([
      compra(contexto(post('/api/shop/purchase', { objeto: 'ceniza' }, { cookie }), env)),
      compra(
        contexto(post('/api/shop/purchase', { objeto: 'superviviente' }, { cookie }), env),
      ),
    ]);

    const estados = [una.status, otra.status].sort();
    expect(estados).toEqual([200, 409]);
    expect(objetosEscritos()).toBe(1);
  });

  it('dos peticiones del mismo objeto a la vez escriben una sola fila', async () => {
    const cookie = await dentro();
    monedas(10);

    const [una, otra] = await Promise.all([
      compra(contexto(post('/api/shop/purchase', { objeto: 'ceniza' }, { cookie }), env)),
      compra(contexto(post('/api/shop/purchase', { objeto: 'ceniza' }, { cookie }), env)),
    ]);

    expect(una.status).toBe(200);
    expect(otra.status).toBe(200);
    await expect(otra.json()).resolves.toEqual(await una.json());
    expect(objetosEscritos()).toBe(1);

    // Las diez monedas siguen ahí: el saldo no es una fila que se borre, es un
    // recuento menos una suma, y la compra solo añade la fila del objeto.
    const lectura = await ver(contexto(get('/api/unlocks', { cookie }), env));
    await expect(lectura.json()).resolves.toMatchObject({
      coins: 10,
      balance: 0,
      objects: ['ceniza'],
    });
  });
});
