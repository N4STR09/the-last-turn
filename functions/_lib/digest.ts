/**
 * Resumen SHA-256 y bytes aleatorios.
 *
 * Son las dos piezas de las que cuelga la sesion. El token sale de aqui, se le
 * calcula el resumen, y en la base de datos solo se guarda el resumen. La razon
 * de esa asimetria es que el token vive en la cookie del jugador y el resumen en
 * la tabla: si alguien se lleva la base de datos entera no se lleva ninguna
 * sesion utilizable, porque el token en claro no estaba ahi. Al reves no vale:
 * el token tiene que guardarse en la cookie porque es lo que viaja.
 */

import { toBase64Url, toHex, utf8Bytes } from './bytes';

/** Bytes del token de sesion. 32 es lo que se usa para una sesion web. */
export const TOKEN_BYTES = 32;

/** Longitud en hexadecimal de un SHA-256: dos caracteres por byte. */
export const SHA256_HEX_LENGTH = 64;

/**
 * Resumen SHA-256 de un texto, en hexadecimal en minusculas.
 *
 * El texto entra como UTF-8. Da igual para un token, que son bytes ASCII, pero
 * el mismo helper se usa para otras cosas y no conviene que cambie de
 * codificacion sin que se note.
 */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8Bytes(text))));
}

/**
 * Resumen SHA-256 de bytes, en hexadecimal en minusculas.
 *
 * Es la version que hace falta para resumir un token que ya son bytes, y evita
 * el viaje de ida y vuelta por una cadena: `toHex` y luego `utf8Bytes` de vuelta
 * seria codificar dos veces lo mismo.
 */
export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

/**
 * Token aleatorio en base64url.
 *
 * La entropia viene de `crypto.getRandomValues`, que es el generador que la
 * plataforma garantiza para criptografia. Con 32 bytes hay 2^288 posibilidades,
 * asi que adivinarlo no es una cuestion de tener suerte sino de tener tiempo
 * infinito.
 *
 * @param bytes longitud del token; por defecto {@link TOKEN_BYTES}
 */
export function randomToken(bytes: number = TOKEN_BYTES): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/**
 * Un identificador para una fila nueva, en hexadecimal.
 *
 * Es aleatorio y no un contador. Un contador adivina el siguiente: quien ve la
 * cuenta de jugadores sabe cuantos hay y puede pedir la fila `numero + 1`. Un
 * identificador aleatorio no dice nada de los demas.
 *
 * Los identificadores de jugador no son secretos: viajan dentro de las
 * respuestas JSON. Lo que no puede ser adivinable es el token de sesion, y por
 * eso son dos funciones distintas con dos longitudes distintas.
 */
export function randomId(): string {
  return randomToken(16);
}