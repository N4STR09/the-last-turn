/**
 * Hash de contrasenas: PBKDF2-HMAC-SHA-256 con sal por usuario.
 *
 * Aqui no hay cifrado y no puede haberlo. Cifrar es reversible: quien tenga la
 * clave lee la contrasena. Una base de datos con contrasenas cifradas es peor
 * que una vacia, porque aparenta estar protegida y no lo esta. Lo que se hace
 * es una derivacion de un solo sentido: la misma contrasena con la misma sal da
 * el mismo hash, y del hash no se vuelve atras.
 *
 * El formato guardado lleva dentro el algoritmo y el numero de iteraciones
 * (`pbkdf2_sha256$5000$<sal>$<hash>`). Verificar usa lo que dice la fila, no lo
 * que dice este archivo, asi que subir las iteraciones dentro de un ano no
 * obliga a mover los datos: las filas viejas se siguen comprobando con sus
 * propias iteraciones.
 *
 * Las dos partes van en base64url sin relleno, no en base64 normal. Base64
 * normal usa `+` y `/`, que son problematicos en cabeceras, cookies y query
 * strings, y el `=` de relleno es un caracter mas que puede desaparecer al
 * recortar. Aqui no hay nada que recortar, pero el mismo codigo lo usa para los
 * tokens de sesion, y que las dos cosas usen el mismo alfabeto quita una clase
 * entera de errores.
 */

import { constantTimeEqual, fromBase64Url, toBase64Url, utf8Bytes } from './bytes';

/**
 * Iteraciones por defecto.
 *
 * No es el numero que recomendaria OWASP para PBKDF2-SHA-256, que anda por las
 * 600 000. Esta puesto para caber en el plan gratuito de Cloudflare Workers, que
 * da 10 ms de CPU por peticion: 5 000 iteraciones cuestan unos 5 ms, que es la
 * mitad del cupo, y 600 000 costarian mas de seiscientos. El porque entero, la
 * medida y lo que se pierde estan en `docs/accounts.md`; el numero vive aqui.
 *
 * Subirlo es cuestion de cambiar esta constante o de poner
 * `PBKDF2_ITERATIONS` en la configuracion del despliegue. Bajarlo por debajo lo
 * impide el suelo de `iterations.ts`.
 */
export const ITERATIONS = 5000;

/** Bytes de sal por usuario. 16 es el tamano recomendado para PBKDF2. */
export const SALT_BYTES = 16;

/** Bits del hash derivado. 256 son 32 bytes, la salida natural de SHA-256. */
const KEY_BITS = 256;

/** Nombre del algoritmo, tal y como va escrito en la fila. */
const ALGORITHM = 'pbkdf2_sha256';

/** Numero de separadores: un campo por cada parte del formato. */
const FIELD_COUNT = 4;

/**
 * Longitudes admitidas para una contrasena.
 *
 * El minimo evita las contrasenas que se adivinan probando un diccionario de
 * cien entradas. El maximo no es por seguridad, es por servicio: PBKDF2 lee la
 * contrasena entera en cada peticion, y alguien que mande diez megabytes hace
 * que el servidor gaste memoria y tiempo en algo que nunca sera una contrasena
 * legitima.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Deriva el hash de una contrasena con una sal nueva.
 *
 * @param password contrasena en claro
 * @param iterations numero de rondas. El valor de produccion es {@link ITERATIONS}
 *   y solo las pruebas pasan otro, para no tardar un minuto por hash. Nadie
 *   deberia llamarla desde fuera del modulo con un numero distinto: verificar no
 *   admite ninguno, precisamente para que el parametro no se pueda usar por error.
 */
export async function hashPassword(
  password: string,
  iterations: number = ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return [ALGORITHM, iterations, toBase64Url(salt), toBase64Url(hash)].join('$');
}

/**
 * Comprueba una contrasena contra un hash guardado.
 *
 * Devuelve `false` en cuanto algo no cuadra, incluido un hash con formato
 * equivocado. Devolver `false` y no lanzar es lo que hace que quien llama pueda
 * responder siempre lo mismo sin tener que distinguir "contrasena incorrecta" de
 * "esta cuenta no existe", que es exactamente la distincion que no hay que
 * hacer.
 *
 * @param password contrasena que se intenta
 * @param stored fila tal cual, con el formato de cuatro partes
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = parseStored(stored);
  if (parts === null) {
    return false;
  }

  // Las iteraciones son las de la fila, nunca las de este archivo. Es la razon de
  // que el formato las lleve dentro: subir {@link ITERATIONS} dentro de un año
  // tiene que dejar funcionando las cuentas viejas, y eso solo es cierto si al
  // verificar se lee el numero que estaba guardado con cada hash.
  const expected = await derive(password, parts.salt, parts.storedIterations);
  return constantTimeEqual(expected, parts.hash);
}

/** Las cuatro partes del hash, ya en bytes. `null` si el formato no sirve. */
interface StoredHash {
  readonly salt: Uint8Array;
  readonly hash: Uint8Array;
  readonly storedIterations: number;
}

function parseStored(stored: string): StoredHash | null {
  const parts = stored.split('$');
  const [algorithm, iterationsText, saltText, hashText] = parts;

  // Una sola comprobacion para todo lo que hace que el formato no sirva. Iba
  // partida en tres, con la de la longitud delante, y en ese orden las dos
  // ultimas no se alcanzaban nunca: si el array tiene cuatro piezas, ninguna es
  // `undefined`, o sea que media funcion era codigo que no se ejecutaba jamas y
  // solo podia dar una falsa tranquilidad. Aqui se comprueba cada pieza donde se
  // lee, y que falte una o que sobren se resuelve en el mismo sitio.
  if (
    algorithm === undefined ||
    iterationsText === undefined ||
    saltText === undefined ||
    hashText === undefined ||
    parts.length !== FIELD_COUNT
  ) {
    return null;
  }
  if (algorithm !== ALGORITHM) {
    return null;
  }

  const storedIterations = Number(iterationsText);
  if (!Number.isInteger(storedIterations) || storedIterations < 1) {
    return null;
  }

  return {
    salt: fromBase64Url(saltText),
    hash: fromBase64Url(hashText),
    storedIterations,
  };
}

/**
 * El nucleo de PBKDF2. Vive aparte para que hashear y verificar hagan exactamente
 * la misma cuenta: si cada uno tuviera su propia copia, un cambio en uno dejaria
 * al otro comparando contra hashes hechos con otro numero de iteraciones, y el
 * fallo apareceria como "la contrasena correcta no funciona".
 */
async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}