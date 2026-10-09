/**
 * El nucleo de las cuentas, sin HTTP.
 *
 * Todo lo que hay aqui son funciones puras que reciben la base de datos. Nada
 * aqui sabe que existe una peticion HTTP ni una cookie, y por eso se puede
 * probar entero sin levantar un servidor ni fingir que existe un navegador.
 * Las rutas de `functions/api/` solo hacen tres cosas: leer el cuerpo, llamar
 * aqui, y poner la cookie.
 *
 * **La regla que atraviesa todo este archivo: los errores de inicio de sesion no
 * distinguen cuentas.** "Ese correo no existe" y "la contrasena no es esa" son
 * el mismo mensaje con el mismo codigo y el mismo tiempo, siempre. Distinguirlos
 * convierte el formulario de alta en una lista de correos validos, y esa
 * informacion la puede sacar cualquiera que conozca el correo de otra persona.
 */

import { randomId, randomToken, sha256Hex } from './digest';
import { integerColumn, textColumn, type Database, type Row } from './database';
import type { GoogleIdentity } from './google';
import { hashPassword, ITERATIONS, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, verifyPassword } from './password';

/** Cuanto vive una sesion: 30 dias. */
export const SESSION_TTL_DAYS = 30;

/** Una sesion empieza a renovarse cuando le queda esto poco: 15 dias. */
export const SESSION_REFRESH_DAYS = 15;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Lo que sale de una operacion de cuenta. */
export type AccountOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccountError };

/** Por que se ha rechazado una operacion. El texto es lo que ve quien juega. */
export type AccountErrorCode =
  | 'campos'
  | 'correo'
  | 'contrasena'
  | 'credenciales'
  | 'bloqueado'
  | 'sesion'
  /**
   * El correo ya tiene cuenta y esa cuenta no deja entrar por este camino.
   *
   * Solo lo devuelve el acceso con Google, y distingue de `credenciales` porque
   * el codigo va a ser 409 y no 401: no es una credencial que no cuadra, es que
   * hay una cuenta ahi que este metodo no puede abrir.
   */
  | 'cuenta';

/** Un fallo, con su codigo y su mensaje en castellano. */
export interface AccountError {
  readonly code: AccountErrorCode;
  readonly message: string;
}

function failure(code: AccountErrorCode, message: string): { ok: false; error: AccountError } {
  return { ok: false, error: { code, message } };
}

function succeed<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/**
 * Quien esta dentro.
 *
 * Es lo que se puede poner en una respuesta JSON sin miedo: no lleva el token.
 * El token solo existe en el tipo de abajo, que sale una unica vez por sesion.
 */
export interface SignedInPlayer {
  readonly playerId: string;
  readonly displayName: string;
  readonly email: string;
}

/**
 * Lo que se devuelve al terminar de crear una sesion.
 *
 * El token sale aqui y sale una sola vez. Desde este punto vive en la cookie y
 * lo que se guarda en la base de datos es su resumen, asi que quien lea las
 * tablas no puede construir una cookie.
 *
 * Que el token viva en un tipo que solo se crea en un sitio, en vez de ser un
 * campo mas de todos, es lo que hace que no se pueda colar en un cuerpo de
 * respuesta por descuido: quien tiene `{ playerId, email }` no puede tener token.
 */
export interface SessionGrant extends SignedInPlayer {
  readonly token: string;
  readonly expiresAt: number;
}

/** Normaliza un correo para poder compararlo con otro. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Valida los campos de un alta.
 *
 * Se llama desde `createAccount`, que es el unico sitio donde se crea una
 * cuenta, y otra vez desde la ruta del alta para poder responder 400 antes de
 * tocar la base.
 *
 * El correo solo se comprueba que tenga forma. Comprobar que existe exigiria
 * mandar un correo y esperar una respuesta, que es otra cosa entera, y que no
 * es lo que se esta haciendo.
 *
 * La contrasena se comprueba por su longitud, y esa comprobacion es la que
 * separa un alta de un acceso. Aqui se rechaza; en `signIn` no, porque `signIn`
 * no valida nada y responde siempre 401, que es lo que hace que saber que una
 * contrasena es corta no sirva para averiguar si hay una cuenta ahi.
 *
 * Sin esta comprobacion el alta aceptaba cualquier cosa, incluida la cadena
 * vacia: se creaba una cuenta cuya contrasena era cero caracteres, que ademas
 * es la contrasena que mas sitio ocupa en cualquier lista. Y el maximo tampoco
 * lo era: un megabyte de contrasena pasaria entero por PBKDF2 en cada peticion,
 * que es justo lo que el maximo existe para evitar.
 */
