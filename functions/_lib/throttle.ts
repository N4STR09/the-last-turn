/**
 * Intentos fallidos y bloqueo.
 *
 * Sin esto, PBKDF2 no protege de un ataque de fuerza bruta: solo pone una lupa
 * sobre lo lento que es probar contrasenas, pero el atacante puede probarlas en
 * paralelo desde muchos sitios. El limite hay que ponerlo en algun sitio, y el
 * unico sitio que hay es aqui.
 *
 * Se cuenta por par (direccion, correo). Solo por correo permitiria bloquear la
 * cuenta de otra persona a base de fallar desde cualquier maquina, que es un modo
 * de denial of service tan facil de montar como de apuntar. Solo por direccion
 * dejaria pasar a un atacante con muchas maquinas. Las dos cosas juntas: atacar
 * mucho una cuenta desde una maquina se nota, y desde muchas maquinas la misma
 * cuenta tambien.
 *
 * La direccion IP se guarda hasheada, no en claro. Es el unico sitio del
 * proyecto donde tocaria una IP, y guardarla en claro seria un dato personal
 * mas, con su propia proteccion y su propia razon para no recogerlo.
 */

import { normalizeEmail } from './accounts';
import { integerColumn, type Database } from './database';
import { sha256Hex } from './digest';

/**
 * La escalera de bloqueo: a partir de cuantos intentos, y por cuanto tiempo.
 *
 * Esta tabla es la unica definicion del bloqueo. La usan dos cosas, el calculo en
 * TypeScript y el `CASE` del SQL, y salen las dos de aqui. Escribirla dos veces a
 * mano acabaria con una escalera en el codigo y otra en la consulta, que es como
 * un bloqueo deja de aplicarse sin que ninguna prueba falle: cada una comprobaria
 * la suya.
 *
 * Va de mayor a menor porque se busca el primer escalon que alcance el contador.
 * Los cinco primeros intentos salen gratis: casi siempre son un error de tecleo, y
 * castigar a alguien por escribir mal cinco veces su contrasena es una molestia.
 */
/** Intentos antes de empezar a bloquear. */
export const THRESHOLD = 5;

const LOCK_LADDER: ReadonlyArray<readonly [failures: number, minutes: number]> = [
  [20, 360],
  [15, 60],
  [10, 15],
  [THRESHOLD, 5],
];

const MS_PER_MINUTE = 60 * 1000;

/**
 * Cuanto se bloquea a partir de ese numero de intentos.
 *
 * Cero significa que no se bloquea todavia. No hay ningun otro valor que
 * signifique "caducado": un bloqueo que ya paso lo dice la fecha, no esta funcion.
 */
export function lockMinutes(failures: number): number {
  for (const [limit, minutes] of LOCK_LADDER) {
    if (failures >= limit) {
      return minutes;
    }
  }
  return 0;
}

/**
 * El `CASE` que aplica la misma escalera dentro del SQL.
 *
 * Sale de {@link LOCK_LADDER} y no de una copia escrita a mano, asi que no puede
 * desviarse de {@link lockMinutes}. Los `?` intercalados son el instante actual:
 * uno por escalon, porque en la sentencia final hay que pasar uno por cada marca,
 * y contarlos a mano es la forma facil de equivocarse y de que la consulta falle
 * en produccion con un error de "numero de parametros".
 *
 * Se genera una vez al cargar el modulo, no en cada fallo de inicio de sesion.
 */
function lockCase(): string {
  return LOCK_LADDER.map(
    ([limit, minutes]) =>
      `WHEN failures + 1 >= ${limit} THEN ? + ${minutes * MS_PER_MINUTE}`,
  ).join('\n         ');
}

/** Cuantos parametros lleva el `CASE`, uno por escalon. */
const LOCK_CASE_PARAMETERS = LOCK_LADDER.length;

/**
 * La clave con la que se guarda el contador.
 *
 * Es un resumen de direccion y correo unidos. El correo va normalizado, asi que
 * `Alguien@Example.com` y `alguien@example.com` cuentan como la misma cuenta.
 */
export async function bucketFor(address: string, email: string): Promise<string> {
  return sha256Hex(`${address}|${normalizeEmail(email)}`);
}

/** Cuando termina el bloqueo de un cubo, o cero si no esta bloqueado. */
export async function lockedUntil(database: Database, bucket: string): Promise<number> {
  const row = await database.first(
    'SELECT locked_until FROM login_attempts WHERE bucket = ?',
    [bucket],
  );
  if (row === null) {
    return 0;
  }
  return integerColumn(row, 'locked_until');
}

/**
 * Suma un fallo y devuelve hasta cuando queda bloqueado.
 *
 * Devuelve cero si este fallo todavia no activa el bloqueo, que es el mismo
 * cero que devuelve `lockedUntil` para un cubo que no existe. Quien llama no
 * necesita distinguir "no bloqueado todavia" de "nunca se bloqueo": en los dos
 * casos puede volver a intentarlo.
 */
export async function registerFailure(
  database: Database,
  bucket: string,
): Promise<number> {
  const now = Date.now();

  // El contador sube y el bloqueo se calcula en la misma sentencia, y no por
  // gusto. Si el contador se leyera, se sumara en JavaScript y luego se
  // escribiera, dos peticiones simultaneas podrian leer el mismo numero, escribir
  // el mismo numero mas uno y perderse un intento entre las dos: el bloqueo
  // llegaria un fallo mas tarde de lo que deberia y con el ritmo justo que se
  // quiere evitar. Aqui el `+ 1` lo hace el motor, que no puede intercalar otra
  // escritura entre leer y escribir.
  //
  // Todas las ramas del `CASE` leen `failures + 1` contra la fila anterior, no
  // contra lo que escriban las ramas de arriba: el motor evalua a la vez todo el
  // `SET`. Es justo lo que hace falta, porque las cuatro ramas tienen que ver el
  // mismo contador y no una cadena de valores ya incrementados.
  const row = await database.first<{ failures: number; locked_until: number | null }>(
    `INSERT INTO login_attempts (bucket, failures, first_at, locked_until)
     VALUES (?, 1, ?, NULL)
     ON CONFLICT (bucket)
     DO UPDATE SET
       failures = failures + 1,
       locked_until = CASE
         ${lockCase()}
         ELSE NULL
       END
     RETURNING failures, locked_until`,
    [bucket, now, ...Array<number>(LOCK_CASE_PARAMETERS).fill(now)],
  );

  return integerColumn(row, 'locked_until');
}

/** Borra el contador. Se llama cuando el acceso va bien. */
export async function clearFailures(database: Database, bucket: string): Promise<void> {
  await database.run('DELETE FROM login_attempts WHERE bucket = ?', [bucket]);
}

/**
 * Un mensaje de espera legible, o `null` si no hay bloqueo.
 *
 * Redondea hacia arriba a minutos enteros. Decir "quedan 4,7 minutos" no ayuda a
 * nadie; "quedan 5 minutos" es un numero con el que se puede hacer cuentas.
 */
export function remainingMinutes(lockedUntil: number, now: number): number | null {
  if (lockedUntil <= now) {
    return null;
  }
  return Math.ceil((lockedUntil - now) / MS_PER_MINUTE);
}