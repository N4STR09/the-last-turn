/**
 * La progresión de una cuenta, sin HTTP.
 *
 * Monedas, personajes y logros salen de `player_unlocks`, que es una tabla de
 * filas y no de saldos: cada moneda es una fila, y contar filas no tiene nada
 * que restar, así que no hay doble gasto posible. Lo que hace este archivo es
 * decidir qué filas tocan y escribirlas con `INSERT OR IGNORE`, de modo que
 * repetir un informe vuelva a calcular lo mismo y vuelva a no escribir nada.
 *
 * Tres reglas atraviesan todo el archivo:
 *
 * **La identidad la pone el servidor.** El cliente manda los hechos de la
 * partida —turnos, nivel, dificultad, semilla— y jamás una cantidad, un id ni
 * un instante. La clave de un informe se deriva con el `player_id` de la
 * sesión resuelta dentro, así que ni siquiera dos cuentas que juegan la misma
 * semilla comparten fila.
 *
 * **Ningún premio depende del reloj.** Los umbrales son contadores: partidas,
 * turnos, mejores marcas. `obtained_at` se estampa con el reloj del servidor y
 * solo sirve para enseñar cuándo se ganó; mover ese reloj no desbloquea nada.
 *
 * **El ritmo se cuenta en SQL, no en JavaScript.** El mismo motivo que en
 * `_lib/throttle.ts`: entre leer el contador y escribirlo no puede caber otra
 * escritura, o dos informes a la vez se leerían el mismo número y perderían uno.
 */

import { integerColumn, type Database } from './database';
import { sha256Hex } from './digest';
import type { GameFacts, GameReport, StatsSummary } from './stats';

/** El tope de monedas que puede dejar una partida. */
export const COIN_CAP = 25;

/** Informes que caben en una ventana de ritmo, por sesión. */
export const REPORT_LIMIT = 60;

/** Cuanto dura la ventana de ritmo. */
export const REPORT_WINDOW_MS = 10 * 60 * 1000;

/** Lo que se devuelve al cliente: el saldo y las dos colecciones. */
export interface ProgressionSummary {
  /** Saldo en monedas, que es el recuento de filas `moneda`. */
  readonly coins: number;
  /** Personajes desbloqueados, ordenados. */
  readonly unlocks: readonly string[];
  /** Logros ganados, ordenados. */
  readonly achievements: readonly string[];
}

/**
 * Monedas que deja una partida.
 *
 * `1 + floor(turnos / 10)`, con tres de regalo por jugar en Agonía y con el
 * techo de {@link COIN_CAP}. El techo importa más que la fórmula: sin él, un
 * cuerpo que declare un millón de turnos —que pasa la validación, que admite
 * hasta un millón— dejaría un saldo de cien mil monedas. Con él, el peor
 * cuerpo posible rinde lo que rinde una partida larga de verdad.
 */
export function coinsFor(report: GameFacts): number {
  const base =
    1 + Math.floor(report.turns / 10) + (report.difficulty === 'agony' ? 3 : 0);
  return Math.min(COIN_CAP, base);
}

/**
 * Logros que tocan con este informe y este acumulado.
 *
 * Se calculan siempre contra el acumulado ya actualizado, que es el que
 * devuelve `recordGame`. Cada id se escribe con `INSERT OR IGNORE`, así que
 * volver a calcular los mismos no duplica nada: la fila ya está.
 *
 * `agonia-50` es de los que se deciden con la partida del informe y no con un
 * acumulado: en la base no hay una columna con la mejor marca en Agonía, y
 * añadirla por un logro no compensa. Se gana el día que se juega esa partida,
 * y la fila es la prueba de que ya se ganó.
 */
export function dueAchievements(report: GameFacts, stats: StatsSummary): string[] {
  const ids: string[] = [];
  if (stats.gamesPlayed >= 1) {
    ids.push('primera-partida');
  }
  if (stats.bestTurns !== null && stats.bestTurns >= 50) {
    ids.push('turno-50');
  }
  if (stats.bestTurns !== null && stats.bestTurns >= 100) {
    ids.push('turno-100');
  }
  if (report.difficulty === 'agony' && report.turns >= 50) {
    ids.push('agonia-50');
  }
  return ids;
}

/**
 * Personajes que tocan con este informe y este acumulado.
 *
 * `explorador` no aparece aquí porque no depende de nada: es el personaje por
 * defecto y se asegura en cada anotación. Los otros tres sí son umbrales, y
 * `veterano` se decide con los turnos totales y no con la mejor marca para que
 * no duplique el logro `turno-100` con la misma condición.
 */
export function dueCharacters(report: GameFacts, stats: StatsSummary): string[] {
  const ids: string[] = [];
  if (stats.totalTurns >= 100) {
    ids.push('veterano');
  }
  if (report.difficulty === 'agony' && report.turns >= 50) {
    ids.push('insomne');
  }
  if (stats.gamesPlayed >= 10) {
    ids.push('huesped');
  }
  return ids;
}

/**
 * La clave de un informe, derivada aquí y no mandada de fuera.
 *
 * Es un resumen de una sola dirección de la cuenta y de los hechos de la
 * partida. Un hash no se puede dar marcha atrás, así que la fila no regala ni
 * la semilla ni el tablero: solo dice «este informe ya se procesó». Meter
 * `player_id` dentro hace que dos cuentas con la misma partida tengan claves
 * distintas, que es lo que separa sus monedas.
 */
export async function gameKeyFor(
  playerId: string,
  report: GameReport,
): Promise<string> {
  return sha256Hex(
    `${playerId}|${report.seed}|${report.difficulty}|${report.turns}|${report.level}`,
  );
}

