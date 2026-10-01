/**
 * Bytes: hexadecimal, base64url y comparación en tiempo constante.
 *
 * Vive aquí y no en un módulo compartido con el navegador porque no tiene nada
 * que ver con el juego: son las tres operaciones de las que dependen el
 * hasheado, el token de sesión y el hash que se guarda en la base de datos. Son
 * también las tres donde un error no da un fallo visible, sino un valor
 * distinto del que se quería y ningún error por ninguna parte.
 *
 * Solo web estándar, sin dependencias: `btoa` y `atob` existen en la
 * plataforma y en Node, y `TextEncoder` también. Comparar y codificar con un
 * módulo de Node o con una biblioteca sería justo lo que este proyecto no
 * quiere arrastrar.
 */

/** Dígitos de hexadecimal en minúscula. Es el formato que se guarda en D1. */
const HEX_DIGITS = '0123456789abcdef';

/**
 * Bytes a hexadecimal en minúsculas, dos caracteres por byte.
 *
 * Minúsculas y no mayúsculas porque es lo que devuelve `crypto.getRandomValues`
 * al aplicarle `Uint8Array.prototype.toString` en otras implementaciones, y
 * porque un hash guardado en mayúsculas no coincidiría con uno guardado en
 * minúsculas sin que nada avise: dos cadenas distintas que significan lo mismo.
 */
export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    // `charAt` y no `[...]`: los índices van de 0 a 15 y la constante tiene
    // dieciséis caracteres, así que nunca se sale, y `charAt` devuelve siempre
    // una cadena mientras que el acceso directo devuelve `string | undefined`
    // bajo `noUncheckedIndexedAccess`.
    hex += HEX_DIGITS.charAt(byte >>> 4) + HEX_DIGITS.charAt(byte & 0x0f);
  }
  return hex;
}

/**
 * Hexadecimal a bytes. Lanza si el texto no es hexadecimal de longitud par.
 *
 * Acepta mayúsculas y minúsculas porque leer es más tolerante que escribir:
 * `toHex` siempre escribe en minúscula, así que en nuestro propio dato las dos
 * formas son la misma, y un hash copiado de una herramienta que los escribiera en
 * mayúsculas debe seguir sirviendo. Lo que no se tolera es un dígito que no
 * existe, y eso lanza: ignorado en silencio se convierte en un byte que nadie
 * eligió, y un hash comparado con otro hash que no se construyó igual da un
 * `false` que parece un fallo de contraseña. Es un error de quien llama, no una
 * entrada de usuario.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('El hexadecimal necesita un número par de caracteres');
  }

  const lower = hex.toLowerCase();
  const bytes = new Uint8Array(lower.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const high = digitAt(lower, index * 2);
    const low = digitAt(lower, index * 2 + 1);
    bytes[index] = (high << 4) | low;
  }
  return bytes;
}

function digitAt(hex: string, position: number): number {
  const value = HEX_DIGITS.indexOf(hex.charAt(position));
  if (value === -1) {
    throw new Error('El hexadecimal solo admite los dígitos del 0 al f');
  }
  return value;
}

/**
 * Bytes a base64url: el mismo base64 con `-` y `_` en lugar de `+` y `/`, y sin
 * el relleno de `=`.
 *
 * Es el formato del token de sesión porque es el único que se puede meter en una
 * cookie, una cabecera o un parametro de URL sin escapar nada. Base64 normal
 * tiene `+` y `/`, que en una cookie son caracteres problemáticos.
 */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/**
 * Base64url a bytes. Acepta también el relleno, que es lo que llega si alguien
 * copió el token de una herramienta en lugar de de la cookie.
 */
export function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padding = (4 - (base64.length % 4)) % 4;
  return fromBase64(base64 + '='.repeat(padding));
}

function toBase64(bytes: Uint8Array): string {
  // `btoa` solo acepta texto Latin1, así que cada byte viaja como un carácter
  // de ese rango: un byte es un carácter, y 0xff sigue siendo 0xff y no el
  // signo de 0xff1 con la multiplicación de UTF-16.
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Compara dos cadenas de bytes sin que el tiempo que tarda dependa de por dónde
 * sean distintas.
 *
 * El bucle acumula la diferencia con `|=` y no corta con `!==` a la primera
 * coincidencia, que es justo el error que hace inútil la comparación: si dos
 * hashes distintos coinciden en 40 de 64 bytes, uno con `!==` devuelve `false`
 * tras 40 comparaciones y otro tras 64, y medirlo da la longitud del prefijo
 * común. Eso convierte un hash en algo que se puede atacar byte a byte midiendo
 * cuánto tarda.
 *
 * La longitud sí se compara antes, y es aceptable: la de un hash es fija y
 * pública, y ocultarla impediría comparar algo siquiera.
 *
 * La lectura pasa por `DataView` y no por `left[index]`. Con
 * `noUncheckedIndexedAccess` el acceso directo devuelve `number | undefined`, y
 * la única forma de compilar sería poner un `?? 0` que nunca se puede dar: ya
 * se ha comprobado que las dos longitudes son iguales, así que el índice siempre
 * existe dentro de las dos. Un `??` para cubrir un caso imposible es ruido que
 * además sale como rama sin cubrir. `getUint8` devuelve `number` y hace la
 * comprobación de límites él mismo.
 */
export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftView = new DataView(left.buffer, left.byteOffset, left.byteLength);
  const rightView = new DataView(right.buffer, right.byteOffset, right.byteLength);

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= leftView.getUint8(index) ^ rightView.getUint8(index);
  }
  return difference === 0;
}

/** Texto a bytes en UTF-8. Lo que se hashea de una contraseña entra por aquí. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
