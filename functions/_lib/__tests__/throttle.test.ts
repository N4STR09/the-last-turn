// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '../database';
import {
  bucketFor,
  clearFailures,
  lockMinutes,
  lockedUntil,
  registerFailure,
  remainingMinutes,
  THRESHOLD,
} from '../throttle';
import { countRows, freshDatabase, readCell } from '../../__tests__/helpers/sqlite-database';

const DIRECCION = '203.0.113.7';
const CORREO = 'alguien@example.com';

/** Los minutos de cada escalón, en el orden en que se aplican. */
const ESCALONES: ReadonlyArray<readonly [fallos: number, minutos: number]> = [
  [4, 0],
  [5, 5],
  [9, 5],
  [10, 15],
  [14, 15],
  [15, 60],
  [19, 60],
  [20, 360],
  [99, 360],
];

let database: Database;
let cubo: string;

beforeEach(async () => {
  database = freshDatabase();
  cubo = await bucketFor(DIRECCION, CORREO);
});

describe('lockMinutes', () => {
  it.each(ESCALONES)(
    'con %i fallos bloquea %i minutos',
    (fallos, minutos) => {
      expect(lockMinutes(fallos)).toBe(minutos);
    },
  );

  it('no bloquea por debajo del umbral', () => {
    expect(lockMinutes(0)).toBe(0);
    expect(lockMinutes(THRESHOLD - 1)).toBe(0);
  });

  it('sube de golpe y a medida, nunca baja', () => {
    // El bloqueo no puede reducirse nunca. Si bajara, bastaria con esperar al
    // numero exacto que da un bloqueo corto para tener un hueco ilimitado.
    let anterior = 0;
    for (let fallos = 0; fallos <= 40; fallos += 1) {
      const actual = lockMinutes(fallos);
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });
});

describe('bucketFor', () => {
  it('es el mismo cubo con el correo en otra capitalizacion', async () => {
    expect(await bucketFor(DIRECCION, 'Alguien@EXAMPLE.com')).toBe(cubo);
  });

  it('es otro cubo con otra direccion', async () => {
    expect(await bucketFor('198.51.100.9', CORREO)).not.toBe(cubo);
  });

  it('es otro cubo con otro correo', async () => {
    expect(await bucketFor(DIRECCION, 'otro@example.com')).not.toBe(cubo);
  });

  it('no contiene ni la direccion ni el correo en claro', async () => {
    expect(cubo).not.toContain(DIRECCION);
    expect(cubo).not.toContain(CORREO);
    expect(cubo).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('registerFailure', () => {
  it('empieza en uno y sube de uno en uno', async () => {
    for (let intento = 1; intento <= 3; intento += 1) {
      await registerFailure(database, cubo);
      expect(await readCell(database, 'SELECT failures FROM login_attempts')).toBe(intento);
    }
  });

  it('no bloquea por debajo del umbral', async () => {
    for (let intento = 0; intento < THRESHOLD - 1; intento += 1) {
      expect(await registerFailure(database, cubo)).toBe(0);
    }

    expect(await readCell(database, 'SELECT failures FROM login_attempts')).toBe(THRESHOLD - 1);
    // Y `locked_until` sigue a NULL, no a cero: "sin bloqueo" y "bloqueado hasta
    // el epoch" son cosas distintas y la consulta distingue las dos.
    expect(await readCell(database, 'SELECT locked_until FROM login_attempts')).toBeNull();
  });

  it('bloquea en cuanto se alcanza el umbral', async () => {
    const espera: number[] = [];
    for (let intento = 0; intento < THRESHOLD; intento += 1) {
      espera.push(await registerFailure(database, cubo));
    }

    const esperaEnMinutos = espera.map((instante) => remainingMinutes(instante, Date.now()));
    expect(esperaEnMinutos.slice(0, -1)).toEqual([null, null, null, null]);
    expect(esperaEnMinutos[esperaEnMinutos.length - 1]).toBe(5);
  });

  it.each([
    [THRESHOLD, 5],
    [10, 15],
    [15, 60],
    [20, 360],
    [25, 360],
  ])('con %i fallos deja bloqueados %i minutos', async (fallos, minutos) => {
    for (let intento = 0; intento < fallos; intento += 1) {
      await registerFailure(database, cubo);
    }

    expect(remainingMinutes(await registerFailure(database, cubo), Date.now())).toBe(minutos);
  });

  /**
   * La prueba que sostiene que el `CASE` del SQL y `lockMinutes` son lo mismo.
   *
   * Son dos implementaciones de la misma escalera, y por eso existe esta
   * comparacion: si alguien cambia una y no la otra, una de las dos miente y
   * ninguna prueba individual lo notaria, porque cada una comprobaria solo su
   * mitad. Aqui se comparan las dos sobre el mismo numero de fallos.
   */
  it('aplica en el SQL la misma escalera que en el codigo', async () => {
    for (let fallos = 0; fallos <= 22; fallos += 1) {
      const uno = freshDatabase();
      const clave = await bucketFor(DIRECCION, `${fallos}@example.com`);

      for (let intento = 0; intento < fallos; intento += 1) {
        await registerFailure(uno, clave);
      }

      const desdeSql = remainingMinutes(await lockedUntil(uno, clave), Date.now());
      const desdeCodigo = remainingMinutes(Date.now() + lockMinutes(fallos) * 60 * 1000, Date.now());

      expect(desdeSql).toBe(desdeCodigo);
    }
  });

  it('crea la fila con el primer intento, sin borrarla entre medios', async () => {
    await registerFailure(database, cubo);
    await registerFailure(database, cubo);

    expect(await countRows(database, 'login_attempts')).toBe(1);
    expect(Number(await readCell(database, 'SELECT first_at FROM login_attempts'))).toBeGreaterThan(0);
  });

  it('el bloqueo vuelve a moverse cuando el numero de fallos sube de escalon', async () => {
    // El `CASE` recalcula en cada fallo, no solo al cruzar un escalon. Si se
    // guardara el bloqueo del primer cruce, alguien podria quedarse en cinco
    // minutos para siempre.
    const primer = await registerFailure(database, cubo);

    for (let intento = 0; intento < 25; intento += 1) {
      await registerFailure(database, cubo);
    }

    const ultimo = await lockedUntil(database, cubo);

    expect(ultimo).toBeGreaterThan(primer);
    expect(remainingMinutes(ultimo, Date.now())).toBe(360);
  });

  it('devuelve cero para un cubo que no ha fallado nunca', async () => {
    expect(await registerFailure(freshDatabase(), await bucketFor(DIRECCION, 'nuevo'))).toBe(0);
  });
});

describe('lockedUntil', () => {
  it('es cero cuando no hay fila', async () => {
    expect(await lockedUntil(database, 'cubo-que-no-existe')).toBe(0);
  });

  it('es cero cuando la fila existe pero no esta bloqueada', async () => {
    await registerFailure(database, cubo);

    expect(await lockedUntil(database, cubo)).toBe(0);
  });
});

describe('clearFailures', () => {
  it('borra la fila, y con ella el bloqueo', async () => {
    for (let intento = 0; intento < 10; intento += 1) {
      await registerFailure(database, cubo);
    }
    expect(await lockedUntil(database, cubo)).toBeGreaterThan(Date.now());

    await clearFailures(database, cubo);

    expect(await countRows(database, 'login_attempts')).toBe(0);
    expect(await lockedUntil(database, cubo)).toBe(0);
  });

  it('no falla si la fila no existe', async () => {
    await expect(clearFailures(database, 'cubo-que-no-existe')).resolves.toBeUndefined();
  });

  it('deja el contador empezar de cero otra vez', async () => {
    for (let intento = 0; intento < 25; intento += 1) {
      await registerFailure(database, cubo);
    }
    await clearFailures(database, cubo);

    // Sin esto, un acceso correcto seguido de cinco errores volveria a dejar a
    // alguien bloqueado seis horas por haberte-equivocado-una-vez-mas.
    for (let intento = 0; intento < THRESHOLD - 1; intento += 1) {
      expect(await registerFailure(database, cubo)).toBe(0);
    }
  });

  it('solo borra el cubo que se le pasa', async () => {
    const otro = await bucketFor(DIRECCION, 'otro@example.com');
    await registerFailure(database, cubo);
    await registerFailure(database, otro);

    await clearFailures(database, cubo);

    expect(await countRows(database, 'login_attempts')).toBe(1);
    expect(await readCell(database, 'SELECT failures FROM login_attempts')).toBe(1);
  });
});

describe('remainingMinutes', () => {
  it('es null cuando el bloqueo ya paso', () => {
    const ahora = Date.now();

    expect(remainingMinutes(ahora, ahora)).toBeNull();
    expect(remainingMinutes(ahora - 1, ahora)).toBeNull();
  });

  it('redondea hacia arriba, para no prometer menos de lo que hay', () => {
    const ahora = Date.now();

    // Un minuto y medio se dice "2 minutos", no "1 minuto": prometer uno cuando
    // quedan uno y medio hace que quien espere se encuentre con el bloqueo
    // puesto otra vez.
    expect(remainingMinutes(ahora + 90_000, ahora)).toBe(2);
    expect(remainingMinutes(ahora + 60_000, ahora)).toBe(1);
    expect(remainingMinutes(ahora + 1, ahora)).toBe(1);
  });

  it('da el numero exacto de minutos de un bloqueo entero', () => {
    const ahora = Date.now();

    expect(remainingMinutes(ahora + 5 * 60_000, ahora)).toBe(5);
    expect(remainingMinutes(ahora + 360 * 60_000, ahora)).toBe(360);
  });
});