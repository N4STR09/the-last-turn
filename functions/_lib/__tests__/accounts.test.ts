// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  closeSession,
  createAccount,
  normalizeEmail,
  openSession,
  resolveSession,
  signIn,
  signInWithGoogle,
  validateCredentials,
  SESSION_REFRESH_DAYS,
  SESSION_TTL_DAYS,
} from '../accounts';
import type { Database, Row } from '../database';
import { hashPassword, MAX_PASSWORD_LENGTH, verifyPassword } from '../password';
import { countRows, freshDatabase, readCell } from '../../__tests__/helpers/sqlite-database';

/**
 * Las cuentas se prueban contra SQLite de verdad, con el archivo de migracion
 * aplicado. Una imitación de la base de datos obligaria a decidir, prueba por
 * prueba, que devuelve cada sentencia; aqui la sentencia se ejecuta y responde
 * lo que responderia en produccion, con sus `UNIQUE` y sus claves foraneas.
 */

const CORREO = 'alguien@example.com';
const CONTRASENA = 'una-contrasena-larga';

/**
 * Iteraciones para estas pruebas.
 *
 * Con las de produccion, cada alta y cada acceso cuesta unos 5 ms y el archivo
 * se acercaria al segundo. Con dos tardan microsegundos. Lo que se prueba aqui
 * es el SQL, el reparto de sesiones y los mensajes de error, ninguna de las
 * cuales depende del numero de iteraciones.
 *
 * Ojo a lo que si depende: `burnEquivalentTime` gasta lo que le digan. Si aqui se
 * pasara las de produccion, el gasto seria de otro tamano y la prueba de que el
 * gasto es el mismo no estaria midiendo lo que dice.
 */
const RAPIDAS = 2;

/** Un correo que no existe en una base de datos nueva. */
function nuevo(): Database {
  return freshDatabase();
}

/**
 * Una base que responde siempre la misma fila a la primera consulta.
 *
 * Solo se usa para los casos que SQLite no puede producir: el esquema pone `id`,
 * `email` y `display_name` a `NOT NULL`, asi que una base real nunca devuelve
 * una fila sin ellos y por eso los guardas de `signIn` y `resolveSession` no se
 * alcanzan alli. Son caminos que cierran la puerta, y lo que se comprueba aqui
 * es que cierran, no que el motor los pueda provocar.
 *
 * El resto de las pruebas van contra SQLite de verdad, que es donde esta lo
 * importante.
 */
function conPrimeraFila(fila: Row | null): Database {
  return {
    async first<RowType extends Row>(): Promise<RowType | null> {
      return fila as RowType | null;
    },
    async run(): Promise<void> {
      // Ninguno de los dos casos llega a escribir: ambos se salvan antes.
    },
    async all<RowType extends Row>(): Promise<RowType[]> {
      return [];
    },
  };
}

describe('normalizeEmail', () => {
  it('quita espacios y pasa a minusculas', () => {
    expect(normalizeEmail('  Alguien@Example.COM  ')).toBe('alguien@example.com');
  });

  it('deja intacto un correo ya normalizado', () => {
    expect(normalizeEmail(CORREO)).toBe(CORREO);
  });
});

