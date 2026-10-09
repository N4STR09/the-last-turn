import { signIn } from '../../_lib/accounts';
import { bindD1 } from '../../_lib/database';
import { errorResponse, isSameOrigin, jsonResponse, sessionCookie } from '../../_lib/http';
import { iterationsForEnvironment } from '../../_lib/iterations';
import {
  bucketFor,
  clearFailures,
  lockedUntil,
  registerFailure,
  remainingMinutes,
} from '../../_lib/throttle';

/**
 * Acceso con correo y contrasena.
 *
 * Hay dos cosas que aqui importan mas de lo que parecen.
 *
 * **El bloqueo se comprueba antes de tocar la contrasena.** Si se comprobara
 * despues, alguien que esta bloqueado podria seguir gastando CPU del servidor
 * probando contrasenas, que es justo lo que el bloqueo queria evitar. Y el
 * mensaje de bloqueo si dice "espera", porque ahi no hay nada que revelar: saber
 * que una cuenta esta bloqueada no dice si existe.
 *
 * **El fallo se cuenta tambien cuando la cuenta no existe.** Si solo se contara
 * cuando hay una contrasena que comprobar, alguien podria distinguir "correos que
 * existen" de "correos que no" mirando si el contador sube. El contador sube
 * siempre.
 */

interface Env {
  readonly DB: D1Database;
  /**
   * Iteraciones de PBKDF2, segun la configuracion de despliegue.
   *
   * Solo le afecta al gasto de tiempo de los caminos que no comparan contra un
   * hash guardado; cuando el acceso va bien, las iteraciones son las del hash que
   * esta en la fila. Ver `_lib/iterations.ts`.
   */
  readonly PBKDF2_ITERATIONS?: string;
}

interface LoginBody {
  readonly email: unknown;
  readonly password: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta peticion desde aqui.', 403);
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return errorResponse('El cuerpo de la peticion no es valido.', 400);
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const database = bindD1(env.DB);
  const bucket = await bucketFor(clientAddress(request), email);

  // La hora se coge una sola vez y se le pasa a las dos. Con dos `Date.now()`
  // distintos, una y otra podrian estar mirando momentos diferentes, y ademas
  // comprobar el bloqueo y pedir los minutos quedaba en dos pasos cuando es una
  // sola pregunta: si `remainingMinutes` devuelve minutos, hay bloqueo, y si
  // devuelve `null`, no lo hay. Con el mismo reloj para las dos no hay por que
  // repetir la condicion ni creerse dos veces lo mismo.
  const ahora = Date.now();
  const blockedUntil = await lockedUntil(database, bucket);
  const minutes = remainingMinutes(blockedUntil, ahora);
  if (minutes !== null) {
    return errorResponse(`Demasiados intentos. Prueba en ${minutes} min.`, 429);
  }

  const outcome = await signIn(database, email, password, iterationsForEnvironment(env.PBKDF2_ITERATIONS));
  if (!outcome.ok) {
    await registerFailure(database, bucket);
    // 401 y ningun otro codigo. El 429 no sale de aqui: sale del bloqueo de
    // arriba, que se comprueba antes de tocar la contrasena. `signIn` solo
    // devuelve credenciales o un correo con forma rara, y los dos significan lo
    // mismo para quien intenta entrar, asi que no hay nada que traducir.
    return errorResponse(outcome.error.message, 401);
  }

  // El contador se borra en cuanto el acceso va bien. Si no, alguien que
  // escribio mal su contrasena cinco veces y luego la escribio bien se
  // encontraria bloqueado sin saber por que.
  await clearFailures(database, bucket);

  const response = jsonResponse({
    email: outcome.value.email,
    displayName: outcome.value.displayName,
  });
  response.headers.append('set-cookie', sessionCookie(outcome.value.token));
  return response;
};

/**
 * De donde viene la peticion.
 *
 * `CF-Connecting-IP` lo pone Cloudflare y no lo puede falsear quien llama desde
 * un navegador. Cuando no esta, se usa una constante en vez de inventar un valor:
 * todas las peticiones sin cabecera caerian en el mismo cubo, que es un limite
 * mas duro, no uno mas flojo.
 */
function clientAddress(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'sin-direccion';
}