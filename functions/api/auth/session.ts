import { resolveSession } from '../../_lib/accounts';
import { bindD1 } from '../../_lib/database';
import { jsonResponse, readSessionToken } from '../../_lib/http';

/**
 * Dice quien esta dentro, si alguien.
 *
 * Es lo que la interfaz consulta al arrancar para decidir si muestra "mi cuenta"
 * o "iniciar sesion". Responde siempre 200 y siempre con la misma forma:
 *
 * - con sesion: `{ autenticado: true, email, displayName }`
 * - sin sesion: `{ autenticado: false }`
 *
 * No responde 401 cuando no hay sesion, y no es descuido. Un 403 o un 401 aqui
 * haria que cualquier cliente tratara "todavia no he iniciado sesion" como un
 * fallo, y en la interfaz se veria como un error rojo en una pantalla que
 * funciona. La pregunta es "hay sesion?", y la respuesta es si o no.
 *
 * Tampoco devuelve el token. El token se manda una vez, en el `Set-Cookie` del
 * alta y del acceso, y a partir de ahi solo viaja dentro de la cookie.
 */

interface Env {
  readonly DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = readSessionToken(request.headers.get('cookie'));
  const session = await resolveSession(bindD1(env.DB), token);

  if (session === null) {
    return jsonResponse({ autenticado: false });
  }

  return jsonResponse({
    autenticado: true,
    email: session.email,
    displayName: session.displayName,
  });
};