describe('validateCredentials', () => {
  it('acepta un correo con forma', () => {
    const outcome = validateCredentials(CORREO, CONTRASENA);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.email).toBe(CORREO);
      // La contrasena se devuelve tal cual, sin recortar ni transformar. Recortar
      // una contrasena es cambiar lo que el usuario escribio, y si el hash se
      // hizo con una cosa y al entrar se comparase con otra, fallaria sin motivo.
      expect(outcome.value.password).toBe(CONTRASENA);
    }
  });

  it.each([
    ['vacio', ''],
    ['sin arroba', 'alguienexample.com'],
    ['que empieza por arroba', '@example.com'],
    ['que acaba en arroba', 'alguien@'],
    ['solo espacios', '   '],
  ])('rechaza un correo %s', (_etiqueta, correo) => {
    const outcome = validateCredentials(correo, CONTRASENA);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('correo');
    }
  });

  it('rechaza un correo mas largo que el maximo de la especificacion', () => {
    // 254 es el limite que lleva el RFC. Ahi caben las direcciones reales mas
    // largas; lo que no cabe es una cadena de mil caracteres, que ademas no
    // estaria en ningun sitio.
    const larguisimo = `${'a'.repeat(250)}@example.com`;

    expect(validateCredentials(larguisimo, CONTRASENA).ok).toBe(false);
  });

  it.each([
    ['vacia', ''],
    ['de un caracter', 'x'],
    ['de siete caracteres', 'abcdefg'],
  ])('rechaza una contrasena %s', (_etiqueta, contrasena) => {
    // Sin esto, el alta crearia una cuenta con cero caracteres de contrasena,
    // que es la contrasena que mas sitio ocupa en cualquier lista de contrasenas
    // conocidas. El correo esta bien, pero el par no.
    const outcome = validateCredentials(CORREO, contrasena);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('contrasena');
    }
  });

  it('acepta justo ocho caracteres, que es el minimo y no una pradera', () => {
    expect(validateCredentials(CORREO, 'abcdefgh').ok).toBe(true);
  });

  it('acepta una contrasena larga pero no una absurda', () => {
    // El maximo no es por seguridad sino por servicio: PBKDF2 lee la contrasena
    // entera en cada peticion, y sin tope un megabyte pasaria entero por la
    // derivacion cada vez que alguien intentara entrar.
    expect(validateCredentials(CORREO, 'a'.repeat(MAX_PASSWORD_LENGTH)).ok).toBe(true);
    expect(validateCredentials(CORREO, 'a'.repeat(MAX_PASSWORD_LENGTH + 1)).ok).toBe(false);
  });
});

describe('createAccount', () => {
  it('crea la fila y abre sesion', async () => {
    const database = nuevo();
    const outcome = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    expect(await countRows(database, 'players')).toBe(1);
    expect(await countRows(database, 'sessions')).toBe(1);
    expect(outcome.value.email).toBe(CORREO);
    // El nombre sale de lo que hay antes de la arroba. No es un nombre elegido
    // por el usuario: es algo legible para que la interfaz pueda saludar.
    expect(outcome.value.displayName).toBe('alguien');
    expect(outcome.value.playerId).not.toBe('');
    expect(outcome.value.token).not.toBe('');
  });

  it('guarda el hash y no la contrasena', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const stored = await readCell(database, 'SELECT password_hash FROM players');
    expect(typeof stored).toBe('string');
    expect(stored).not.toContain(CONTRASENA);
    // La fila debe poder verificarse con la contrasena original.
    expect(await verifyPassword(CONTRASENA, String(stored))).toBe(true);
  });

  it('deja el hash de Google a NULL, porque esta cuenta no ha entrado con Google', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    expect(await readCell(database, 'SELECT google_subject FROM players')).toBeNull();
  });

  it('no guarda el token en la tabla de sesiones, solo su resumen', async () => {
    const database = nuevo();
    const outcome = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!outcome.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const stored = await readCell(database, 'SELECT token_hash FROM sessions');
    expect(stored).not.toBe(outcome.value.token);
    // Y lo que hay es el resumen, que se puede comprobar.
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rechaza un correo que ya existe, con el mismo mensaje que una contrasena mala', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const repetido = await createAccount(database, CORREO, 'otra-contrasena', RAPIDAS);
    const accesoMalo = await signIn(database, CORREO, 'otra-contrasena', RAPIDAS);

    expect(repetido.ok).toBe(false);
    expect(accesoMalo.ok).toBe(false);
    if (!repetido.ok && !accesoMalo.ok) {
      // El mismo texto en los dos. Si difieren, el formulario de alta dice quien
      // esta registrado aqui.
      expect(repetido.error.message).toBe(accesoMalo.error.message);
      expect(repetido.error.code).toBe(accesoMalo.error.code);
    }
    // Y no se ha creado una segunda fila.
    expect(await countRows(database, 'players')).toBe(1);
  });

  it('trata como la misma cuenta un correo escrito con otra capitalizacion', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const otro = await createAccount(database, '  ALGUIEN@Example.com ', CONTRASENA, RAPIDAS);

    expect(otro.ok).toBe(false);
    expect(await countRows(database, 'players')).toBe(1);
  });

  it('no crea sesion cuando el alta falla', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    expect(await countRows(database, 'sessions')).toBe(1);
  });

  it('no llega a consultar la base si las credenciales no tienen forma', async () => {
    // El filtro de forma lo vuelve a hacer `createAccount`, no solo la ruta. Si
    // se confiara en que quien llama ya lo ha comprobado, cualquier otra entrada
    // futura al alta entraria con un correo vacio y la unicidad de la columna
    // decidiria si eso crea una cuenta o no.
    const database = nuevo();

    const outcome = await createAccount(database, 'no-es-un-correo', 'x', RAPIDAS);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('correo');
    }
    expect(await countRows(database, 'players')).toBe(0);
    expect(await countRows(database, 'sessions')).toBe(0);
  });

  it('no crea la cuenta con una contrasena que no llega al minimo', async () => {
    // Es el caso que el filtro de forma de la ruta y el del nucleo tienen que
    // cubrir entre los dos. Si solo lo cubriera la ruta, cualquier otra entrada a
    // `createAccount` crearia una cuenta con una contrasena de tres letras.
    const database = nuevo();

    const outcome = await createAccount(database, CORREO, 'abc', RAPIDAS);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('contrasena');
    }
    expect(await countRows(database, 'players')).toBe(0);
    expect(await countRows(database, 'sessions')).toBe(0);
  });
});

