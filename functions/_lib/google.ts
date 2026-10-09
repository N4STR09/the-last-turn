/**
 * Verificacion del identificador de Google.
 *
 * Google entrega al navegador un JWT firmado con RS256. Quien recibe ese JWT no
 * puede creerse nada de lo que dice hasta que la firma este comprobada contra
 * las claves publicas de Google. Sin esa comprobacion, cualquiera fabrica un
 * token con el correo que le venga en gana y entra en la cuenta de otra persona,
 * que es el fallo entero del login con un proveedor externo.
 *
 * Las comprobaciones, en orden, y el motivo de cada una:
 *
 * - **La firma va primero.** `iss`, `aud`, `exp` y `email` se leen despues de
 *   verificar, nunca antes: un campo sin firmar es una afirmacion de quien lo
 *   escribio, no un dato. El payload ni se decodifica hasta que la firma vale.
 * - **`alg` es RS256 y nada mas.** Aceptar `HS256` dejaria firmar con la propia
 *   clave publica como secreto: es la confusion de algoritmos, y la clave
 *   publica esta, por definicion, a la vista de todos.
 * - **`iss` es Google.** Un token firmado por Google pero emitido para otro
 *   producto no da acceso aqui.
 * - **`aud` es este cliente.** Un token emitido para otro cliente de Google no
 *   sirve aqui aunque lo haya firmado Google. Se compara con `!==` y no con una
 *   lista: si Google mandara un `aud` que no es exactamente el nuestro, lo
 *   correcto es rechazar, y una comparacion estricta rechaza siempre.
 * - **`exp` sigue en pie.** Un identificador de Google vive una hora.
 * - **`email_verified` es `true`.** Es la comprobacion que hace que confiar en
 *   el correo de Google tenga algun sentido: sin ella, cualquiera con un
 *   dominio propio se inventa la direccion de otra persona.
 *
 * Sin dependencias: `fetch` trae las claves y `crypto.subtle` las verifica, que
 * es lo que la plataforma ya trae.
 */

import { fromBase64Url, utf8Bytes } from './bytes';

/** Donde estan las claves publicas con las que Google firma sus tokens. */
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/**
 * La identidad que se confirma de un identificador ya verificado.
 *
 * Solo dos campos, y el motivo de los dos que faltan importa. El `sub` es el
 * identificador: es estable por cuenta de Google y no cambia si la persona
 * renombra su direccion, que es por lo que la tabla guarda ese y no otra cosa.
 * El correo hace falta para enlazarlo con una cuenta existente y para mostrarlo.
 *
 * El `name` de Google no se guarda. No hace falta para nada de lo que hay aqui
 * y es el dato que sobra: guardar el nombre de perfil de un tercero es recoger
 * mas de lo que el sistema usa.
 */
export interface GoogleIdentity {
  readonly subject: string;
  readonly email: string;
}

/** Por que se ha rechazado un identificador. */
export type GoogleTokenFailure =
  | 'estructura'
  | 'firma'
  | 'origen'
  | 'audiencia'
  | 'caducado'
  | 'correo';

/** Lo que sale de verificar un identificador. */
export type GoogleTokenResult =
  | { readonly ok: true; readonly identity: GoogleIdentity }
  | { readonly ok: false; readonly failure: GoogleTokenFailure };

/**
 * El mensaje que ve quien intenta entrar con Google y no puede.
 *
 * Estructura, firma, origen y audiencia dicen lo mismo para quien llama: que
 * este token no vale aqui. Repartirlos en cuatro textos solo enseniaria a leer
 * por dentro como esta montada la verificacion, y no hay nadie a quien eso ayude.
 * Caducado y correo si se distinguen porque son los dos casos en los que volver
 * a intentarlo o arreglar algo en Google cambia el resultado.
 */
export function googleTokenMessage(failure: GoogleTokenFailure): string {
  if (failure === 'caducado') {
    return 'El identificador de Google ha caducado. Vuelve a intentarlo.';
  }
  if (failure === 'correo') {
    return 'Google no ha confirmado la direccion de correo de esta cuenta.';
  }
  return 'No se ha podido verificar el identificador de Google.';
}

/**
 * Comprueba un identificador de Google.
 *
 * @param token el JWT que manda el navegador
 * @param audience el `client_id` nuestro; un token emitido para otro no vale
 * @param keys quien trae las claves publicas de Google
 * @param now milisegundos desde la epoca, para poder probar el tiempo sin
 *   esperar a que pase una hora
 */