/**
 * El cubo con el que se cuentan los informes de una sesión.
 *
 * Es un resumen del token con un prefijo, no el hash de la sesión tal cual:
 * con el prefijo, la fila no se puede cruzar con `sessions` para averiguar qué
 * token abre qué cubo. Se cuenta por sesión y no por cuenta porque el freno
 * quiere frenar a quien manda peticiones, que es una sesión.
 */
export async function reportBucket(token: string): Promise<string> {
  return sha256Hex(`informe|${token}`);
}

/**
 * Cuenta un informe y dice si la sesión aún puede mandar.
 *
 * La ventana se reinicia sola dentro de la propia sentencia: si la anterior ya
 * pasó, el contador vuelve a uno con el instante nuevo; si no, sube uno. Los
 * intentos rechazados también cuentan, que es lo que impide a un script
 * probar sin parar mientras la ventana sigue abierta.
 *
 * Devuelve `false` al pasar el tope. Quien llama responde 429 y no sigue
 * escribiendo: el límite está para cortar, no para avisar.
 */
export async function withinReportBudget(
  database: Database,
  bucket: string,
): Promise<boolean> {
  const now = Date.now();
  const row = await database.first<{ reports: number }>(
    `INSERT INTO report_attempts (bucket, reports, window_start)
     VALUES (?, 1, ?)
     ON CONFLICT (bucket) DO UPDATE SET
       reports = CASE
         WHEN ? - window_start >= ? THEN 1
         ELSE reports + 1
       END,
       window_start = CASE
         WHEN ? - window_start >= ? THEN ?
         ELSE window_start
       END
     RETURNING reports`,
    [bucket, now, now, REPORT_WINDOW_MS, now, REPORT_WINDOW_MS, now],
  );
  return integerColumn(row, 'reports') <= REPORT_LIMIT;
}

/**
 * Anota un informe como procesado. `false` si ya lo estaba.
 *
 * Es la pieza que hace imposible el doble premio: la clave primaria de
 * `player_reports` decide sola, y en una sola sentencia. Dos peticiones
 * idénticas llegando a la vez no pueden pasar las dos: una inserta y la otra
 * choca y devuelve `null`, sin que ninguna de las dos haya leído nada antes.
 */
export async function acceptReport(
  database: Database,
  playerId: string,
  gameKey: string,
): Promise<boolean> {
  const row = await database.first(
    `INSERT INTO player_reports (player_id, game_key, reported_at)
     VALUES (?, ?, ?)
     ON CONFLICT (player_id, game_key) DO NOTHING
     RETURNING game_key`,
    [playerId, gameKey, Date.now()],
  );
  return row !== null;
}

/**
 * Escribe las filas que tocan por este informe.
 *
 * Se llama una sola vez, y solo si el informe era nuevo. Las monedas llevan la
 * clave de la partida en su id, así que hasta esa escritura se repite a sí
 * misma sin gastar: si la fila ya está, la ignora. Los logros y personajes
 * llevan su propio id fijo, que es el mismo mecanismo con otra forma.
 *
 * Los datos de entrada —`report` y `stats`— vienen de una sesión resuelta y de
 * una validación hecha en la ruta; aquí no se vuelve a mirar nada, porque no
 * hay nada que desconfiar que no se haya desconfiado ya.
 */
export async function awardGame(
  database: Database,
  playerId: string,
  report: GameReport,
  gameKey: string,
  stats: StatsSummary,
): Promise<void> {
  const now = Date.now();
  const monedas = Array.from(
    { length: coinsFor(report) },
    (_empty, index) => `moneda-${gameKey}-${index + 1}`,
  );
  await insertUnlocks(database, playerId, 'moneda', monedas, now);
  await insertUnlocks(
    database,
    playerId,
    'personaje',
    ['explorador', ...dueCharacters(report, stats)],
    now,
  );
  await insertUnlocks(
    database,
    playerId,
    'logro',
    dueAchievements(report, stats),
    now,
  );
}

/**
 * Inserta una lista de filas con `OR IGNORE`, de una sentencia.
 *
 * Una por moneda serían hasta veinticinco idas y vueltas a D1 por informe; en
 * una sola sentencia el motor decide cuáles ya estaban. Con la lista vacía no
 * se arma ninguna sentencia: `VALUES ()` no existe y el caso se alcanza de
 * verdad —un informe normal sin ningún umbral—, así que se sale antes.
 */
async function insertUnlocks(
  database: Database,
  playerId: string,
  kind: 'moneda' | 'personaje' | 'logro',
  ids: readonly string[],
  now: number,
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const values = ids.map(() => '(?, ?, ?, ?)').join(', ');
  const parameters = ids.flatMap((id) => [playerId, kind, id, now]);
  await database.run(
    `INSERT OR IGNORE INTO player_unlocks (player_id, kind, id, obtained_at)
     VALUES ${values}`,
    parameters,
  );
}

/**
 * Lee la colección entera de una cuenta.
 *
 * El orden sale de la consulta, no de JavaScript: `ORDER BY` sobre las dos
 * columnas deja cada colección ordenada y estable, que es lo que hace que la
 * respuesta pueda compararse de una carga a otra.
 */
export async function readProgression(
  database: Database,
  playerId: string,
): Promise<ProgressionSummary> {
  const rows = await database.all<{ kind: string; id: string }>(
    `SELECT kind, id FROM player_unlocks
      WHERE player_id = ?
      ORDER BY kind, id`,
    [playerId],
  );

  return {
    coins: rows.filter((row) => row.kind === 'moneda').length,
    unlocks: rows.filter((row) => row.kind === 'personaje').map((row) => row.id),
    achievements: rows.filter((row) => row.kind === 'logro').map((row) => row.id),
  };
}