describe('signIn', () => {
  it('acepta la contrasena correcta', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const outcome = await signIn(database, CORREO, CONTRASENA, RAPIDAS);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.email).toBe(CORREO);
    }
  });

  it('acepta el correo escrito con espacios y mayusculas', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    await expect(signIn(database, ' Alguien@EXAMPLE.com ', CONTRASENA, RAPIDAS)).resolves.toMatchObject({
      ok: true,
    });
  });

  it('rechaza una contrasena incorrecta', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const outcome = await signIn(database, CORREO, 'la-contrasena-equivocada', RAPIDAS);

    expect(outcome.ok).toBe(false);
    expect(await countRows(database, 'sessions')).toBe(1);
  });

  it('da el mismo error para un correo inexistente que para una contrasena mala', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const inexistente = await signIn(database, 'nadie@example.com', CONTRASENA, RAPIDAS);
    const mala = await signIn(database, CORREO, 'no-es-la-contrasena', RAPIDAS);

    expect(inexistente.ok).toBe(false);
    expect(mala.ok).toBe(false);
    if (!inexistente.ok && !mala.ok) {
      // La misma respuesta para los dos casos. Distinguirlos convierte el
      // formulario de acceso en un servicio de "dime quien tiene cuenta".
      expect(inexistente.error).toEqual(mala.error);
    }
  });

  it('no abre sesion para una cuenta que solo es de Google', async () => {
    // Una cuenta creada con Google tiene `password_hash` a NULL. Cualquier
    // contrasena que se pruebe contra ella tiene que fallar por igual, que es lo
    // que hace el segundo `verifyPassword` de `signIn`: si no, el fallo seria
    // instantaneo y se distinguiria de una cuenta real por el tiempo.
    const database = nuevo();
    await database.run(
      `INSERT INTO players (id, email, display_name, password_hash, google_subject,
                             created_at, updated_at)
       VALUES ('google-1', 'g@example.com', 'g', NULL, 'sub-12345', 0, 0)`,
    );

    const outcome = await signIn(database, 'g@example.com', 'lo-que-sea', RAPIDAS);

    expect(outcome.ok).toBe(false);
    expect(await countRows(database, 'sessions')).toBe(0);
  });

  it('no deja pasar una cadena vacia donde va el correo', async () => {
    const database = nuevo();

    // Sin filtro de forma, un correo vacio llegaria a una consulta con la cadena
    // vacia. No crearia nada, pero cualquier cuenta con correo vacio, si la
    // hubiera, entraria con contrasena vacia.
    const outcome = await signIn(database, '', '', RAPIDAS);

    expect(outcome.ok).toBe(false);
    expect(await countRows(database, 'sessions')).toBe(0);
  });

  it('no abre sesion si la fila de jugador viene sin identidad', async () => {
    // El esquema pone `id` y `email` a `NOT NULL`, asi que esto no puede pasar
    // con una base bien formada. El guarda esta porque un `id` vacio abriria una
    // sesion que apunta a nadie, y eso es peor que no abrir ninguna.
    const hash = await hashPassword(CONTRASENA, RAPIDAS);
    const database = conPrimeraFila({
      id: null,
      email: null,
      display_name: null,
      password_hash: hash,
    });

    // La contrasena si que coincide: lo que falla es que no hay quien este
    // dentro, y tiene que fallar igual que cualquier otra.
    const outcome = await signIn(database, CORREO, CONTRASENA, RAPIDAS);

    expect(outcome.ok).toBe(false);
  });

  it('pone un nombre por defecto si la fila no trae display_name', async () => {
    // `display_name` es `NOT NULL` en el esquema, asi que esto no llega a pasar
    // con una base bien formada. El `??` esta porque `textColumn` devuelve
    // `string | null` sin poder saberlo, y lo que se comprueba es que cuando no
    // llega ninguno se inventa uno legible en vez de quedarse con una cadena
    // vacia, que haria que la interfaz dijera "hola, ".
    const hash = await hashPassword(CONTRASENA, RAPIDAS);
    const database = conPrimeraFila({
      id: 'jugador-1',
      email: CORREO,
      display_name: null,
      password_hash: hash,
    });

    const outcome = await signIn(database, CORREO, CONTRASENA, RAPIDAS);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.displayName).toBe('alguien');
    }
  });

  it('no llega a tocar la base con una contrasena demasiado larga', async () => {
    // La base lanza si se le consulta, asi que si esta prueba pasa es que no se ha
    // consultado. Comprobar el tope despues de la consulta valdria lo mismo a
    // primera vista, pero dejaria el tiempo como indicador: solo las contrasenas
    // cortas llegarian al `SELECT`, y midiendo se veria si hay cuenta ahi.
    const baseInconsultable: Database = {
      async first<RowType extends Row>(): Promise<RowType | null> {
        throw new Error('no deberia llegar a consultar la base');
      },
      async run(): Promise<void> {
        throw new Error('no deberia llegar a escribir en la base');
      },
      async all<RowType extends Row>(): Promise<RowType[]> {
        return [];
      },
    };

    const outcome = await signIn(baseInconsultable, CORREO, 'a'.repeat(5000), RAPIDAS);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      // El mismo mensaje que cualquier otra, porque sigue sin haber nada que
      // distinguir.
      expect(outcome.error.message).toBe('El correo o la contrasena no coinciden.');
    }
  });
});

