// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '../../../_lib/http';
import { onRequestPost as alta } from '../register';
import { onRequestPost as acceso } from '../login';
import { contexto, cookieDe, post, testEnv, tokenDe } from '../../../__tests__/helpers/routes';

/**
 * El alta es la unica ruta que crea filas de jugador, asi que es la unica que
 * puede decir "ese correo ya existe". Y no lo dice, que es lo que se comprueba
 * aqui una y otra vez.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';

let env: { DB: D1Database };

beforeEach(() => {
  env = testEnv().env;
});

describe('POST /api/auth/register', () => {
  it('crea la cuenta e inicia sesion', async () => {
    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env),
    );

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({ email: CORREO, displayName: 'alguien' });

    // Y con la respuesta, quien se da de alta ya esta dentro. Mandarlo a la
    // pantalla de acceso un segundo despues seria pedirle que lo escriba otra vez.
    expect(cookieDe(respuesta)).toContain('HttpOnly');
    expect(cookieDe(respuesta)).toContain('SameSite=Lax');
  });

  it('deja entrar con esa cuenta acto seguido', async () => {
    await alta(contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env));

    const entrada = await acceso(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );

    expect(entrada.status).toBe(200);
    expect(cookieDe(entrada)).not.toBeNull();
  });

  it('no dice si el correo ya existe, y responde como un acceso fallido', async () => {
    await alta(contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env));

    const repetido = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env),
    );
    const accesoMalo = await acceso(
      contexto(post('/api/auth/login', { email: CORREO, password: 'no-es-la-contrasena' }), env),
    );

    expect(repetido.status).toBe(409);
    // El texto de los dos es identico. Un texto distinto en el alta, del tipo "ese
    // correo ya tiene cuenta", convierte este formulario en un servicio de "dime
    // quien esta registrado aqui".
    //
    // El cuerpo de una respuesta se lee una sola vez, asi que se lee el texto y se
    // comparan los dos como texto. Comparar los objetos ya leidos daria un error de
    // "cuerpo ya leido" en vez de un fallo de comparacion.
    const cuerpoRepetido = await repetido.text();
    const cuerpoAcceso = await accesoMalo.text();

    expect(cuerpoRepetido).toBe(cuerpoAcceso);
    expect(JSON.parse(cuerpoRepetido) as { error: string }).toEqual({
      error: 'El correo o la contrasena no coinciden.',
    });
    expect(cookieDe(repetido)).toBeNull();
  });

  it('no crea una segunda fila con el correo en otra capitalizacion', async () => {
    await alta(contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env));

    await alta(
      contexto(post('/api/auth/register', { email: ' ALGUIEN@Example.com ', password: CONTRASENA }), env),
    );

    // Con una base real, el `UNIQUE` del esquema lo impide; aqui lo que se
    // comprueba es que el nucleo lo pregunta antes de insertar, que es lo que
    // evita gastar un hash de 750 ms en un alta que va a fallar.
    const sesion = await acceso(
      contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env),
    );
    expect(sesion.status).toBe(200);
  });

  it.each([
    ['correo vacio', { email: '', password: CONTRASENA }],
    ['correo sin arroba', { email: 'alguienexample.com', password: CONTRASENA }],
    ['correo que empieza por arroba', { email: '@example.com', password: CONTRASENA }],
    ['correo que acaba en arroba', { email: 'alguien@', password: CONTRASENA }],
    ['correo larguisimo', { email: `${'a'.repeat(250)}@example.com`, password: CONTRASENA }],
  ])('rechaza un %s con 400, que es un fallo de forma y no de credenciales', async (_e, cuerpo) => {
    const respuesta = await alta(contexto(post('/api/auth/register', cuerpo), env));

    // Aqui si se distingue el formato de las credenciales, y se distingue bien:
    // un correo que no tiene forma no es un intento de acceso a nada, no se ha
    // comparado con ninguna cuenta y no hay nada que revelar.
    expect(respuesta.status).toBe(400);
    expect(cookieDe(respuesta)).toBeNull();
  });

  it.each([
    ['correo que no es una cadena', { email: 42, password: CONTRASENA }],
    ['contrasena que no es una cadena', { email: CORREO, password: { valor: CONTRASENA } }],
    ['los dos de tipos raros', { email: null, password: ['una'] }],
  ])('rechaza un %s con 400', async (_e, cuerpo) => {
    // El JSON puede venir bien formado y con tipos equivocados: `{"email": 42}`.
    // Si no se comprobara el tipo antes de tratarlo como texto, un correo que
    // fuera una lista o un objeto pasaria al validador como si fuera una cadena y
    // la respuesta dependeria de como lo imprimiera el motor.
    const respuesta = await alta(contexto(post('/api/auth/register', cuerpo), env));

    expect(respuesta.status).toBe(400);
    expect(cookieDe(respuesta)).toBeNull();
    expect(await respuesta.json()).toEqual({ error: expect.any(String) });
  });

  it.each([
    ['vacia', ''],
    ['de un caracter', 'x'],
    ['de siete caracteres', 'abcdefg'],
    ['demasiado larga', 'a'.repeat(201)],
  ])('rechaza una contrasena %s con 400', async (_e, contrasena) => {
    // Sin esta comprobacion el alta aceptaba la cadena vacia y creaba una cuenta
    // con cero caracteres de contrasena. Es un fallo de forma, no de
    // credenciales, y se responde 400: todavia no se ha comparado con nada.
    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: contrasena }), env),
    );

    expect(respuesta.status).toBe(400);
    expect(cookieDe(respuesta)).toBeNull();
    expect(await respuesta.json()).toEqual({ error: expect.any(String) });
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const respuesta = await alta(contexto(post('/api/auth/register', 'no es json'), env));

    expect(respuesta.status).toBe(400);
  });

  it('rechaza una peticion de otra pagina', async () => {
    const respuesta = await alta(
      contexto(
        post('/api/auth/register', { email: CORREO, password: CONTRASENA }, { 'sec-fetch-site': 'cross-site' }),
        env,
      ),
    );

    expect(respuesta.status).toBe(403);
  });

  it('no devuelve la contrasena ni su hash en el cuerpo', async () => {
    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env),
    );
    const cuerpo = await respuesta.text();

    expect(cuerpo).not.toContain(CONTRASENA);
    expect(cuerpo).not.toContain('hash');
    expect(cuerpo).not.toContain(tokenDe(respuesta) ?? '');
  });

  it('acepta una contrasena con caracteres que parecen operatores de SQL', async () => {
    // No hay escapado en ningun sitio porque no se arma ninguna sentencia con
    // valores: todo va como parametro. Esta prueba no lo demuestra del todo, pero
    // si dejara de ser cierto, la tabla `players` desapareceria y la llamada de
    // acceso siguiente fallaria, que es la forma de que el cambio se note.
    const contrasenaRara = `'; DROP TABLE players; -- con "comillas"`;

    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: contrasenaRara }), env),
    );

    expect(respuesta.status).toBe(201);
    const entrada = await acceso(
      contexto(post('/api/auth/login', { email: CORREO, password: contrasenaRara }), env),
    );
    expect(entrada.status).toBe(200);
  });

  it('acepta un correo con espacios alrededor y lo guarda limpio', async () => {
    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: '  Alguien@Example.COM  ', password: CONTRASENA }), env),
    );

    expect(respuesta.status).toBe(201);
    // Se guarda normalizado: es la unicidad de esa columna la que hace que dos
    // cuentas con distinta capitalizacion no sean dos cuentas.
    expect(await respuesta.json()).toEqual({ email: CORREO, displayName: 'alguien' });
  });

  it('crea una sesion por alta, y no mas', async () => {
    await alta(contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env));
    await alta(contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), env));

    // La segunda falla, asi que solo queda la sesion de la primera.
    const cookie = cookieDe(
      await acceso(contexto(post('/api/auth/login', { email: CORREO, password: CONTRASENA }), env)),
    );
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
  });

  it('sin configuracion de iteraciones, hashea con las de produccion', async () => {
    // Es el camino que correria de verdad: `wrangler.toml` no pone ninguna
    // variable, asi que el alta tiene que hashear con 5 000. Es la prueba de que
    // la configuracion, si no viene, no cambia el hasheo en silencio.
    const { env: sinConfiguracion } = testEnv();
    const entorno = sinConfiguracion as { DB: D1Database; PBKDF2_ITERATIONS?: string };
    delete entorno.PBKDF2_ITERATIONS;

    const respuesta = await alta(
      contexto(post('/api/auth/register', { email: CORREO, password: CONTRASENA }), entorno),
    );

    expect(respuesta.status).toBe(201);
    const fila = await entorno.DB.prepare('SELECT password_hash AS h FROM players').first<{ h: string }>();
    expect(fila?.h).toMatch(/^pbkdf2_sha256\$5000\$/);
  });
});