export async function verifyGoogleIdToken(
  token: string,
  audience: string,
  keys: GoogleKeySource,
  now: number,
): Promise<GoogleTokenResult> {
  // Las tres piezas se localizan con `indexOf` y no con `split('.')` seguido de
  // acceso por posicion. Con `noUncheckedIndexedAccess` un acceso a `parts[0]`
  // devuelve `string | undefined`, y la unica forma de quitarle el `undefined`
  // seria un `?? ''` que nunca se da: una rama sin cubrir a cambio de nada.
  const headerEnd = token.indexOf('.');
  const payloadEnd = token.indexOf('.', headerEnd + 1);
  if (headerEnd <= 0 || payloadEnd <= headerEnd + 1) {
    return rejected('estructura');
  }
  if (token.indexOf('.', payloadEnd + 1) !== -1) {
    return rejected('estructura');
  }

  const rawHeader = token.slice(0, headerEnd);
  const rawPayload = token.slice(headerEnd + 1, payloadEnd);
  const rawSignature = token.slice(payloadEnd + 1);

  const header = decodeJsonObject(rawHeader);
  if (header === null) {
    return rejected('estructura');
  }
  if (header['alg'] !== 'RS256') {
    return rejected('estructura');
  }
  const kid = header['kid'];
  if (typeof kid !== 'string' || kid === '') {
    return rejected('estructura');
  }

  const key = await keys.key(kid);
  if (key === null) {
    return rejected('firma');
  }

  let signature: Uint8Array;
  try {
    signature = fromBase64Url(rawSignature);
  } catch {
    // base64url que no lo es. `atob` lanza y aqui se traduce en el mismo
    // rechazo que una firma que no cuadra, que es lo que significa.
    return rejected('estructura');
  }

  const signed = utf8Bytes(`${rawHeader}.${rawPayload}`);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signed,
  );
  if (!verified) {
    return rejected('firma');
  }

  // A partir de aqui el payload es de fiar: viene firmado por Google.
  const payload = decodeJsonObject(rawPayload);
  if (payload === null) {
    return rejected('estructura');
  }
  if (!isGoogleIssuer(payload['iss'])) {
    return rejected('origen');
  }
  if (payload['aud'] !== audience) {
    return rejected('audiencia');
  }
  if (!isFresh(payload['exp'], now)) {
    return rejected('caducado');
  }

  const subject = payload['sub'];
  if (typeof subject !== 'string' || subject === '') {
    return rejected('estructura');
  }
  const email = payload['email'];
  if (payload['email_verified'] !== true || typeof email !== 'string' || email === '') {
    return rejected('correo');
  }

  return { ok: true, identity: { subject, email } };
}

function rejected(failure: GoogleTokenFailure): GoogleTokenResult {
  return { ok: false, failure };
}

/** Los dos `iss` que Google pone en sus identificadores. */
function isGoogleIssuer(value: unknown): boolean {
  return value === 'https://accounts.google.com' || value === 'accounts.google.com';
}

/** `exp` viene en segundos y el reloj aqui va en milisegundos. */
function isFresh(exp: unknown, now: number): boolean {
  return typeof exp === 'number' && exp * 1000 > now;
}

/**
 * Decodifica una pieza del token como un objeto JSON.
 *
 * Devuelve `null` para todo lo que no lo sea, y el motivo por el que se mira el
 * payload **despues** de la firma es que decodificar tambien cuesta: parsear un
 * megabyte de JSON que nadie ha firmado es trabajo gratis para quien manda
 * basura.
 */