describe('resolveSession', () => {
  it('devuelve quien esta dentro con un token bueno', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const session = await resolveSession(database, alta.value.token);

    expect(session).toEqual({
      playerId: alta.value.playerId,
      displayName: 'alguien',
      email: CORREO,
    });
  });

  it('no devuelve el token en el resultado', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    // El token sale una vez, en el `Set-Cookie` del alta. Volver a devolverlo en
    // cada consulta de sesion seria una via de filtrado que no hace falta: el
    // navegador ya lo tiene en la cookie.
    const session = await resolveSession(database, alta.value.token);

    expect(session).not.toHaveProperty('token');
  });

  it.each([
    ['sin token', null],
    ['token vacio', ''],
    ['token inventado', 'este-token-no-existe'],
  ])('devuelve null con %s', async (_etiqueta, token) => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    expect(await resolveSession(database, token)).toBeNull();
  });

  it('devuelve null con un token caducado', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    await database.run('UPDATE sessions SET expires_at = ?', [Date.now() - 1]);

    expect(await resolveSession(database, alta.value.token)).toBeNull();
  });

  it('devuelve null si la fila de jugador desaparecio', async () => {
    // No se puede dar con el `CASCADE` del esquema, asi que se desactiva la
    // comprobacion de claves foraneas para dejar una sesion apuntando a un
    // jugador que no existe. El `JOIN` tiene que dejar esa sesion fuera.
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    await database.run('PRAGMA foreign_keys = OFF');
    await database.run('DELETE FROM players');
    await database.run('PRAGMA foreign_keys = ON');

    expect(await resolveSession(database, alta.value.token)).toBeNull();
  });

  it('devuelve null si la sesion apunta a una fila sin jugador', async () => {
    // El `JOIN` de la consulta no dejaria pasar una sesion sin jugador, pero el
    // codigo no lo da por supuesto: si la fila llegara sin `playerId` o sin
    // correo, abrir sesion con un id vacio seria entrar en una cuenta que no es
    // de nadie. Se comprueba que devuelve `null` y no eso.
    const database = conPrimeraFila({
      playerId: null,
      expiresAt: Date.now() + 60_000,
      email: null,
      displayName: null,
    });

    expect(await resolveSession(database, 'un-token-cualquiera')).toBeNull();
  });

  it('pone un nombre por defecto si la fila no trae display_name', async () => {
    // Lo mismo que en `signIn`, aqui desde el `JOIN`: el nombre sale de la fila
    // de jugadores, que no admite NULL, pero si no llegara no hay por que
    // devolver un jugador sin nombre.
    const database = conPrimeraFila({
      playerId: 'jugador-1',
      expiresAt: Date.now() + 60_000,
      email: CORREO,
      displayName: null,
    });

    const sesion = await resolveSession(database, 'un-token-cualquiera');

    expect(sesion).not.toBeNull();
    expect(sesion?.displayName).toBe('alguien');
  });

  it('renueva la caducidad cuando le queda poco', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const antes = Date.now();
    // Se deja la sesion a punto de caducar: menos de lo que marca el umbral.
    await database.run('UPDATE sessions SET expires_at = ?', [
      antes + (SESSION_REFRESH_DAYS - 1) * 24 * 60 * 60 * 1000,
    ]);

    await resolveSession(database, alta.value.token);

    const despues = await readCell(database, 'SELECT expires_at FROM sessions');
    expect(Number(despues)).toBeGreaterThan(antes + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000 - 60_000);
  });

  it('no toca la caducidad cuando le queda de sobra', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    await resolveSession(database, alta.value.token);

    // La caducidad original era `ahora + 30 dias`; si se hubiera renovado tambien
    // seria `ahora + 30 dias`. Se comprueba que la diferencia con la marca de
    // creacion sea la de 30 dias y no mas.
    const [expires, created] = await Promise.all([
      readCell(database, 'SELECT expires_at FROM sessions'),
      readCell(database, 'SELECT created_at FROM sessions'),
    ]);

    expect(Number(expires) - Number(created)).toBe(SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  });

  it('actualiza last_seen_at, que es lo que dice "visto por ultima vez"', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    await database.run('UPDATE sessions SET last_seen_at = 0');
    await resolveSession(database, alta.value.token);

    expect(Number(await readCell(database, 'SELECT last_seen_at FROM sessions'))).toBeGreaterThan(0);
  });
});

