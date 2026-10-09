import { resolveSession } from '../_lib/accounts';
import { bindD1, type Database } from '../_lib/database';
import { errorResponse, isSameOrigin, jsonResponse, readSessionToken } from '../_lib/http';
import { parseGameReport, readStats, recordGame } from '../_lib/stats';

/**
 * Estadisticas de la cuenta.
 *
 * Dos peticiones y ninguna mas. `GET` trae lo acumulado; `POST` anota una
 * partida. No hay `DELETE`, porque no hay nada que borrar: las estadisticas no
 * se pueden reiniciar y tampoco se puede pedir que se reinicien. Si un dia eso
 * cambia, tendra que ser con una sesion abierta y con la misma comprobacion de
 * origen de esta ruta.
 *
 * **Lo que no hace falta en la peticion: identificar a nadie.** El jugador no
 * viaja en el cuerpo, viaja en la cookie. Quien manda `{ turns, level,
 * difficulty }` no puede decidir de que cuenta es, y por eso esta ruta no
 * acepta ni un campo mas de esos tres: un `player_id` en el cuerpo seria una
 * invitacion a escribir en el cajon de otro.
 *
 * **Y no guarda partidas.** Ni el estado, ni la semilla, ni el registro de
 * acciones. Lo unico que se escribe son tres enteros y la celda de nivel donde
 * se empezo. Ver `_lib/stats.ts` para el por que de esa linea.
 */

interface Env {
  readonly DB: D1Database;
}

/** Lo que se responde cuando hay sesion: la suma, ya leida de la base de datos. */
async function statsFor(database: Database, playerId: string): Promise<Response> {
  const stats = await readStats(database, playerId);
  return jsonResponse({ autenticado: true, ...stats });
}

/**
 * Trae lo acumulado por la cuenta que esta dentro.
 *
 * Responde 200 en los dos casos, y no es un descuido: es la misma decision que
 * ya tomo `GET /api/auth/session`. La pregunta es "que traigo?", y sin sesion
 * la respuesta es "no hay nada", que no es un fallo. Un 401 aqui obligaria a
 * la interfaz a tratar "todavia no he iniciado sesion" como un error rojo en
 * una portada que funciona perfectamente sin cuenta.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const database = bindD1(env.DB);
  const token = readSessionToken(request.headers.get('cookie'));
  const player = await resolveSession(database, token);

  if (player === null) {
    return jsonResponse({ autenticado: false });
  }

  return statsFor(database, player.playerId);
};

/**
 * Anota una partida de la cuenta que esta dentro.
 *
 * El orden de las comprobaciones esta elegido y no es el primero que se
 * ocurrio: **primero quien pide, despues que pide.** Una peticion sin sesion no
 * es una peticion mal formada, es una peticion que no puede escribir nada, y
 * responderle 400 le diria que lo que falla es su forma. Asi, un cuerpo
 * cualquiera con sesion da 400, y cualquiera sin sesion da 401, que es lo que
 * de verdad le pasa.
 *
 * Sobre el abuso: solo sube. Cada peticion suma uno a la cuenta de quien la
 * manda y no hay tabla de puntuaciones que contaminar, asi que el unico que se
 * puede fastidiar es el que la manda, con `SameSite=Lax` y la comprobacion de
 * origen delante. No merece un contador de intentos: el bloqueo de
 * `POST /api/auth/login` esta ahi para frenar adivinar contrasenas, que es un
 * trabajo infinito que alguien si quiere hacer, y esta no lo es.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta peticion desde aqui.', 403);
  }

  const database = bindD1(env.DB);
  const token = readSessionToken(request.headers.get('cookie'));
  const player = await resolveSession(database, token);

  if (player === null) {
    return errorResponse('Inicia sesion para guardar tus estadisticas.', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('El cuerpo de la peticion no es valido.', 400);
  }

  const report = parseGameReport(body);
  if (report === null) {
    return errorResponse('El cuerpo de la peticion no es valido.', 400);
  }

  // El resumen vuelve en la misma respuesta. Sin el, quien sube una partida que
  // le bate su propio record tendria que hacer otra lectura para saberlo, y lo
  // logico de la portada depende de esa cifra: dos viajes para una sola pregunta.
  const stats = await recordGame(database, player.playerId, report);
  return jsonResponse({ autenticado: true, ...stats });
};
