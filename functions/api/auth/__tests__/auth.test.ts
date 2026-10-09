// @vitest-environment node

import type { DatabaseSync } from 'node:sqlite';

import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../../_lib/http';
import { onRequestPost as login } from '../login';
import { onRequestPost as register } from '../register';
import { onRequestPost as logout } from '../logout';
import { onRequestGet as sesion } from '../session';
import { contexto, cookieDe, get, post, testEnv, tokenDe } from '../../../__tests__/helpers/routes';

/**
 * Las rutas se prueban con el nucleo de cuentas de verdad por debajo, porque el
 * nucleo ya esta probado contra SQLite real. Aqui lo que se comprueba es el
 * cableado: que cookie ponen, que codigo de estado dan, que rechazan y que no
 * dejan pasar.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';

let env: { DB: D1Database };

beforeEach(() => {
  env = testEnv().env;
});

/** Cuenta filas de una tabla, para comprobar que un camino no ha escrito de mas. */
async function contar(sqlite: DatabaseSync, tabla: string): Promise<number> {
  const fila = sqlite.prepare(`SELECT count(*) AS total FROM ${tabla}`).get() as
    | { total: number }
    | undefined;
  return Number(fila?.['total'] ?? 0);
}

/**
 * Crea una cuenta y devuelve su cookie.
 *
 * El alta se hace por su propia ruta, no escribiendo en la base de datos a mano.
 * Asi las pruebas de acceso y de sesion parten del mismo sitio del que partiria
 * alguien de verdad, con el esquema, el nombre derivado del correo y la sesion ya
 * puestos por el mismo codigo que los pone en produccion.
 */
async function cuentaCreada(correo = CORREO, contrasena = CONTRASENA): Promise<string> {
  const alta = await register(
    contexto(post('/api/auth/register', { email: correo, password: contrasena }), env),
  );
  if (alta.status !== 201) {
    throw new Error(`el alta previa deberia haber funcionado, dio ${alta.status}`);
  }
  const token = tokenDe(alta);
  if (token === null || token === '') {
    throw new Error('el alta previa deberia haber puesto la cookie');
  }
  return `${SESSION_COOKIE}=${token}`;
}