describe('closeSession', () => {
  it('borra la fila y el token deja de servir', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    await closeSession(database, alta.value.token);

    expect(await countRows(database, 'sessions')).toBe(0);
    expect(await resolveSession(database, alta.value.token)).toBeNull();
  });

  it('no falla con un token que no existe', async () => {
    const database = nuevo();

    // Cerrar sesion con una cookie manipulada tiene que responder igual, no
    // fallar. Si aqui hubiera una excepcion, un atacante que mandara basura
    // distinguiria esa peticion de las demas.
    await expect(closeSession(database, 'token-que-no-existe')).resolves.toBeUndefined();
    await expect(closeSession(database, null)).resolves.toBeUndefined();
    await expect(closeSession(database, '')).resolves.toBeUndefined();
  });

  it('solo borra la sesion que se le da', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    const otro = await signIn(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok || !otro.ok) {
      throw new Error('las dos entradas deberian haber funcionado');
    }

    await closeSession(database, alta.value.token);

    expect(await resolveSession(database, otro.value.token)).not.toBeNull();
  });
});

describe('el tiempo que tarda un fallo', () => {
  it('gasta lo mismo con un correo inexistente que con una contrasena mala', async () => {
    // La prueba que vigila el reloj. Sin esto, el gasto de tiempo de
    // `burnEquivalentTime` podria desaparecer y ningun otro archivo lo detectaria:
    // el mensaje de error seria el mismo, el codigo de estado seria el mismo, y
    // solo se notaria midiendo, que es justo lo que casi nadie mide.
    //
    // El margen es el doble de la diferencia, no algo mas estrecho. En una
    // maquina con ruido las dos llamadas pueden tardar distinto por el sistema, y
    // una prueba que fallara por eso dejaria de ser util. Lo que tiene que detectar
    // es la diferencia de orden de magnitud que haria falta para enumerar cuentas
    // midiendo: si una tardara diez veces menos que la otra, esto falla.
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    const RONDAS = 12;
    const medir = async (objetivo: 'inexistente' | 'mala'): Promise<number> => {
      const principio = performance.now();
      for (let vuelta = 0; vuelta < RONDAS; vuelta += 1) {
        await (objetivo === 'inexistente'
          ? signIn(database, 'nadie@example.com', CONTRASENA, RAPIDAS)
          : signIn(database, CORREO, 'no-es-la-contrasena', RAPIDAS));
      }
      return performance.now() - principio;
    };

    // Se mide una vez de warming-up: la primera llamada paga el arranque de la
    // criptografia del proceso, y sin descartarla la comparacion mide eso.
    await medir('inexistente');

    const inexistente = await medir('inexistente');
    const mala = await medir('mala');

    const diferencia = Math.abs(inexistente - mala);
    expect(diferencia).toBeLessThan(Math.max(inexistente, mala) / 2);
  });

  it('si no le dicen cuantas iteraciones gasta, gasta las de produccion', async () => {
    // El parametro `iterations` de `signIn` es opcional para quien lo llama desde
    // fuera del modulo, y aqui se resuelve que hace cuando no lo pasa. Si la
    // respuesta fuera "no gasta nada", cualquier camino que se olvidara de
    // pasarlo dejaria el reloj al descubierto: el fallo responderia al instante
    // y midiendo se distinguiria un correo dado de alta de uno que no.
    //
    // Se compara la ruta sin iteraciones con la ruta rapida. Las de produccion
    // son 5 000 y las rapidas 2, una diferencia de miles de veces, asi que lo
    // unico que puede hacer que la primera no sea bastante mas lenta es que no
    // se hayan usado. El umbral es relativo para que no dependa de lo rapida que
    // sea la maquina; se suman varias vueltas y no se mide una sola llamada para
    // que el ruido del sistema no tenga el mismo peso.
    const database = nuevo();
    const VUELTAS = 5;

    const medir = async (iterations?: number): Promise<number> => {
      const principio = performance.now();
      for (let vuelta = 0; vuelta < VUELTAS; vuelta += 1) {
        await signIn(database, 'nadie@example.com', CONTRASENA, iterations);
      }
      return performance.now() - principio;
    };

    await medir(RAPIDAS);
    const produccion = await medir();
    const rapido = await medir(RAPIDAS);

    expect(produccion).toBeGreaterThan(rapido * 3);
  });
});

