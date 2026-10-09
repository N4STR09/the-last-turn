import { signInWithGoogle } from '../../_lib/accounts';
import { bindD1 } from '../../_lib/database';
import { errorResponse, isSameOrigin, jsonResponse, readSessionToken, sessionCookie } from '../../_lib/http';
import {
  createGoogleKeySource,
  googleTokenMessage,
  verifyGoogleIdToken,
} from '../../_lib/google';

/**
 * Acceso con el identificador de Google.
 *
 * El navegador recibe de Google un JWT y lo manda aqui. Nada de lo que dice
 * ese JWT se lee hasta que `_lib/google.ts` ha comprobado la firma contra las
 * claves publicas de Google, y la ruta no vuelve a mirarlo: lo unico que hace
 * con el resultado es pasarselo a `signInWithGoogle`, que decide que cuenta
 * abre.
 *
 * `credential` es el unico campo que se lee del cuerpo, y un cuerpo sin el o con
 * algo que no es texto responde 400. El `client_id` sale del entorno y no del
 * cuerpo: quien manda la peticion no decide contra que audiencia se verifica.
 *
 * **El `client_id` es configuracion de despliegue y no un secreto.** Vive en el
 * entorno por lo mismo que `PBKDF2_ITERATIONS`: no hay motivo para escribirlo en
 * el repositorio, y quien puede fijar el entorno ya puede cambiar el codigo. El
 * secreto de Google es el cliente, y ese se guarda en la consola de Google, no
 * aqui.
 */

interface Env {
  readonly DB: D1Database;
  /**
   * El `client_id` del cliente OAuth de Google.
   *
   * Sin él el boton no existe en la interfaz y esta ruta responde 503. Se comprueba
   * aqui y no solo alla porque la ruta se puede llamar a mano.
   */
  readonly GOOGLE_CLIENT_ID?: string;
}

interface GoogleBody {
  readonly credential?: unknown;
}

/**
 * Las claves de Google, una sola vez por isolate.
 *
 * Vive en el modulo y no dentro de la peticion: el punto de la cache es que mil
 * accesos compartan un viaje, y una cache que se crea y se destruye en cada
 * peticion no cachea nada. Es estado del isolate y no de la cuenta de nadie, y
 * por eso no se puede leer desde fuera: lo unico que se le puede pedir es una
 * clave.
 */
const clavesDeGoogle = createGoogleKeySource();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta peticion desde aqui.', 403);
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  if (clientId === undefined || clientId === '') {
    // Antes de leer el cuerpo a proposito. Si el servidor no tiene cliente, el
    // problema no es lo que ha mandado quien llama, y responderle que su `credential`
    // falta o sobra learia un error de configuracion como si fuera el suyo.
    return errorResponse('El acceso con Google no esta configurado.', 503);
  }

  let body: GoogleBody;
  try {
    body = (await request.json()) as GoogleBody;
  } catch {
    return errorResponse('El cuerpo de la peticion no es valido.', 400);
  }

  const credential = typeof body.credential === 'string' ? body.credential : '';
  if (credential === '') {
    return errorResponse('Falta el identificador de Google.', 400);
  }

  const verified = await verifyGoogleIdToken(credential, clientId, clavesDeGoogle, Date.now());
  if (!verified.ok) {
    return errorResponse(googleTokenMessage(verified.failure), 401);
  }

  const outcome = await signInWithGoogle(
    bindD1(env.DB),
    verified.identity,
    readSessionToken(request.headers.get('cookie')),
  );
  if (!outcome.ok) {
    // 409 solo cuando el problema es que el correo ya tiene una cuenta que este
    // camino no abre; 401 para todo lo demas. Son dos respuestas porque son dos
    // preguntas: una es "no puedes entrar con eso" y la otra es "ahi hay una
    // cuenta con la que no has probado nada". Los dos casos son alcanzables y
    // los dos vienen del mismo `signInWithGoogle`.
    const status = outcome.error.code === 'cuenta' ? 409 : 401;
    return errorResponse(outcome.error.message, status);
  }

  const response = jsonResponse({
    email: outcome.value.email,
    displayName: outcome.value.displayName,
  });
  response.headers.append('set-cookie', sessionCookie(outcome.value.token));
  return response;
};
