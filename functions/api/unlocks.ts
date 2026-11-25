import { resolveSession } from '../_lib/accounts';
import { bindD1 } from '../_lib/database';
import { jsonResponse, readSessionToken } from '../_lib/http';
import { readProgression } from '../_lib/unlocks';

/**
 * La colección de la cuenta: monedas, personajes, logros y objetos de la tienda.
 *
 * Solo lectura, y una razón: los dos caminos que escriben progresión están
 * validados y probados fuera de aquí —acabar una partida entra por
 * `POST /api/stats`, con los hechos comprobados y el freno de ritmo, y comprar
 * un objeto entra por `POST /api/shop/purchase`, con el catálogo cerrado y el
 * saldo comprobado en la propia sentencia—. Si esta ruta aceptara un POST, habría
 * tres caminos que mantener en sincronía y dos sitios donde olvidar una
 * comprobación.
 *
 * Responde 200 siempre, con la misma forma que `GET /api/auth/session`:
 *
 * - con sesión: `{ autenticado: true, coins, unlocks, achievements, balance, objects }`
 * - sin sesión: `{ autenticado: false }`
 *
 * `balance` es el saldo restante —monedas ganadas menos lo ya gastado en la
 * tienda— y `objects` son los objetos comprados; los dos los calcula
 * `_lib/unlocks.ts` al leer la colección y esta ruta solo los despacha con el
 * resto.
 *
 * Un 401 aquí convertiría «todavía no he iniciado sesión» en un fallo que la
 * interfaz tendría que interpretar, y no hay nada que interpretar: la pregunta
 * es «qué tiene mi cuenta?», y sin cuenta la respuesta es «no hay cuenta».
 *
 * Tampoco hay ningún campo de identidad en la petición. La cuenta viene de la
 * cookie, como en el resto de las rutas, y el cuerpo ni se lee.
 */

interface Env {
  readonly DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const database = bindD1(env.DB);
  const token = readSessionToken(request.headers.get('cookie'));
  const player = await resolveSession(database, token);

  if (player === null) {
    return jsonResponse({ autenticado: false });
  }

  const progression = await readProgression(database, player.playerId);
  return jsonResponse({ autenticado: true, ...progression });
};