describe('openSession', () => {
  it('crea una sesion distinta cada vez que se llama', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const segunda = await openSession(database, {
      playerId: alta.value.playerId,
      email: CORREO,
      displayName: 'alguien',
    });

    expect(segunda.token).not.toBe(alta.value.token);
    expect(await countRows(database, 'sessions')).toBe(2);
  });

  it('cierra las sesiones del jugador al borrar la cuenta', async () => {
    // Es el `CASCADE` del esquema. Sin el, un token vivo apuntaria a un jugador
    // que no existe y habria que decidir que se responde en ese caso.
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);

    await database.run('DELETE FROM players');

    expect(await countRows(database, 'sessions')).toBe(0);
  });
});
describe('signInWithGoogle', () => {
  const IDENTIDAD = { subject: 'sub-1', email: 'nuevo@example.com' };

  it('crea una cuenta cuando el correo no existe', async () => {
    const database = nuevo();

    const outcome = await signInWithGoogle(database, IDENTIDAD, null);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.email).toBe('nuevo@example.com');
      // El nombre sale del correo igual que en un alta con contrasena: el `name`
      // de Google no se guarda, y la cuenta no se puede distinguir de una
      // escrita a mano mirando su fila.
      expect(outcome.value.displayName).toBe('nuevo');
      expect(outcome.value.token).not.toBe('');
    }
    expect(await countRows(database, 'players')).toBe(1);
    expect(await countRows(database, 'sessions')).toBe(1);
    // Lo que distingue una cuenta de solo Google en todo el esquema.
    expect(await readCell(database, 'SELECT password_hash FROM players')).toBeNull();
    expect(await readCell(database, 'SELECT google_subject FROM players')).toBe('sub-1');
  });

  it('abre la cuenta por el sujeto aunque el correo haya cambiado', async () => {
    const database = nuevo();
    const primera = await signInWithGoogle(database, IDENTIDAD, null);
    if (!primera.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const segunda = await signInWithGoogle(
      database,
      { subject: 'sub-1', email: 'otra-direccion@example.com' },
      null,
    );

    expect(segunda.ok).toBe(true);
    if (segunda.ok) {
      // El correo de la sesion sigue siendo el de la fila. Renombrarse la
      // direccion en Google no mueve la cuenta a ningun sitio ni la duplica.
      expect(segunda.value.playerId).toBe(primera.value.playerId);
      expect(segunda.value.email).toBe('nuevo@example.com');
    }
    expect(await countRows(database, 'players')).toBe(1);
  });

  it('rechaza un correo que no tiene forma', async () => {
    const database = nuevo();

    const outcome = await signInWithGoogle(
      database,
      { subject: 'sub-1', email: 'sin-arroba' },
      null,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('correo');
    }
    expect(await countRows(database, 'players')).toBe(0);
  });

  it('no enlaza un correo dado de alta con contrasena si no hay sesion', async () => {
    // El pre-hijack. El alta con contrasena no verifica correos, asi que esta
    // fila puede haberla escrito cualquiera con el correo de otra persona. Si
    // el token de Google bastara para enlazarla, la persona legitima entraria
    // despues por la cuenta de ese primera con la contrasena de ese primera.
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const outcome = await signInWithGoogle(
      database,
      { subject: 'sub-atrapa', email: CORREO },
      null,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('cuenta');
      expect(outcome.error.message).toMatch(/no se puede abrir con Google/i);
    }
    expect(await readCell(database, 'SELECT google_subject FROM players')).toBeNull();
    expect(await countRows(database, 'sessions')).toBe(1);
  });

  it('no enlaza cuando la sesion abierta es de otra cuenta', async () => {
    const database = nuevo();
    await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    const otra = await createAccount(database, 'otra@example.com', CONTRASENA, RAPIDAS);
    if (!otra.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    const outcome = await signInWithGoogle(
      database,
      { subject: 'sub-1', email: CORREO },
      otra.value.token,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('cuenta');
    }
    expect(
      await readCell(database, 'SELECT google_subject FROM players WHERE email = ?', [CORREO]),
    ).toBeNull();
  });

  it('enlaza el sujeto con la sesion abierta y el mismo correo', async () => {
    const database = nuevo();
    const alta = await createAccount(database, CORREO, CONTRASENA, RAPIDAS);
    if (!alta.ok) {
      throw new Error('el alta deberia haber funcionado');
    }

    // Google manda el correo tal cual lo tiene, con sus mayusculas y sus
    // espacios de siempre. Si aqui no se normalizara, esta persona no
    // encontraria su cuenta ni con la contrasena en la mano.
    const outcome = await signInWithGoogle(
      database,
      { subject: 'sub-1', email: '  Alguien@Example.COM ' },
      alta.value.token,
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.playerId).toBe(alta.value.playerId);
    }
    expect(await readCell(database, 'SELECT google_subject FROM players')).toBe('sub-1');
    expect(await countRows(database, 'players')).toBe(1);
  });

  it('cambia el sujeto enlazado cuando quien esta dentro enlaza otro', async () => {
    const database = nuevo();
    const primera = await signInWithGoogle(database, IDENTIDAD, null);
    if (!primera.ok) {
      throw new Error('el alta deberia haber funcionado');
    }
    // Una cuenta de solo Google no tiene contrasena con la que volver a entrar,
    // asi que la sesion es lo unico que puede abrirla otra vez. Se abre a mano
    // porque de eso se traba este caso.
    const sesion = await openSession(database, {
      playerId: primera.value.playerId,
      email: primera.value.email,
      displayName: primera.value.displayName,
    });

    const outcome = await signInWithGoogle(
      database,
      { subject: 'sub-2', email: IDENTIDAD.email },
      sesion.token,
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.playerId).toBe(primera.value.playerId);
    }
    // Quien llega hasta aqui tiene una sesion abierta en esa fila, o sea que es
    // suya, y cambiar el enlace de Google de una cuenta propia es una operacion
    // normal. Se prefiere eso a dejar el `sub` de una cuenta que ya no existe
    // ocupando el sitio para siempre.
    expect(await readCell(database, 'SELECT google_subject FROM players')).toBe('sub-2');
    expect(await countRows(database, 'players')).toBe(1);
  });

  it('cierra la puerta cuando la fila no trae identificador', async () => {
    // El esquema pone `id` a `NOT NULL`, asi que SQLite no puede producir esto.
    // El guardas esta porque `Row` no lo sabe: es un registro de texto y no una
    // fila tipada. Se comprueba que cierra, no que el motor lo pueda provocar.
    const outcome = await signInWithGoogle(conPrimeraFila({} as Row), IDENTIDAD, null);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('credenciales');
    }
  });

  it('cierra la puerta cuando la fila no trae nombre', async () => {
    const outcome = await signInWithGoogle(
      conPrimeraFila({ id: 'p1', email: CORREO } as Row),
      IDENTIDAD,
      null,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('credenciales');
    }
  });
});
