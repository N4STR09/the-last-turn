import { integerColumn, type Database, type Row } from './database';

/**
 * Las estadisticas agregadas de una cuenta, sin HTTP.
 *
 * Este archivo solo hace una cosa: meter enteros que declara el cliente en dos
 * tablas y devolver la suma. Eso es todo lo que guarda el juego de una persona,
 * y conviene que se lea en voz alta: **no guarda partidas.** Ni semillas, ni
 * registros, ni estado. Una partida muerta no se puede recuperar de aqui, y
 * tampoco se quiere: lo que se guarda es cuanto se llego y cuantas veces se
 * empezo, que son las dos preguntas de la portada.
 *
 * La regla que de verdad pesa aqui: **ningun entero que llegue de fuera puede
 * bajar un acumulado.** El mejor turno y el nivel mas duro se guardan con
 * `MAX`, y los acumulados solo suben sumando. El cliente manda cuantos turnos
 * sobrevivio y el servidor decide que significa eso para la fila; un cuerpo
 * escrito a mano que mande `-500` no puede dejar el total en negativo, porque
 * `-500` no pasa la validacion.
 *
 * Que el juego corra en el navegador quiere decir que cualquiera puede mandar
 * la marca que le dé gana: no hay servidor que lo impida, y no lo hay porque no
 * hay nada en juego. El limite de mas abajo no es una verdad sobre el juego,
 * es un freno contra el descuido: un cuerpo gigante no deberia poder ensuciar
 * un acumulado que nadie mas mira.
 *
 * **Las dificultades se escriben `normal` y `agony`, que son las mismas
 * letras que `src/game`.** No hay traduccion en la peticion ni en la base de
 * datos, y no la hay a proposito: un vocabulario solo evita la clase de error
 * en la que un lado escribe `agonia` y el otro espera `agony` y las dos cosas
 * acaban conviviendo en la misma columna.
 */

/** Lo que se devuelve al cliente: siempre lo completo, para que no haga falta un segundo viaje. */
export interface StatsSummary {
  /** La mejor marca. `null` todavia no ha jugado nada, que no es lo mismo que `0`. */
  readonly bestTurns: number | null;
  readonly gamesPlayed: number;
  readonly totalTurns: number;
  readonly hardestLevel: number;
}

/** Lo que el cliente declara de una partida. Tres enteros y una letra. */
export interface GameReport {
  readonly turns: number;
  readonly level: number;
  readonly difficulty: 'normal' | 'agony';
}

/**
 * Tope de cualquier entero que se acepte.
 *
 * Un millon de turnos son anos de partida y un millon de niveles es mas de lo
 * que el motor alcanza en ese tiempo. El numero no dice "aqui se juega"; dice
 * "lo que no cabe aqui esta mal escrito".
 */
const MAX_REPORTED = 1_000_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_REPORTED
  );
}

function isDifficulty(value: unknown): value is 'normal' | 'agony' {
  return value === 'normal' || value === 'agony';
}

/**
 * Lee las estadisticas de una cuenta.
 *
 * Devuelve el cajon vacio cuando no hay fila, que es lo que le pasa a una
 * cuenta recien creada. `bestTurns` es `null` y no `0` porque cero es una marca
 * que se puede alcanzar: la primera partida muerta en el primer turno deja
 * exactamente cero turnos sobrevividos, y decirle a la portada que el record es
 * cero le daria un "nuevo record" a cualquiera.
 */
export async function readStats(
  database: Database,
  playerId: string,
): Promise<StatsSummary> {
  const row = await database.first<Row>(
    `SELECT best_turns AS bestTurns,
            games_played AS gamesPlayed,
            total_turns AS totalTurns,
            hardest_level AS hardestLevel
       FROM player_stats
      WHERE player_id = ?`,
    [playerId],
  );

  if (row === null) {
    return { bestTurns: null, gamesPlayed: 0, totalTurns: 0, hardestLevel: 0 };
  }

  return {
    bestTurns: integerColumn(row, 'bestTurns'),
    gamesPlayed: integerColumn(row, 'gamesPlayed'),
    totalTurns: integerColumn(row, 'totalTurns'),
    hardestLevel: integerColumn(row, 'hardestLevel'),
  };
}

/**
 * Anota una partida y devuelve el acumulado ya actualizado.
 *
 * Se escriben dos filas y las dos hacen falta. La de `player_stats` es la
 * portada: record, partidas y turnos totales. La de `player_levels` es el
 * reparto por dificultad y nivel, que es lo que deja ver donde se muere; sin
 * ella, cada partida que no se guarda es una partida que no se puede contar
 * despues.
 *
 * **No hay transaccion entre las dos.** El puerto `Database` no expone una y
 * abrirlo solo para esto cambiaria sus tres operaciones por cuatro. Si la
 * segunda escritura fallara, quedaria una partida contada en la portada y sin
 * apuntar en su celda de nivel, que es un error de un partido de diferencia y
 * no de una cuenta; la siguiente partida lo empareja. Lo que si no puede
 * ocurrir es lo contrario, que el reparto suba y la portada no, porque la
 * portada se escribe primero.
 *
 * Devuelve el resumen leido de nuevo en vez de sumarlo en JavaScript: la suma
 * que ve el cliente tiene que ser la que la base de datos acaba de escribir, no
 * una reconstruccion que podria no coincidir si dos escrituras se cruzan.
 */
export async function recordGame(
  database: Database,
  playerId: string,
  report: GameReport,
): Promise<StatsSummary> {
  const now = Date.now();

  // `MAX` en lugar de una comparacion en JavaScript: la decision de no bajar
  // nunca se toma en el servidor y se escribe en la propia sentencia, para que
  // no haya forma de saltarsela cambiando el orden de dos llamadas.
  await database.run(
    `INSERT INTO player_stats
            (player_id, best_turns, games_played, total_turns, hardest_level, updated_at)
     VALUES (?, ?, 1, ?, ?, ?)
     ON CONFLICT (player_id) DO UPDATE SET
       best_turns = MAX(best_turns, excluded.best_turns),
       games_played = games_played + 1,
       total_turns = total_turns + excluded.total_turns,
       hardest_level = MAX(hardest_level, excluded.hardest_level),
       updated_at = excluded.updated_at`,
    [playerId, report.turns, report.turns, report.level, now],
  );

  await database.run(
    `INSERT INTO player_levels (player_id, difficulty, level, games)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (player_id, difficulty, level) DO UPDATE SET games = games + 1`,
    [playerId, report.difficulty, report.level],
  );

  return readStats(database, playerId);
}

/**
 * Valida lo que el cliente declara de una partida.
 *
 * Devuelve `null` ante cualquier cosa que no sea la forma esperada. No dice que
 * falto ni cual era el malo: quien recibe un `400` de una peticion que no tiene
 * sesion no gana nada sabiendo si el problema eran los turnos o la dificultad,
 * y el cliente que estas pruebas acompanan solo tiene una forma posible de
 * montar el cuerpo.
 */
export function parseGameReport(payload: unknown): GameReport | null {
  if (!isObject(payload)) {
    return null;
  }

  const turns = payload['turns'];
  if (!isCount(turns)) {
    return null;
  }

  const level = payload['level'];
  if (!isCount(level)) {
    return null;
  }

  const difficulty = payload['difficulty'];
  if (!isDifficulty(difficulty)) {
    return null;
  }

  return { turns, level, difficulty };
}
