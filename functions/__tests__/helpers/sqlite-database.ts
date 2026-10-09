import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Database, Row } from '../../_lib/database';

/**
 * Una base de datos de pruebas que es SQLite de verdad.
 *
 * No es una imitación de D1: es el mismo motor que usa D1, con el archivo de
 * migracion real aplicado encima. Las pruebas de esquema ya hacen esto, y aqui
 * se reutiliza la misma idea para las cuentas.
 *
 * Lo que se gana es concreto. Una imitación obliga a decidir, al escribir cada
 * prueba, que respuesta va a devolver cada sentencia. Con SQLite no hay que
 * decidir nada: la sentencia se ejecuta y el motor responde lo que responderia en
 * produccion, incluidos los `UNIQUE` que lanzan y el `CASCADE` que borra. Si una
 * consulta esta mal escrita, la prueba falla aqui y no en produccion.
 */

const MIGRATION = join(import.meta.dirname, '..', '..', '..', 'migrations', '0001_cuentas.sql');

/** Una base de datos nueva con el esquema aplicado. */
export function freshDatabase(): Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(MIGRATION, 'utf8'));
  return wrap(sqlite);
}

/**
 * El adaptador de Node sobre SQLite, con la misma forma que el de D1.
 *
 * Los parametros llegan como lista, igual que en D1. La conversion de tipos es
 * la parte que hay que mirar: SQLite devuelve los enteros grandes como `bigint`
 * y D1 devuelve `null` en vez de lanzar cuando una sentencia no da filas, y las
 * dos cosas hay que igualarlas aqui para que una prueba que pasa signifique lo
 * mismo en los dos sitios.
 */
function wrap(sqlite: DatabaseSync): Database {
  return {
    async first<RowType extends Row>(
      sql: string,
      parameters: readonly unknown[] = [],
    ): Promise<RowType | null> {
      const row = sqlite.prepare(sql).get(...toInputs(parameters));
      return (row as RowType | undefined) ?? null;
    },
    async run(sql: string, parameters: readonly unknown[] = []): Promise<void> {
      sqlite.prepare(sql).run(...toInputs(parameters));
    },
    async all<RowType extends Row>(
      sql: string,
      parameters: readonly unknown[] = [],
    ): Promise<RowType[]> {
      return sqlite.prepare(sql).all(...toInputs(parameters)) as RowType[];
    },
  };
}

/**
 * Convierte los parametros del puerto a lo que SQLite admite.
 *
 * El puerto dice `unknown` porque en el nucleo de las cuentas los parametros son
 * lo que sea que venga de la validacion, y tightenlo ahi obligaria a repetir la
 * conversion en cada sentencia. Aqui se hace una vez y se comprueba: un tipo que
 * no se puede convertir lanza, en lugar de convertirse en `null` en silencio y
 * hacer que un filtro de la consulta compare siempre con nada.
 */
function toInputs(parameters: readonly unknown[]): SqlInput[] {
  return parameters.map((value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
      return value;
    }
    if (value instanceof Uint8Array) {
      return value;
    }
    throw new Error(`Tipo no admitido como parametro de consulta: ${typeof value}`);
  });
}

/** Lo que `node:sqlite` acepta en un `?`. */
type SqlInput = null | number | bigint | string | Uint8Array;

/**
 * Cuenta filas.
 *
 * Sale de una consulta y no de una cuenta en JavaScript porque el objetivo es
 * comprobar que el SQL hizo lo que dice, y contar en JavaScript comprobaria que
 * JavaScript sabe contar.
 */
export async function countRows(
  database: Database,
  table: string,
  where = '',
  parameters: readonly unknown[] = [],
): Promise<number> {
  const row = await database.first<{ total: number }>(
    `SELECT count(*) AS total FROM ${table} ${where}`,
    parameters,
  );
  return Number(row?.['total'] ?? 0);
}

/**
 * Lee una columna de una fila, o `null`.
 *
 * Para las pruebas que necesitan mirar dentro de una fila que el nucleo no
 * devuelve. Devolver un mapa entero de una fila seria una superficie de la que
 * nadie sabe cuanto es justo.
 */
export async function readCell(
  database: Database,
  sql: string,
  parameters: readonly unknown[] = [],
): Promise<unknown> {
  const row = await database.first(sql, parameters);
  if (row === null) {
    return null;
  }
  return Object.values(row)[0] ?? null;
}