describe('POST /api/auth/login', () => {
  it('inicia sesion y pone la cookie', async () => {
    await cuentaCreada();

    const respuesta = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ email: CORREO, displayName: 'alguien' });

    const cookie = cookieDe(respuesta);
    expect(cookie).not.toBeNull();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(`Path=/`);
  });

  it('no devuelve el token en el cuerpo de la respuesta', async () => {
    // El token viaja solo en la cabecera `Set-Cookie`. Si tambien estuviera en el
    // JSON, acabaria en cualquier registro del navegador o del proxy que guarde
    // respuestas, y la cookie HttpOnly habria servido de nada.
    await cuentaCreada();

    const respuesta = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    const cuerpo = await respuesta.text();

    expect(cuerpo).not.toContain(tokenDe(respuesta) ?? '');
    expect(cuerpo).not.toContain('token');
  });

  it('responde 401 con un mensaje generico si la contrasena no es la correcta', async () => {
    await cuentaCreada();

    const respuesta = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: 'la-equivocada' }), env),
    );

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({
      error: 'El correo o la contrasena no coinciden.',
    });
    // Y no pone cookie: un fallo no puede dejar una sesion puesta.
    expect(cookieDe(respuesta)).toBeNull();
  });

  it('responde exactamente lo mismo si el correo no existe', async () => {
    // La comparacion es entre las dos respuestas fallidas, no entre una fallida y
    // una buena: lo que no puede distinguirse es "no existe" de "la contrasena no
    // es esa".
    await cuentaCreada();

    const correcta = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    expect(correcta.status).toBe(200);

    const mala = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: 'no-es-la-contrasena' }), env),
    );
    const inexistente = await login(
      contexto(post('/api/auth/login', { email: 'nadie@example.com', password: CONTRASENA }), env),
    );

    expect(inexistente.status).toBe(mala.status);
    expect(await inexistente.json()).toEqual(await mala.json());
    expect(cookieDe(inexistente)).toBe(cookieDe(mala));
  });

  it('bloquea tras varios fallos y avisa de cuanto queda', async () => {
    await cuentaCreada();

    let ultimo: Response = await login(contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env));
    for (let intento = 0; intento < 6; intento += 1) {
      ultimo = await login(
        contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env),
      );
    }

    expect(ultimo.status).toBe(429);
    const cuerpo = (await ultimo.json()) as { error: string };
    expect(cuerpo.error).toMatch(/Demasiados intentos\. Prueba en \d+ min\./);
    expect(cookieDe(ultimo)).toBeNull();
  });

  it('no vuelve a hashear la contrasena mientras esta bloqueado', async () => {
    // Es el motivo de comprobar el bloqueo antes de la contrasena. Si se
    // comprobara despues, alguien bloqueado seguiria gastando CPU del servidor
    // probando contrasenas, que es justo lo que el bloqueo queria evitar.
    await cuentaCreada();
    for (let intento = 0; intento < 8; intento += 1) {
      await login(contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env),
      );
    }

    const conLaBuena = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );

    expect(conLaBuena.status).toBe(429);
  });

  it('desbloquea en cuanto un acceso va bien', async () => {
    await cuentaCreada();
    for (let intento = 0; intento < 4; intento += 1) {
      await login(contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env),
      );
    }

    const bueno = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    expect(bueno.status).toBe(200);

    // El contador se borro, asi que cinco fallos nuevos vuelven a bloquear pero no
    // antes: si no se borrara, este acceso ya habria desbloqueado.
    for (let intento = 0; intento < 4; intento += 1) {
      await login(contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env),
      );
    }
    const quinto = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: 'mal' }), env),
    );

    expect(quinto.status).toBe(401);
  });

  it('bloquea por separado cada par de direccion y correo', async () => {
    await cuentaCreada();
    for (let intento = 0; intento < 8; intento += 1) {
      await login(
        contexto(
          post('/api/auth/login', { email: CORREO, password: 'mal' }, { 'cf-connecting-ip': '198.51.100.1' }),
          env,
        ),
      );
    }

    const bloqueado = await login(
      contexto(
        post('/api/auth/login', { email: CORREO, password: CONTRASENA }, { 'cf-connecting-ip': '198.51.100.1' }),
        env,
      ),
    );
    const desdeOtra = await login(
      contexto(
        post('/api/auth/login', { email: CORREO, password: CONTRASENA }, { 'cf-connecting-ip': '203.0.113.99' }),
        env,
      ),
    );

    // Bloquear por direccion sola dejaria entrar desde cualquier otra, y bloquear
    // por correo solo permitiria tumbar la cuenta de otra desde cualquier maquina.
    expect(bloqueado.status).toBe(429);
    expect(desdeOtra.status).toBe(200);
  });

  it('funciona tambien si no llega la cabecera de la direccion', async () => {
    // Solo ocurre fuera de Cloudflare, pero tiene que ocurrir sin romper nada.
    // Si al no haber cabecera se cayera en una excepcion, la ruta no responderia;
    // y si se inventara una direccion distinta cada vez, nadie llegaria nunca al
    // bloqueo. Con la constante, todas las peticiones sin cabecera caen en el
    // mismo cubo, que es un limite mas duro, no mas flojo.
    await cuentaCreada();
    const peticion = post('/api/auth/login', { email: CORREO, password: CONTRASENA });
    peticion.headers.delete('cf-connecting-ip');

    const respuesta = await login(contexto(peticion, env));

    expect(respuesta.status).toBe(200);
    expect(cookieDe(respuesta)).toContain(`${SESSION_COOKIE}=`);
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const respuesta = await login(contexto(post('/api/auth/login', 'esto no es json', {}), env));

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: 'El cuerpo de la peticion no es valido.' });
  });

  it('rechaza una peticion de otra pagina', async () => {
    await cuentaCreada();

    const respuesta = await login(
      contexto(
        post('/api/auth/login', { email: CORREO, password: CONTRASENA }, { 'sec-fetch-site': 'cross-site' }),
        env,
      ),
    );

    expect(respuesta.status).toBe(403);
    expect(cookieDe(respuesta)).toBeNull();
  });

  it.each([
    ['sin correo', { password: CONTRASENA }],
    ['sin contrasena', { email: CORREO }],
    ['con correo que no es texto', { email: 42, password: CONTRASENA }],
    ['con contrasena que no es texto', { email: CORREO, password: ['a'] }],
    ['con cuerpo vacio', {}],
    ['con una contrasena demasiado corta', { email: CORREO, password: 'abc' }],
    ['con una contrasena demasiado larga', { email: CORREO, password: 'a'.repeat(500) }],
  ])('rechaza %s sin filtrar nada', async (_etiqueta, cuerpo) => {
    const respuesta = await login(contexto(post('/api/auth/login', cuerpo), env));

    // 401 y no 400, y con el mismo texto: son el mismo camino que una contrasena
    // equivocada. Si aqui se respondiera 400 con "falta el correo", un formulario
    // que reintenta automaticamente aprenderia que el campo va vacio.
    //
    // Las dos ultimas filas son las que mas cuidado necesitan. El alta si que
    // rechaza una contrasena corta con 400, porque ahi todavia no se ha mirado
    // ninguna cuenta. Aqui, en cambio, distinguir "tu contrasena es corta" de
    // "esa contrasena no es esa" daria una respuesta que el formulario no puede
    // dar, y para el caso de una contrasena correcta de ocho caracteres o menos
    // directamente no habria forma de entrar.
    expect(respuesta.status).toBe(401);
  });

  it('no crea filas nuevas al fallar', async () => {
    const { env: conSqlite, sqlite } = testEnv();
    // El alta va por su ruta: es la unica que escribe en `players`, y el acceso no
    // deberia crear nada ni siquiera al fallar.
    const creada = await register(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), conSqlite),
    );
    expect(creada.status).toBe(201);

    const antes = await contar(sqlite, 'players');
    for (let intento = 0; intento < 3; intento += 1) {
      await login(
        contexto(post('/api/auth/login', { email: 'nuevo@example.com', password: 'mal' }), conSqlite),
      );
    }

    // Tres intentos fallidos contra un correo que no existe no han creado una
    // cuenta vacia. El acceso no inserta jamas en `players`; solo lo hace el alta.
    expect(await contar(sqlite, 'players')).toBe(antes);
    // Y la sesion que hay es la del alta, ni una mas.
    expect(await contar(sqlite, 'sessions')).toBe(1);
  });
});