function decodeJsonObject(part: string): Record<string, unknown> | null {
  try {
    const text = new TextDecoder().decode(fromBase64Url(part));
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Quien trae las claves publicas con las que se verifica. */
export interface GoogleKeySource {
  /**
   * La clave con ese `kid`, o `null` si Google no la publica.
   *
   * `null` aqui significa "no se puede verificar", nunca "se acepta igual": la
   * unica respuesta posible de la verificacion es un rechazo.
   */
  key(kid: string): Promise<CryptoKey | null>;
}

/** Como se le piden las claves a Google. En las pruebas se cambia por esto. */
export type GoogleJwksFetcher = (input: string) => Promise<Response>;

/** Una hora por defecto, cuando Google no dice otra cosa. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Nunca menos de cinco minutos: con `max-age=0` cada acceso seria un viaje. */
const MIN_TTL_MS = 5 * 60 * 1000;

/** Nunca mas de un dia: una clave caducada no deberia poder quedarse asi. */
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cuanto se cachea un fallo.
 *
 * Si Google no responde o manda algo que no se puede leer, la cache se llena de
 * nada y se vacia enseguida: cada peticion intentaria otra vez, o sea que
 * mandar tokens de mentira a lo bestia produciria un viaje a Google por cada
 * uno. Media hora de espera corta ese multiplicador sin dejar el acceso con
 * Google caido mas de lo que dura un tropiezo.
 */
const FAILURE_TTL_MS = 30 * 1000;

interface CachedKeys {
  readonly keys: ReadonlyMap<string, CryptoKey>;
  readonly validUntil: number;
}

const NO_KEYS: ReadonlyMap<string, CryptoKey> = new Map();

/**
 * Juego de claves de Google con cache en memoria.
 *
 * La cache vive en el cierre y no en una variable de modulo, por dos motivos.
 * El primero es que cada prueba puede crear la suya sin que se mezcle con la de
 * al lado. El segundo es que el estado de un isolate de Cloudflare no es algo
 * que deba mirarse desde fuera: quien usa esto solo puede pedir una clave.
 *
 * Se cachea porque Google lo pide en su documentacion y porque traer las claves
 * en cada acceso suma un viaje de red a un proceso que ya tiene uno. El tiempo
 * de vida sale de la cabecera `Cache-Control` que manda Google, acotado entre
 * cinco minutos y un dia.
 *
 * @param fetcher quien hace la peticion; por defecto `fetch`, y las pruebas lo
 *   sustituyen para no depender de la red
 */
export function createGoogleKeySource(fetcher?: GoogleJwksFetcher): GoogleKeySource {
  // `globalThis.fetch` dentro de una flecha y no como valor por defecto del
  // parametro: asi se resuelve en el momento de llamar, que es cuando una prueba
  // puede haberlo cambiado. Llamado como metodo de `globalThis` ademas conserva
  // el `this` que algunos entornos exigen.
  const request = fetcher ?? ((input: string) => globalThis.fetch(input));
  let cached: CachedKeys | null = null;

  return {
    async key(kid: string): Promise<CryptoKey | null> {
      if (cached === null || cached.validUntil <= Date.now()) {
        cached = await loadKeys(request);
      }
      return cached.keys.get(kid) ?? null;
    },
  };
}

async function loadKeys(request: GoogleJwksFetcher): Promise<CachedKeys> {
  try {
    const response = await request(GOOGLE_JWKS_URL);
    if (!response.ok) {
      return withoutKeys();
    }
    const keys = await readKeys(response);
    if (keys.size === 0) {
      return withoutKeys();
    }
    return { keys, validUntil: Date.now() + ttlFrom(response) };
  } catch {
    return withoutKeys();
  }
}

function withoutKeys(): CachedKeys {
  return { keys: NO_KEYS, validUntil: Date.now() + FAILURE_TTL_MS };
}

/**
 * Cuanto dice Google que duran sus claves.
 *
 * La cabecera puede venir con espacios, con otras directivas delante y con un
 * valor que no sea un numero. Cada caso equivocado cae en la hora por defecto,
 * que es un tiempo razonable para cualquier cosa que Google mande: solo se
 * cambia el valor cuando se entiende.
 */
function ttlFrom(response: Response): number {
  const header = response.headers.get('cache-control');
  if (header === null) {
    return DEFAULT_TTL_MS;
  }
  const directive = header
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith('max-age='));
  if (directive === undefined) {
    return DEFAULT_TTL_MS;
  }
  const seconds = Number.parseInt(directive.slice('max-age='.length), 10);
  if (!Number.isFinite(seconds)) {
    return DEFAULT_TTL_MS;
  }
  const bounded = Math.min(Math.max(seconds, MIN_TTL_MS / 1000), MAX_TTL_MS / 1000);
  return bounded * 1000;
}

/**
 * Lee el juego de claves y las importa una a una.
 *
 * Una entrada que no se puede importar se ignora en vez de tumbar la llamada
 * entera: Google manda las que manda, y que una de ellas este mal no deberia
 * apagar el acceso con Google para todo el mundo hasta el proximo refresco.
 */
async function readKeys(response: Response): Promise<ReadonlyMap<string, CryptoKey>> {
  const payload: unknown = await response.json();
  const keys = new Map<string, CryptoKey>();
  if (typeof payload !== 'object' || payload === null) {
    return keys;
  }
  const entries: unknown = (payload as { keys?: unknown }).keys;
  if (!isRecordArray(entries)) {
    return keys;
  }
  for (const entry of entries) {
    const jwk = asRsaJwk(entry);
    if (jwk === null) {
      continue;
    }
    try {
      keys.set(jwk.kid, await importRsaJwk(jwk));
    } catch {
      // Ver comentario arriba: se ignora y se sigue con la siguiente.
    }
  }
  return keys;
}

/**
 * `Array.isArray` con un predicado propio en vez de usarlo en linea.
 *
 * El de la libreria estandar dice `arg is any[]`, y de ahi sale un `any` que
 * luego se arrastra a todas las funciones que reciban la lista. Con un predicado
 * declarado, quien comprueba ya sabe que recibe `unknown[]` y no una caja sin
 * etiquetar.
 */
function isRecordArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Una entrada del juego de claves, ya comprobada antes de importarla. */
interface GoogleJwk {
  readonly kid: string;
  readonly n: string;
  readonly e: string;
}

function asRsaJwk(value: unknown): GoogleJwk | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { kid, kty, n, e } = record;
  if (typeof kid !== 'string' || kid === '') {
    return null;
  }
  // `kty` se comprueba y no se salta. Si Google (o quien ocupe su sitio)
  // mandara una clave simetrica, importarla como RSA fallaria, pero fallaria
  // dentro de un `try` que se traga el error: decirlo aqui hace que el motivo
  // sea evidente en el codigo y no en una excepcion ajena.
  if (kty !== 'RSA' || typeof n !== 'string' || typeof e !== 'string') {
    return null;
  }
  return { kid, n, e };
}

async function importRsaJwk(jwk: GoogleJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}
