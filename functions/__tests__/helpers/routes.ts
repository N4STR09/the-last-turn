import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Row } from '../../_lib/database';

/**
 * Un D1 simulado para probar las rutas.
 *
 * Aqui si hace falta la imitacion, y por una razon distinta de la de las pruebas
 * del nucleo: las rutas reciben un `D1Database` que llega del entorno de
 * Cloudflare, y no hay forma de construir uno de verdad sin desplegar. Ademas no
 * se quiere: lo que hay que probar de las rutas es el cableado —que cookie
 * ponen, que codigo de estado devuelven, que rechazan— y no el SQL, que ya se
 * prueba contra SQLite de verdad en `functions/_lib/__tests__/accounts.test.ts`.
 *
 * Este D1 traduce las tres operaciones al mismo SQLite de siempre, con la
 * migracion aplicada. O sea, no es un doble de mentira: es el motor real debajo
 * de una envoltura con la forma de D1. Lo que se simula es el intermediario, no
 * la base de datos.
 */

const MIGRATION = join(import.meta.dirname, '..', '..', '..', 'migrations', '0001_cuentas.sql');

/**
 * Iteraciones con las que trabajan las pruebas de rutas.
 *
 * 5 000 es el suelo de `_lib/iterations.ts` y el valor por defecto del codigo: lo
 * mas bajo que la configuracion deja poner, y lo que de verdad se despliega. Las
 * pruebas lo usan tal cual para no cubrir el cableado con un numero que no
 * aparece en produccion. Lo que estas pruebas comprueban es el cableado, y el
 * hash en si ya se comprueba aparte en `password.test.ts`.
 */
export const TEST_ITERATIONS = '5000';

/**
 * El `client_id` con el que trabajan las pruebas del acceso con Google.
 *
 * No es un secreto ni lo finge de uno: el `client_id` de Google se publica en la
 * pagina como cualquier otro dato de configuracion. Lo que si es real es que
 * tiene que coincidir con el que se verifica, porque si la ruta comparara
 * contra otra cosa, todas las pruebas pasarian con un token emitido para
 * cualquier otro cliente, que es exactamente lo que no puede pasar.
 */
export const TEST_GOOGLE_CLIENT_ID = 'cliente-de-pruebas.apps.googleusercontent.com';

/** Crea un entorno de pruebas: una base nueva y el enlace que espera D1. */
export function testEnv(): {
  env: { DB: D1Database; PBKDF2_ITERATIONS: string; GOOGLE_CLIENT_ID: string };
  sqlite: DatabaseSync;
} {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(MIGRATION, 'utf8'));
  return {
    env: {
      DB: wrap(sqlite) as unknown as D1Database,
      PBKDF2_ITERATIONS: TEST_ITERATIONS,
      GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
    },
    sqlite,
  };
}

/**
 * Una peticion con cuerpo JSON, como la que mandaria el navegador.
 *
 * Pone `Sec-Fetch-Site: same-origin` porque asi llega de verdad, y porque
 * `isSameOrigin` lo usa para rechazar peticiones de otras paginas.
 */
export function post(url: string, cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request(`https://el-sitio.example${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      'cf-connecting-ip': '203.0.113.7',
      ...cabeceras,
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

/** Una peticion de lectura, con las mismas cabeceras que las de escritura. */
export function get(url: string, cabeceras: Record<string, string> = {}): Request {
  return new Request(`https://el-sitio.example${url}`, {
    headers: { 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '203.0.113.7', ...cabeceras },
  });
}

/**
 * El contexto que Pages Functions pasa a un manejador.
 *
 * Solo hacen falta `request` y `env`: ninguna de estas rutas lee nada mas del
 * contexto. El tipo real de Cloudflare trae ademas la ruta, `waitUntil`, `next` y
 * demas, que aqui no existen y que estas rutas no tocan, asi que el objeto se
 * construye con una conversion ahi. La conversion esta en un solo sitio y con un
 * comentario, en vez de repartirse por las pruebas, para que quede claro que la
 * limitacion es del doble de prueba y no de las rutas.
 */
export function contexto(request: Request, env: { DB: D1Database }): never {
  return { request, env } as unknown as never;
}

/** El valor de `Set-Cookie` de una respuesta, o `null` si no lo hay. */
export function cookieDe(respuesta: Response): string | null {
  return respuesta.headers.get('set-cookie');
}

/** El token que va dentro de la cookie de una respuesta, o `null`. */
export function tokenDe(respuesta: Response): string | null {
  const cabecera = cookieDe(respuesta);
  if (cabecera === null) {
    return null;
  }
  const par = cabecera.split(';')[0] ?? '';
  const igual = par.indexOf('=');
  return igual === -1 ? null : decodeURIComponent(par.slice(igual + 1));
}

function wrap(sqlite: DatabaseSync): unknown {
  return {
    prepare(sql: string) {
      const sentencia = sqlite.prepare(sql);
      return {
        bind(...parameters: unknown[]) {
          const entrada = parameters.map(coerce);
          return {
            async first<T>() {
              const row = sentencia.get(...entrada);
              return (row as T | undefined) ?? null;
            },
            async run() {
              sentencia.run(...entrada);
              return { success: true };
            },
            async all<T>() {
              return { results: sentencia.all(...entrada) as T[] };
            },
          };
        },
        async first<T>() {
          const row = sentencia.get();
          return (row as T | undefined) ?? null;
        },
        async run() {
          sentencia.run();
          return { success: true };
        },
        async all<T>() {
          return { results: sentencia.all() as T[] };
        },
      };
    },
  };
}

function coerce(value: unknown): null | number | bigint | string | Uint8Array {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'string' ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new Error(`Tipo no admitido como parametro de consulta: ${typeof value}`);
}

/** Reexportado para que las pruebas puedan tipar filas sin importing D1. */
export type { Row };