describe('GET /api/auth/session', () => {
  it('responde que no hay sesion con una peticion sin cookie', async () => {
    const respuesta = await sesion(contexto(get('/api/auth/session'), env));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ autenticado: false });
  });

  it('responde 200 y no 401 cuando no hay sesion', async () => {
    // La pregunta es "hay sesion?", no "puedes entrar?". Un 401 aqui lo trataria
    // cualquier cliente como un fallo, y en la interfaz se veria un error rojo en
    // una pantalla que funciona bien.
    const respuesta = await sesion(contexto(get('/api/auth/session'), env));

    expect(respuesta.status).toBe(200);
  });

  it('devuelve quien esta dentro con una cookie buena', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await sesion(contexto(get('/api/auth/session', { cookie }), env));

    expect(await respuesta.json()).toEqual({
      autenticado: true,
      email: CORREO,
      displayName: 'alguien',
    });
  });

  it('no devuelve el token ni el identificador del jugador', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    const cuerpo = await respuesta.text();

    expect(cuerpo).not.toContain('token');
    expect(cuerpo).not.toContain('playerId');
  });

  it('responde que no hay sesion con una cookie manipulada', async () => {
    const respuesta = await sesion(
      contexto(get('/api/auth/session', { cookie: `${SESSION_COOKIE}=inventado` }), env),
    );

    expect(await respuesta.json()).toEqual({ autenticado: false });
  });

  it('responde que no hay sesion con una cookie caducada', async () => {
    const cookie = await cuentaCreada();

    await env.DB.prepare('UPDATE sessions SET expires_at = ?').bind(Date.now() - 1).run();
    const respuesta = await sesion(contexto(get('/api/auth/session', { cookie }), env));

    expect(await respuesta.json()).toEqual({ autenticado: false });
  });

  it('no manda cabecera de cookie, porque no hay nada que cambiar', async () => {
    const respuesta = await sesion(contexto(get('/api/auth/session'), env));

    expect(cookieDe(respuesta)).toBeNull();
  });
});

