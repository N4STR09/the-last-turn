/**
 * Cookies y respuestas.
 *
 * Aqui esta el mecanismo de proteccion de las peticiones que viene con una
 * cookie de sesion. No es el unico, pero si el que hace la mayor parte del
 * trabajo, y conviene tener las cuatro cosas en un solo sitio para que se vean
 * juntas.
 *
 * `HttpOnly` es la que importa de verdad: sin ella, cualquier script de la
 * pagina puede leer la cookie, y con ella nadie puede leerla desde JavaScript
 * aunque quiera. El robo de sesion por inyeccion de script deja de funcionar.
 *
 * `SameSite=Lax` dice que la cookie no viaja en peticionesinitiadas por otro
 * sitio. Es la defensa contra CSRF: un formulario en una pagina ajena que
 * intenta borrar tu cuenta no podria, porque la peticion llega sin tu cookie.
 *
 * `Secure` dice que solo viaja por HTTPS. En claro, la cookie es un texto que
 * cualquiera en la red lee.
 *
 * `Path=/` para que valga en todo el sitio y no solo en una ruta.
 */

/** Nombre de la cookie de sesion. */
export const SESSION_COOKIE = 'tlsession';

export interface CookieOptions {
  readonly maxAgeSeconds?: number;
  readonly expires?: Date;
}

/**
 * Construye el valor de la cabecera `Set-Cookie`.
 *
 * @param token el token en claro; la base de datos solo tiene su resumen
 * @param options `maxAgeSeconds` para la cookie de sesion
 */
export function sessionCookie(token: string, options: CookieOptions = {}): string {
  return serialize(SESSION_COOKIE, token, options);
}

/**
 * Construye la cookie que borra la sesion.
 *
 * Los atributos tienen que ser **los mismos** que los de la cookie que borra, y
 * no por capricho: si el navegador los compara, una cookie que se borra con
 * `Path=/api` y se creo con `Path=/` no se borra, porque el navegador cree que
 * son dos cookies distintas y solo Borra una. Es un fallo silencioso que se
 * manifestaria como "cerrar sesion no funciona en el Safari de nadie".
 */
export function clearedSessionCookie(): string {
  return serialize(SESSION_COOKIE, '', { maxAgeSeconds: 0, expires: new Date(0) });
}

function serialize(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }
  if (options.expires !== undefined) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  return parts.join('; ');
}

/**
 * Lee el token de la cabecera `Cookie`.
 *
 * Se hace a mano en vez de usar un lector de cookies porque hace falta una sola
 * cosa: el token. Y porque el manoeuvre de "si el navegador manda dos cookies con
 * el mismo nombre, cual vale" es justo el tipo de detalle que un lector bien
 * escrito decide por dentro y una funcion de diez lineas deja a la vista.
 */
export function readSessionToken(cookieHeader: string | null): string | null {
  if (cookieHeader === null || cookieHeader === '') {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE) {
      continue;
    }
    // Se decodifica una sola vez. Decodificar dos veces para preguntar si estaba
    // vacio es el modo de que la primera copia se quede obsoleta en cuanto se
    // cambie algo, y aqui la copia que se devuelve es la que se usa como token.
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    // Solo espacios cuentan como vacia. Una cookie de sesion con espacios es una
    // cookie manipulada, y lo unico que haria falta para convertirla en token
    // valido seria que en algun sitio se hiciera `trim` al token.
    return value.trim() === '' ? null : value;
  }
  return null;
}

/**
 * Una respuesta JSON.
 *
 * `no-store` en todo lo que habla con una cookie. Una respuesta con la sesion
 * guardada en una cache del navegador se leeria despues de cerrar sesion, y
 * alguien en el mismoordenador veria el nombre de la cuenta de la otra persona.
 * Cuesta unos bytes de cabecera y quita esa clase de fallo entero.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** Respuesta de error con el mismo formato que las de exito. */
export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Exige que la peticion sea del mismo origen.
 *
 * `Sec-Fetch-Site` lo pone el navegador y no se puede falsear desde
 * JavaScript, asi que es una respuesta directa a "esta peticion la ha mandado
 * otra pagina". Cuando no viene, que es el caso de las pruebas y de las llamadas
 * directas, se pasa: no es una barrera, es un dato mas.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}

/** Une los mensajes de error de un cuerpo que no es el que se esperaba. */
export function readErrorMessage(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }
  return null;
}