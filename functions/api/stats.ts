import { resolveSession } from '../_lib/accounts';
import { bindD1, type Database } from '../_lib/database';
import { errorResponse, isSameOrigin, jsonResponse, readSessionToken } from '../_lib/http';
import { parseGameReport, readStats, recordGame } from '../_lib/stats';
import {
  acceptReport,
  awardGame,
  gameKeyFor,
  reportBucket,
  withinReportBudget,
} from '../_lib/unlocks';

/**
 * Estadisticas de la cuenta.
 *
 * Dos peticiones y ninguna mas. `GET` trae lo acumulado; `POST` anota una
 * partida y otorga su progresión. No hay `DELETE`, porque no hay nada que
 * borrar: las estadisticas no se pueden reiniciar y tampoco se puede pedir que
 * se reinicien. Si un dia eso cambia, tendra que ser con una sesion abierta y
 * con la misma comprobacion de origen de esta ruta.
 *
 * **Lo que no hace falta en la peticion: identificar a nadie.** El jugador no
 * viaja en el cuerpo, viaja en la cookie. Quien manda `{ turns, level,
 * difficulty, seed }` no puede decidir de que cuenta es, y por eso esta ruta
 * no acepta ni un campo mas de esos cuatro: un `player_id` en el cuerpo seria
 * una invitacion a escribir en el cajon de otro.
 *
 * **La semilla identifica, no premia.** Es el mismo `seed` que el cliente ya
 * guarda para el enlace de reproduccion, y de el deriva el servidor la clave
 * con la que distingue un informe repetido de uno nuevo. Ni la moneda ni el
 * logro salen nunca de un valor que el cliente pueda inflar: la cantidad la
 * calcula `_lib/unlocks.ts` con los turnos ya validados.
 *
 * **Y no guarda partidas.** Ni el estado, ni la semilla, ni el registro de
 * acciones. Lo unico que se escribe son tres enteros, la celda de nivel donde
 * se empezo, y filas de progresión cuya clave es un hash irreversible. Ver
 * `_lib/stats.ts` para el por que de la primera parte y `_lib/unlocks.ts` de
 * la segunda.
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
 * Anota una partida de la cuenta que esta dentro y otorga su progresión.
 *
 * El orden de las comprobaciones esta elegido y no es el primero que se
 * ocurrio: **primero quien pide, despues que pide.** Una peticion sin sesion no
 * es una peticion mal formada, es una peticion que no puede escribir nada, y
 * responderle 400 le diria que lo que falla es su forma. Asi, un cuerpo
 * cualquiera con sesion da 400, y cualquiera sin sesion da 401, que es lo que
 * de verdad le pasa.
 *
 * Despues del cuerpo vienen dos frenos, y cada uno corta una cosa distinta:
 *
 * - **El ritmo, por sesión.** `report_attempts` cuenta los informes en una
 *   ventana de diez minutos y devuelve 429 al pasar el tope. Cuentan tambien
 *   los rechazados, asi que un script no puede seguir probando mientras la
 *   ventana este abierta. El limite es un freno contra la inundación, no una
 *   economia: la economia la sostiene el techo de monedas por partida.
 * - **La clave de la partida, por informe.** `player_reports` recibe un hash
 *   derivado de la sesión resolvida y de los hechos validados; si la fila ya
 *   estaba, no se escribe nada mas y la respuesta es la misma, con el
 *   acumulado actual. Repetir un informe no sube contadores ni otorga monedas,
 *   que es exactamente lo que tiene que pasar cuando la respuesta se pierde y
 *   el cliente vuelve a mandar.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta petición desde aquí.', 403);
  }

  const database = bindD1(env.DB);
  const token = readSessionToken(request.headers.get('cookie'));
  const player = await resolveSession(database, token);

  // `token` no puede ser nulo si hay jugador —`resolveSession` devuelve `null`
  // para un token nulo—, pero el compilador no lo sabe, y comprobarlo junto
  // aqui es lo que evita una asignacion forzada mas abajo.
  if (player === null || token === null) {
    return errorResponse('Inicia sesión para guardar tus estadísticas.', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('El cuerpo de la petición no es válido.', 400);
  }

  const report = parseGameReport(body);
  if (report === null) {
    return errorResponse('El cuerpo de la petición no es válido.', 400);
  }

  const bucket = await reportBucket(token);
  if (!(await withinReportBudget(database, bucket))) {
    return errorResponse(
      'Demasiadas partidas en poco tiempo. Inténtalo más tarde.',
      429,
    );
  }

  const gameKey = await gameKeyFor(player.playerId, report);
  const nuevo = await acceptReport(database, player.playerId, gameKey);

  // El resumen vuelve en la misma respuesta. Sin el, quien sube una partida que
  // le bate su propio record tendria que hacer otra lectura para saberlo, y lo
  // logico de la portada depende de esa cifra: dos viajes para una sola
  // pregunta.
  //
  // En un informe repetido no hay nada que anotar ni que otorgar: se lee el
  // acumulado tal cual esta y se responde con la misma forma, para que quien
  // reintenta no pueda distinguir un duplicado de un exito ni notarlo.
  if (!nuevo) {
    return jsonResponse({
      autenticado: true,
      ...(await readStats(database, player.playerId)),
    });
  }

  const stats = await recordGame(database, player.playerId, report);
  await awardGame(database, player.playerId, report, gameKey, stats);
  return jsonResponse({ autenticado: true, ...stats });
};