export function validateCredentials(
  email: string,
  password: string,
): AccountOutcome<{ readonly email: string; readonly password: string }> {
  const trimmed = email.trim();
  if (!hasEmailShape(trimmed)) {
    return failure('correo', 'El correo no parece una direccion valida.');
  }
  if (trimmed.length > 254) {
    return failure('correo', 'El correo es demasiado largo.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return failure('contrasena', 'La contrasena es demasiado corta.');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return failure('contrasena', 'La contrasena es demasiado larga.');
  }
  return succeed({ email: normalizeEmail(trimmed), password });
}

/**
 * Da forma a un correo: algo delante de la arroba, algo detras, y la arroba sin
 * tocar los extremos. Recibe el correo ya recortado.
 *
 * Es la misma comprobacion que hacia `validateCredentials`, sacada a una
 * funcion porque el acceso con Google necesita preguntar lo mismo sin arrastrar
 * la comprobacion de la contrasena, que alla no tiene por que existir.
 */
function hasEmailShape(email: string): boolean {
  return (
    email !== '' &&
    email.includes('@') &&
    !email.startsWith('@') &&
    !email.endsWith('@')
  );
}

/**
 * Crea una cuenta con correo y contrasena.
 *
 * No acepta un correo que ya esta dado de alta, y el mensaje es el mismo que si
 * la contrasena estuviera mal en un acceso. Quien se equivoca al escribir el
 * correo no recibe un "ya existe" que le confirma que esa direccion tiene cuenta.
 */
export async function createAccount(
  database: Database,
  email: string,
  password: string,
  iterations?: number,
): Promise<AccountOutcome<SessionGrant>> {
  // `iterations` solo lo pasan las pruebas, con un numero bajo, para que
  // hashear no cueste 750 ms por llamada. En produccion no se pasa y vale lo que
  // vale {@link ITERATIONS}. No es un parametro que quede abierto a proposito: ver
  // el mismo comentario en `signIn`.
  const validated = validateCredentials(email, password);
  if (!validated.ok) {
    return validated;
  }

  const existing = await database.first(
    'SELECT id FROM players WHERE email = ?',
    [validated.value.email],
  );
  if (existing !== null) {
    // El mismo mensaje que un acceso fallido, y no uno propio. Un texto distinto
    // del que sale al intentar entrar convertiria este formulario en un servicio
    // de "dime quien esta registrado aqui", que es justo lo que se queria evitar.
    return denied();
  }

  const passwordHash = await hashPassword(password, iterations);
  const playerId = randomId();
  const now = Date.now();
  const displayName = defaultDisplayName(validated.value.email);

  await database.run(
    `INSERT INTO players
       (id, email, display_name, password_hash, google_subject, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [playerId, validated.value.email, displayName, passwordHash, now, now],
  );

  return succeed(
    await openSession(database, {
      playerId,
      email: validated.value.email,
      displayName,
    }),
  );
}

/**
 * Abre sesion con correo y contrasena.
 *
 * El camino de una cuenta que no existe se parece al de una contrasena
 * incorrecta, y a proposito. Un atacante necesita las dos cosas: saber que el
 * correo esta dado de alta y acertar la contrasena. Devolver un error distinto
 * para el primer caso regala el primer dato. Por eso el fallo se responde
 * siempre con el mismo mensaje y el mismo codigo.
 */
export async function signIn(
  database: Database,
  email: string,
  password: string,
  iterations?: number,
): Promise<AccountOutcome<SessionGrant>> {
  // `iterations` solo lo pasan las pruebas, por lo que explica `createAccount`. En
  // acceso no tiene el mismo efecto que alli, y conviene decirlo: cuando el
  // acceso va bien, las iteraciones que se usan son las que tiene guardadas la
  // fila, no las de este parametro. Solo se usa para el gasto de tiempo de los
  // caminos que no llegan a comparar con un hash real.

  // El tope de longitud tambien aqui, y antes de tocar la base. El alta ya lo
  // comprueba, pero en acceso se puede mandar cualquier cadena, y PBKDF2 lee la
  // contrasena entera en cada intento: diez megabytes pasarian por la derivacion
  // en un camino que ademas no puede acertar nunca, porque en la fila solo hay
  // contrasenas de como mucho 200 caracteres.
  //
  // Se comprueba antes de la consulta y no despues por el mismo motivo que el
  // resto de los caminos: si el tope se mirara solo cuando la cuenta existe, el
  // tiempo diria si hay cuenta ahi. Asi, la respuesta y el gasto son los mismos
  // con correo existente y sin el, que es lo unico que tiene que ser cierto.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return denied();
  }

  const normalized = normalizeEmail(email);
  const player = await database.first(
    'SELECT id, email, display_name, password_hash FROM players WHERE email = ?',
    [normalized],
  );

  if (player === null) {
    await burnEquivalentTime(password, iterations);
    return denied();
  }

  const storedHash = textColumn(player, 'password_hash');
  if (storedHash === null) {
    // Cuenta creada con Google. Puede entrar por correo si le pusieron contrasena
    // despues; si no, la unica via es Google.
    await burnEquivalentTime(password, iterations);
    return denied();
  }

  const matches = await verifyPassword(password, storedHash);
  if (!matches) {
    return denied();
  }

  const playerId = textColumn(player, 'id');
  const accountEmail = textColumn(player, 'email');
  if (playerId === null || accountEmail === null) {
    return denied();
  }

  return succeed(
    await openSession(database, {
      playerId,
      email: accountEmail,
      displayName: textColumn(player, 'display_name') ?? defaultDisplayName(accountEmail),
    }),
  );
}

/** El mismo fallo para todos los casos que no deben distinguirse. */
function denied(): { ok: false; error: AccountError } {
  return failure('credenciales', 'El correo o la contrasena no coinciden.');
}

/**
 * Entra con un identificador de Google ya verificado por `_lib/google.ts`.
 *
 * Hay tres caminos, y las dos reglas que los separan estan tomadas a proposito.
 *
 * ## Si el `sub` ya esta en una fila, esa es la cuenta
 *
 * No se mira el correo en ese camino. El `sub` es estable y el correo no: una
 * persona puede cambiar de direccion en Google sin cambiar de cuenta, y fiarse
 * del correo aqui haria que renombrarse la direccion dejara a alguien sin
 * entrar. Ademas el `sub` es unico en la tabla, asi que la fila que sale es
 * exactamente suya.
 *
 * ## Si el correo ya tiene cuenta pero el `sub` no, no se enlaza sin sesion
 *
 * Es la decision que cierra el pre-hijack. El alta con contrasena no verifica
 * correos, asi que cualquiera se puede dar de alta con el correo de otra
 * persona. Si enlazaramos solo con el token de Google, la persona legitima que
 * despues pulsara "entrar con Google" caeria en la fila de ese primera, con la
 * contrasena de ese primera dentro: fusionar identidades por un correo que solo
 * una de las dos partes ha probado es ceder la cuenta.
 *
 * Por eso hace falta una sesion abierta, y con el mismo correo. Con ella, las
 * dos pruebas que hacen falta ya estan hechas: la contrasena se ha probado al
 * abrir la sesion y Google ha probado el correo con `email_verified`. Es
 * tambien el camino que tiene quien ya tiene cuenta y quiere sumar Google.
 *
 * La comprobacion distingue este caso con su propio mensaje y su propio codigo,
 * y no por eso es una fuga: llegar hasta aqui exige presentar un token de Google
 * verificado para ese correo, o sea controlarlo. Quien no lo controla no puede
 * ni plantear la pregunta, y para el que lo controla el mensaje no descubre nada
 * que no pueda comprobar probando el alta.
 *
 * ## Si no hay nadie con ese correo, se crea la cuenta
 *
 * Con `google_subject` puesto y `password_hash` en NULL, que es lo que en todo
 * el esquema distingue una cuenta de solo Google.
 *
 * En los dos caminos que enlazan se escribe el `sub` **nuevo** sobre la fila,
 * aunque ya hubiera otro. Quien llega hasta ahi tiene una sesion abierta en esa
 * fila, o sea que es suya, y cambiar el enlace de Google de una cuenta propia
 * es una operacion normal. Se prefiere eso a dejar a alguien sin forma de entrar
 * porque un `sub` antiguo de una cuenta que ya no existe sigue ocupando el sitio.
 */
export async function signInWithGoogle(
  database: Database,
  identity: GoogleIdentity,
  sessionToken: string | null,
): Promise<AccountOutcome<SessionGrant>> {
  const bySubject = await database.first(
    'SELECT id, email, display_name FROM players WHERE google_subject = ?',
    [identity.subject],
  );
  if (bySubject !== null) {
    return openRowSession(database, bySubject);
  }

  const email = normalizeEmail(identity.email);
  if (!hasEmailShape(email)) {
    return failure('correo', 'Google no ha devuelto una direccion de correo valida.');
  }

  const byEmail = await database.first(
    'SELECT id, email, display_name FROM players WHERE email = ?',
    [email],
  );
  if (byEmail === null) {
    return succeed(await createGoogleAccount(database, email, identity.subject));
  }

  const owner = await resolveSession(database, sessionToken);
  if (owner === null || normalizeEmail(owner.email) !== email) {
    return failure(
      'cuenta',
      'Ya hay una cuenta con este correo y no se puede abrir con Google. Entra con tu contrasena.',
    );
  }

  await database.run(
    'UPDATE players SET google_subject = ?, updated_at = ? WHERE id = ?',
    [identity.subject, Date.now(), textColumn(byEmail, 'id')],
  );
  return openRowSession(database, byEmail);
}

/**
 * Abre sesion a partir de una fila de `players`.
 *
 * El esquema pone `id`, `email` y `display_name` a `NOT NULL`, asi que una base
 * real nunca trae una fila sin ellos y estos guardas no se alcanzan alla. Estan
 * porque `Row` no lo sabe: es un registro de texto y no una fila tipada. Son
 * caminos que cierran la puerta, y lo que se comprueba es que cierran.
 */
async function openRowSession(
  database: Database,
  row: Row,
): Promise<AccountOutcome<SessionGrant>> {
  const playerId = textColumn(row, 'id');
  const accountEmail = textColumn(row, 'email');
  const displayName = textColumn(row, 'display_name');
  if (playerId === null || accountEmail === null || displayName === null) {
    return denied();
  }
  return succeed(
    await openSession(database, { playerId, email: accountEmail, displayName }),
  );
}

/** Crea la primera cuenta de una persona que solo entra con Google. */
async function createGoogleAccount(
  database: Database,
  email: string,
  subject: string,
): Promise<SessionGrant> {
  const playerId = randomId();
  const now = Date.now();
  const displayName = defaultDisplayName(email);

  await database.run(
    `INSERT INTO players
       (id, email, display_name, password_hash, google_subject, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    [playerId, email, displayName, subject, now, now],
  );

  return openSession(database, { playerId, email, displayName });
}

/**
 * Deriva un hash para gastar el mismo tiempo que un acceso de verdad.
 *
 * Sin esto, un correo que no existe responderia al instante y uno que existe
 * tardaria lo que tarda PBKDF2. Esa diferencia es un reloj: basta medir cien
 * peticiones para saber que correos estan dados de alta, y es un dato que el
 * mensaje de error, cuidado como este, no quiere dar.
 *
 * El hash es de mentira y no va a ningun sitio. Lo que importa es que se pague
 * el mismo trabajo: mismas iteraciones, misma deriva, misma duracion. Con una
 * sola iteracion, como se chloroformo en un principio, el tiempo se reduce a
 * nada y el reloj sigue marcando la hora igual, que es peor que no intentar
 * ocultarlo porque ademas da la impresion de que esta resuelto.
 *
 * @param iterations las que se usarian al hashear de verdad; en produccion son
 *   {@link ITERATIONS} y en las pruebas hay que pasarlas, o el gasto seria de
 *   otro tamano y la prueba no estaria midiendo lo que dice medir
 */
async function burnEquivalentTime(password: string, iterations?: number): Promise<void> {
  await hashPassword(password, iterations ?? ITERATIONS);
}

/**
 * Crea una sesion y devuelve el token.
 *
 * Se guarda el resumen del token, no el token. El token sale hacia la cookie y no
 * vuelve a la base de datos nunca mas, salvo para comprobar su resumen cuando
 * llega en una peticion.
 */
export async function openSession(
  database: Database,
  player: SignedInPlayer,
): Promise<SessionGrant> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_DAYS * MS_PER_DAY;

  await database.run(
    `INSERT INTO sessions (token_hash, player_id, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tokenHash, player.playerId, now, now, expiresAt],
  );

  return { ...player, token, expiresAt };
}

/**
 * Traduce un token de cookie en una cuenta, si la sesion sigue viva.
 *
 * Devuelve `null` en cuanto el token no existe, ha caducado, o no corresponde a
 * una fila de jugador. Los tres son el mismo `null` a proposito: quien llega con
 * una cookie manipulada no debe poder distinguir por el error si habia algo ahi.
 *
 * Ademas renueva la caducidad cuando le queda poco. Sin esto, una sesion usada a
 * diario caduca a los 30 dias aunque se use a diario, que es justo cuando mas
 * papeleo hace molestarla.
 */
export async function resolveSession(
  database: Database,
  token: string | null,
): Promise<SignedInPlayer | null> {
  if (token === null || token === '') {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const session = await database.first(
    `SELECT s.player_id AS playerId, s.expires_at AS expiresAt,
            p.email AS email, p.display_name AS displayName
       FROM sessions s
       JOIN players p ON p.id = s.player_id
      WHERE s.token_hash = ?`,
    [tokenHash],
  );
  if (session === null) {
    return null;
  }

  const expiresAt = integerColumn(session, 'expiresAt');
  if (expiresAt <= Date.now()) {
    return null;
  }

  const playerId = textColumn(session, 'playerId');
  const email = textColumn(session, 'email');
  if (playerId === null || email === null) {
    return null;
  }

  const displayName = textColumn(session, 'displayName') ?? defaultDisplayName(email);

  // `last_seen_at` se actualiza siempre, no solo cuando hay renovacion. Es lo
  // que hace falta para poder decir "visto por ultima vez" sin una tabla de
  // auditoria, y con un indice por `expires_at` borrarlas es barato.
  const now = Date.now();
  const renewed = now + SESSION_TTL_DAYS * MS_PER_DAY;
  if (expiresAt - now < SESSION_REFRESH_DAYS * MS_PER_DAY) {
    await database.run(
      'UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?',
      [now, renewed, tokenHash],
    );
  } else {
    await database.run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [
      now,
      tokenHash,
    ]);
  }

  return { playerId, displayName, email };
}

/** Cierra una sesion. Borrar la fila es lo que hace que el token deje de servir. */
export async function closeSession(
  database: Database,
  token: string | null,
): Promise<void> {
  if (token === null || token === '') {
    return;
  }
  const tokenHash = await sha256Hex(token);
  await database.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}



/**
 * Un nombre para quien se da de alta.
 *
 * Sale de la parte del correo anterior a la arroba. No es un nombre bonito ni
 * pretende serlo: es algo legible para que la interfaz pueda decir "hola, X" sin
 * tener que pedir un nombre en un formulario que solo pide correo y contrasena.
 */
function defaultDisplayName(email: string): string {
  // `replace` y no `email.split('@')[0]`. Con `split` la lista siempre tiene al
  // menos un elemento, asi que la rama que contemplaba "y si no hay arroba" no
  // se podia alcanzar ni escribiendo la prueba. Cortando con una expresion
  // regular el caso de un correo sin arroba se resuelve solo: no hay nada que
  // partir, y lo que queda es el correo tal cual.
  return email.replace(/@.*$/, '');
}