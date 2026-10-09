/**
 * El puerto por el que el servidor habla con la base de datos.
 *
 * No es una abstraccion por gusto. Es lo mismo que hace el motor con el azar:
 * el motor no llama a `Math.random`, recibe una fuente de azar, y por eso se
 * puede probar una partida entera con una secuencia que se conoce. Aqui la
 * base de datos se recibe, y por eso las pruebas pueden usar SQLite de verdad
 * (el mismo motor que usa D1) en lugar de una imitación que solo sabe responder
 * a lo que se le ocurre a quien escribe la prueba.
 *
 * D1 tiene tres operaciones y una rareza que hay que conocer: no acepta `?` en
 * la posicion de un `SELECT` de varias filas de la forma que se espera, y
 * devuelve `null` en vez de lanzar cuando no hay nada. Las tres quedan
 * escondidas detras de este puerto para que el codigo que escribe SQL no tenga
 * que acordarse de ellas.
 */

/** Una fila, con las columnas tal cual las devuelve el motor. */
export type Row = Record<string, unknown>;

/** Parameters que se pueden pasar a una sentencia. */
export type Parameters = readonly unknown[];

/**
 * Lo que necesita el codigo del servidor de la base de datos.
 *
 * `first` devuelve una fila o `null`. `run` no devuelve filas, solo el exito.
 * `all` devuelve cero o mas filas.
 */
export interface Database {
  first<RowType extends Row>(sql: string, parameters?: Parameters): Promise<RowType | null>;
  run(sql: string, parameters?: Parameters): Promise<void>;
  all<RowType extends Row>(sql: string, parameters?: Parameters): Promise<RowType[]>;
}

/**
 * Envoltura de D1.
 *
 * Los parametros se pasan siempre como lista, nunca interpolados en el texto.
 * No hay ningun sitio en este proyecto donde una sentencia se arme con un
 * valor, y por eso no hace falta escapar ni citar nada: si algun dia hiciera
 * falta, la regla seria que eso no se puede hacer.
 */
export function bindD1(database: D1Database): Database {
  return {
    async first<RowType extends Row>(
      sql: string,
      parameters: Parameters = [],
    ): Promise<RowType | null> {
      const statement = bind(database.prepare(sql), parameters);
      return statement.first<RowType>();
    },
    async run(sql: string, parameters: Parameters = []): Promise<void> {
      const statement = bind(database.prepare(sql), parameters);
      await statement.run();
    },
    async all<RowType extends Row>(
      sql: string,
      parameters: Parameters = [],
    ): Promise<RowType[]> {
      const statement = bind(database.prepare(sql), parameters);
      const result = await statement.all<RowType>();
      return result.results;
    },
  };
}

function bind(statement: D1PreparedStatement, parameters: Parameters): D1PreparedStatement {
  return parameters.length === 0 ? statement : statement.bind(...parameters);
}

/**
 * Lee una columna de una fila y la devuelve como entero.
 *
 * Los enteros llegan como `number` en D1 y como `number` en SQLite, pero tambien
 * como `bigint` cuando el valor es grande, y como `string` en algunos casos.
 * Convertir en un solo sitio evita el `Number(...)` repetido por todas partes,
 * que es donde suelen aparecer los `NaN` silenciosos.
 */
export function integerColumn(row: Row | null, column: string): number {
  const value = row?.[column];
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lee una columna de texto.
 *
 * `null` cuando no hay fila o la columna es nula, que es lo que el esquema
 * significa con `password_hash` en una cuenta que solo entra con Google.
 */
export function textColumn(row: Row | null, column: string): string | null {
  const value = row?.[column];
  return typeof value === 'string' ? value : null;
}