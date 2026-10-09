import { closeSession } from '../../_lib/accounts';
import { bindD1 } from '../../_lib/database';
import {
  clearedSessionCookie,
  isSameOrigin,
  readSessionToken,
} from '../../_lib/http';

/**
 * Cierra la sesion.
 *
 * Hace dos cosas, y las dos hacen falta. Borra la fila de la tabla de sesiones,
 * que es lo que hace que el token deje de servir aunque alguien lo tenga
 * guardado; y borra la cookie, que es lo que hace que el navegador deje de
 * mandarlo.
 *
 * Si solo se borrara la cookie, el token seguiria siendo valido para quien lo
 * copiara. Si solo se borrara la fila, el navegador seguiria mandando un token
 * muerto en cada peticion hasta que caducara.
 *
 * Responde 204, que es lo que corresponde a "hecho y no hay nada mas". Un cuerpo
 * JSON con un `ok: true` seria lo mismo dicho con mas bytes.
 */

interface Env {
  readonly DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return new Response('No se puede hacer esta peticion desde aqui.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const token = readSessionToken(request.headers.get('cookie'));
  await closeSession(bindD1(env.DB), token);

  const response = new Response(null, { status: 204 });
  response.headers.append('set-cookie', clearedSessionCookie());
  return response;
};

/**
 *GET tambien cierra, por comodidad de un enlace de "salir".
 *
 * No es un problema de seguridad. Cerrar sesion no se puede forzar a hacer a
 * alguien con un enlace porque la cookie va con `SameSite=Lax`, y una imagen
 * desde otra pagina es una peticion que no lleva la cookie. Que GET tenga este
 * efecto no le da a nadie el poder de cerrar la sesion de otro.
 */
export const onRequestGet = onRequestPost;