describe('POST /api/auth/logout', () => {
  it('borra la fila de la sesion y la cookie', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await logout(contexto(post('/api/auth/logout', {}, { cookie }), env));

    expect(respuesta.status).toBe(204);
    expect(await respuesta.text()).toBe('');

    const cookieBorrada = cookieDe(respuesta);
    expect(cookieBorrada).toContain('Max-Age=0');
    expect(cookieBorrada).toContain('HttpOnly');
    expect(cookieBorrada).toContain('SameSite=Lax');

    // Y el token ya no sirve, que es lo que no se puede hacer borrando solo la
    // cookie del navegador.
    const despues = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    expect(await despues.json()).toEqual({ autenticado: false });
  });

  it('responde lo mismo sin cookie, para no filtrar que habia sesion', async () => {
    const respuesta = await logout(contexto(post('/api/auth/logout', {}), env));

    expect(respuesta.status).toBe(204);
    expect(cookieDe(respuesta)).toContain('Max-Age=0');
  });

  it('responde lo mismo con una cookie que no existe', async () => {
    const conCookie = await logout(
      contexto(post('/api/auth/logout', {}, { cookie: `${SESSION_COOKIE}=inventado` }), env),
    );

    expect(conCookie.status).toBe(204);
  });

  it('solo cierra la sesion que llega en la peticion', async () => {
    const primera = await cuentaCreada();
    const segundoAcceso = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    const segundo = `${SESSION_COOKIE}=${tokenDe(segundoAcceso)}`;

    await logout(contexto(post('/api/auth/logout', {}, { cookie: primera }), env));

    // Dos sesiones abiertas del mismo jugador: cerrar una no cierra la otra. Es lo
    // que permite entrar en el movil y en el ordenador sin que cerrar en uno
    // eche al otro.
    const sigue = await sesion(contexto(get('/api/auth/session', { cookie: segundo }), env));
    expect(await sigue.json()).toEqual({
      autenticado: true,
      email: CORREO,
      displayName: 'alguien',
    });
  });

  it('funciona tambien con GET, para el enlace de salir', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await logout(
      contexto(get('/api/auth/logout', { cookie }), env),
    );

    expect(respuesta.status).toBe(204);
    const despues = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    expect(await despues.json()).toEqual({ autenticado: false });
  });

  it('rechaza un POST de otra pagina', async () => {
    const cookie = await cuentaCreada();

    const respuesta = await logout(
      contexto(post('/api/auth/logout', {}, { cookie, 'sec-fetch-site': 'cross-site' }), env),
    );

    expect(respuesta.status).toBe(403);
    // Y no se ha cerrado la sesion: el rechazo tiene que ocurrir antes de borrar
    // nada, o el rechazo no serviria de nada.
    const despues = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    expect(await despues.json()).toMatchObject({ autenticado: true });
  });
});

describe('el camino completo', () => {
  it('alta, cierra sesion, vuelve a entrar y cierra otra vez', async () => {
    // La secuencia entera, no las piezas sueltas. Sirve para comprobar que lo que
    // cada ruta deja en la base de datos es lo que la siguiente espera encontrar.
    const alta = await register(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env),
    );
    expect(alta.status).toBe(201);
    const cookie = `${SESSION_COOKIE}=${tokenDe(alta)}`;

    const dentro = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    expect(await dentro.json()).toMatchObject({ autenticado: true });

    await logout(contexto(post('/api/auth/logout', {}, { cookie }), env));
    const fuera = await sesion(contexto(get('/api/auth/session', { cookie }), env));
    expect(await fuera.json()).toEqual({ autenticado: false });

    const otra = await login(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    expect(otra.status).toBe(200);
    expect(tokenDe(otra)).not.toBe(tokenDe(alta));
  });
});