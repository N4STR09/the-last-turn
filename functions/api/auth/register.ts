import { bindD1 } from '../../_lib/database';
import {
  createAccount,
  validateCredentials,
} from '../../_lib/accounts';
import { iterationsForEnvironment } from '../../_lib/iterations';
import {
  errorResponse,
  isSameOrigin,
  jsonResponse,
  sessionCookie,
} from '../../_lib/http';

/**
 * Alta de cuenta con correo y contrasena.
 *
 * Es la unica ruta que crea filas de jugador. No acepta de donde vino el
 * registro ni que nombre quiere usar: la cuenta se crea con lo que hay y ya.
 *
 * El error de "ese correo ya existe" se responde con el mismo mensaje que una
 * contrasena incorrecta, por el mismo motivo que en el acceso: si el alta
 * dijera "ya hay una cuenta con ese correo", el formulario se convertiria en un
 * servicio gratuito de "dime quien esta registrado aqui".
 */

interface Env {
  readonly DB: D1Database;
  /**
   * Iteraciones de PBKDF2, segun la configuracion de despliegue.
   *
   * Si no esta, valen las del modulo de password, que es lo que pasa en
   * produccion. Ver `_lib/iterations.ts` para porque existe y para el suelo que
   * no permite bajar el hasheo por debajo de cien mil.
   */
  readonly PBKDF2_ITERATIONS?: string;
}

/** Lo que el navegador manda: dos cadenas y nada mas. */
interface RegistrationBody {
  readonly email: unknown;
  readonly password: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta peticion desde aqui.', 403);
  }

  let body: RegistrationBody;
  try {
    body = (await request.json()) as RegistrationBody;
  } catch {
    return errorResponse('El cuerpo de la peticion no es valido.', 400);
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const validated = validateCredentials(email, password);
  if (!validated.ok) {
    return errorResponse(validated.error.message, 400);
  }

  const outcome = await createAccount(
    bindD1(env.DB),
    validated.value.email,
    validated.value.password,
    iterationsForEnvironment(env.PBKDF2_ITERATIONS),
  );
  if (!outcome.ok) {
    // 409 siempre. La forma del correo y de la contrasena ya se ha comprobado
    // arriba, asi que el unico fallo que `createAccount` puede devolver aqui es
    // "ya hay una cuenta con ese correo", y eso es un conflicto con lo que ya
    // hay. El mismo mensaje que un acceso fallido, pero no el mismo codigo: para
    // quien esta creando la cuenta, elegir otro correo es la respuesta, y un 401
    // le diria que revise la contrasena que acaba de escribir.
    return errorResponse(outcome.error.message, 409);
  }

  // El alta tambien inicia sesion. Quien se da de alta acaba de escribir su
  // correo y su contrasena y no ha pedido nada mas, asi que mandarle a la
  // pantalla de acceso un segundo despues seria pedirle que lo escriba otra vez.
  // El formulario de acceso se vuelve a ver cuando alguien entra a proposito.
  const response = jsonResponse(
    { email: outcome.value.email, displayName: outcome.value.displayName },
    201,
  );
  response.headers.append('set-cookie', sessionCookie(outcome.value.token));
  return response;
};
