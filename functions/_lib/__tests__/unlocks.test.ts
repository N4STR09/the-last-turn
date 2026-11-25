// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../database';
import { sha256Hex } from '../digest';
import type { GameReport, StatsSummary } from '../stats';
import {
  COIN_CAP,
  REPORT_LIMIT,
  SHOP_CATALOG,
  acceptReport,
  awardGame,
  coinsFor,
  dueAchievements,
  dueCharacters,
  gameKeyFor,
  priceOf,
  purchaseObject,
  readProgression,
  reportBucket,
  withinReportBudget,
} from '../unlocks';
import { countRows, freshDatabase, readCell } from '../../__tests__/helpers/sqlite-database';

/**
 * La progresion de cuenta, contra SQLite de verdad.
 *
 * Aqui no se prueba el HTTP ni las cookies: se prueba lo que tiene que acertar
 * el nucleo. Que una partida repetida no otorga dos veces, que el techo de
 * monedas aguanta incluso ante el cuerpo mas grande que la validacion admite,
 * que dos cuentas no comparten filas, y que el freno de ritmo corta en el
 * tope y se reinicia solo cuando pasa la ventana.
 *
 * Todas las cuentas que escriben estas pruebas son de personas distintas. No
 * hay nada compartido entre ellas: `player_id` es el cajon de una sola.
 */

const JUGADOR = 'jugador-de-pruebas';
const OTRO = 'otra-cuenta';

/** Una partida bien escrita, para no repetirla en cada prueba. */
function partida(parcial: Partial<GameReport> = {}): GameReport {
  return { turns: 12, level: 2, difficulty: 'normal', seed: 4242, ...parcial };
}

/** Un acumulado vacio, para construir solo los campos que la prueba mira. */
function acumulado(parcial: Partial<StatsSummary> = {}): StatsSummary {
  return { bestTurns: null, gamesPlayed: 0, totalTurns: 0, hardestLevel: 0, ...parcial };
}

/** Una base con dos cuentas creadas y sin nada desbloqueado. */
async function cuentas(): Promise<Database> {
  const database = freshDatabase();
  await database.run(
    `INSERT INTO players (id, email, display_name, created_at, updated_at)
     VALUES (?, 'alguien@example.com', 'alguien', 1, 1)`,
    [JUGADOR],
  );
  await database.run(
    `INSERT INTO players (id, email, display_name, created_at, updated_at)
     VALUES (?, 'otra@example.com', 'otra', 1, 1)`,
    [OTRO],
  );
  return database;
}

let database: Database;

beforeEach(async () => {
  database = await cuentas();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('coinsFor', () => {
  const MONEDAS: ReadonlyArray<readonly ['normal' | 'agony', number, number]> = [
    ['normal', 0, 1],
    ['normal', 9, 1],
    ['normal', 10, 2],
    ['normal', 239, 24],
    ['normal', 240, 25],
    ['normal', 1_000_000, 25],
    ['agony', 0, 4],
    ['agony', 9, 4],
    ['agony', 10, 5],
    ['agony', 219, 25],
    ['agony', 220, 25],
    ['agony', 1_000_000, 25],
  ];

  it.each(MONEDAS)('con %s y %i turnos deja %i monedas', (dificultad, turnos, esperado) => {
    expect(coinsFor({ turns: turnos, level: 1, difficulty: dificultad })).toBe(esperado);
  });

  it('el techo corta tambien al que llega con el maximo de turnos', () => {
    // Sin el techo, el cuerpo peor que la validacion admite —un millon de
    // turnos— dejaria cien mil monedas. Con el, rinde lo que rinde una
    // partida larga de verdad.
    expect(coinsFor(partida({ turns: 1_000_000, difficulty: 'agony' }))).toBe(COIN_CAP);
    expect(COIN_CAP).toBe(25);
  });
});

describe('dueAchievements', () => {
  it('no da nada cuando no hay ninguna partida anotada', () => {
    expect(dueAchievements(partida(), acumulado())).toEqual([]);
  });

  it('da primera-partida en cuanto hay una', () => {
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 1 }))).toEqual([
      'primera-partida',
    ]);
  });

  it('sin marca todavia no hay logro de turnos, aunque el acumulado tenga partidas', () => {
    // `bestTurns` en `null` no es lo mismo que en cero: cero es una marca que
    // se alcanza, y ninguno de los dos umbrales la cruza.
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 3, bestTurns: 0 }))).toEqual([
      'primera-partida',
    ]);
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 3, bestTurns: 49 }))).toEqual([
      'primera-partida',
    ]);
  });

  it('cruza los dos umbrales de turnos con la mejor marca', () => {
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 1, bestTurns: 50 }))).toEqual([
      'primera-partida',
      'turno-50',
    ]);
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 1, bestTurns: 99 }))).toEqual([
      'primera-partida',
      'turno-50',
    ]);
    expect(dueAchievements(partida(), acumulado({ gamesPlayed: 1, bestTurns: 100 }))).toEqual([
      'primera-partida',
      'turno-50',
      'turno-100',
    ]);
  });

  it('agonia-50 se decide con la partida del informe, no con un acumulado', () => {
    // En la base no hay columna con la mejor marca en Agonia, asi que el
    // logro se gana el dia que se juega esa partida.
    expect(
      dueAchievements(
        partida({ difficulty: 'agony', turns: 50 }),
        acumulado({ gamesPlayed: 1, bestTurns: 50 }),
      ),
    ).toEqual(['primera-partida', 'turno-50', 'agonia-50']);

    expect(
      dueAchievements(
        partida({ difficulty: 'agony', turns: 49 }),
        acumulado({ gamesPlayed: 1, bestTurns: 49 }),
      ),
    ).toEqual(['primera-partida']);

    // Una marca de 50 en normal no gana el logro de Agonia.
    expect(dueAchievements(partida({ turns: 50 }), acumulado({ gamesPlayed: 1, bestTurns: 50 }))).toEqual(
      ['primera-partida', 'turno-50'],
    );
  });
});

describe('dueCharacters', () => {
  it('no da ningun personaje de umbral en una cuenta recien abierta', () => {
    expect(dueCharacters(partida(), acumulado())).toEqual([]);
    expect(dueCharacters(partida(), acumulado({ gamesPlayed: 9, totalTurns: 99 }))).toEqual([]);
  });

  it('veterano se decide con los turnos totales', () => {
    expect(dueCharacters(partida(), acumulado({ totalTurns: 99 }))).toEqual([]);
    expect(dueCharacters(partida(), acumulado({ totalTurns: 100 }))).toEqual(['veterano']);
  });

  it('insomne solo se gana jugando en Agonia', () => {
    expect(dueCharacters(partida({ difficulty: 'agony', turns: 50 }), acumulado())).toEqual([
      'insomne',
    ]);
    expect(dueCharacters(partida({ difficulty: 'agony', turns: 49 }), acumulado())).toEqual([]);
    expect(dueCharacters(partida({ turns: 50 }), acumulado())).toEqual([]);
  });

  it('huesped se decide con las partidas empezadas', () => {
    expect(dueCharacters(partida(), acumulado({ gamesPlayed: 10 }))).toEqual(['huesped']);
    expect(dueCharacters(partida(), acumulado({ gamesPlayed: 9 }))).toEqual([]);
  });

  it('los tres umbrales pueden llegar juntos', () => {
    expect(
      dueCharacters(
        partida({ difficulty: 'agony', turns: 50 }),
        acumulado({ gamesPlayed: 10, totalTurns: 100 }),
      ),
    ).toEqual(['veterano', 'insomne', 'huesped']);
  });
});

describe('gameKeyFor', () => {
  it('es la misma clave con la misma cuenta y la misma partida', async () => {
    const una = await gameKeyFor(JUGADOR, partida());
    const otra = await gameKeyFor(JUGADOR, partida());

    expect(una).toBe(otra);
  });

  it('es otra clave para otra cuenta, aunque la partida sea identica', async () => {
    // Esta es la linea que separa las monedas de dos personas: la clave lleva
    // el `player_id` dentro, asi que la misma semilla de dos cuentas no
    // comparte fila.
    expect(await gameKeyFor(JUGADOR, partida())).not.toBe(
      await gameKeyFor(OTRO, partida()),
    );
  });

  it.each<[keyof GameReport, GameReport]>([
    ['seed', partida({ seed: 1 })],
    ['turns', partida({ turns: 1 })],
    ['level', partida({ level: 1 })],
    ['difficulty', partida({ difficulty: 'agony' })],
  ])('es otra clave si cambia %s', async (_campo, variacion) => {
    const base = await gameKeyFor(JUGADOR, partida());
    const otra = await gameKeyFor(JUGADOR, variacion);

    expect(otra).not.toBe(base);
  });

  it('es un resumen de una sola direccion y no deja los datos en claro', async () => {
    const clave = await gameKeyFor(JUGADOR, partida({ seed: 4242 }));

    expect(clave).toMatch(/^[0-9a-f]{64}$/);
    expect(clave).not.toContain(JUGADOR);
    expect(clave).not.toContain('4242');
  });
});

describe('reportBucket', () => {
  it('es el mismo cubo con el mismo token', async () => {
    expect(await reportBucket('token-de-prueba')).toBe(await reportBucket('token-de-prueba'));
  });

  it('es otro cubo con otro token', async () => {
    expect(await reportBucket('token-de-prueba')).not.toBe(await reportBucket('otro-token'));
  });

  it('no es el hash del token tal cual, que es lo que cruzaria con la sesion', async () => {
    const token = 'token-de-prueba';
    const cubo = await reportBucket(token);

    expect(cubo).not.toBe(await sha256Hex(token));
    expect(cubo).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('withinReportBudget', () => {
  it('deja pasar los informes hasta el tope', async () => {
    const cubo = await reportBucket('token-de-prueba');

    for (let informe = 0; informe < REPORT_LIMIT; informe += 1) {
      expect(await withinReportBudget(database, cubo)).toBe(true);
    }
    expect(await withinReportBudget(database, cubo)).toBe(false);
  });

  it('los intentos rechazados cuentan, o un script seguiria probando', async () => {
    const cubo = await reportBucket('token-de-prueba');

    for (let informe = 0; informe <= REPORT_LIMIT; informe += 1) {
      await withinReportBudget(database, cubo);
    }

    expect(await readCell(database, 'SELECT reports FROM report_attempts')).toBe(
      REPORT_LIMIT + 1,
    );
    expect(await withinReportBudget(database, cubo)).toBe(false);
  });

  it('la ventana se reinicia sola cuando pasa el tiempo', async () => {
    const cubo = await reportBucket('token-de-prueba');
    const inicio = Date.now();
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(inicio);

    for (let informe = 0; informe <= REPORT_LIMIT; informe += 1) {
      await withinReportBudget(database, cubo);
    }
    expect(await withinReportBudget(database, cubo)).toBe(false);

    // La linea del `CASE` que reinicia: `ahora - window_start >= ventana`.
    reloj.mockReturnValue(inicio + 10 * 60 * 1000);

    expect(await withinReportBudget(database, cubo)).toBe(true);
    expect(await readCell(database, 'SELECT reports FROM report_attempts')).toBe(1);
  });

  it('cuenta por cubo, no en un cajon comun', async () => {
    const uno = await reportBucket('token-uno');
    const otro = await reportBucket('token-dos');

    for (let informe = 0; informe < REPORT_LIMIT; informe += 1) {
      await withinReportBudget(database, uno);
    }

    expect(await withinReportBudget(database, uno)).toBe(false);
    expect(await withinReportBudget(database, otro)).toBe(true);
    expect(await countRows(database, 'report_attempts')).toBe(2);
  });
});

describe('acceptReport', () => {
  it('acepta el primer informe y rechaza el mismo otra vez', async () => {
    const clave = await gameKeyFor(JUGADOR, partida());

    expect(await acceptReport(database, JUGADOR, clave)).toBe(true);
    expect(await acceptReport(database, JUGADOR, clave)).toBe(false);
    expect(await countRows(database, 'player_reports')).toBe(1);
  });

  it('otra partida distinta sigue cabiendo', async () => {
    expect(await acceptReport(database, JUGADOR, await gameKeyFor(JUGADOR, partida()))).toBe(true);
    expect(
      await acceptReport(database, JUGADOR, await gameKeyFor(JUGADOR, partida({ seed: 7 }))),
    ).toBe(true);
    expect(await countRows(database, 'player_reports')).toBe(2);
  });

  it('la misma partida de otra cuenta no se cruza', async () => {
    const clave = await gameKeyFor(JUGADOR, partida());

    expect(await acceptReport(database, JUGADOR, clave)).toBe(true);
    expect(await acceptReport(database, OTRO, clave)).toBe(true);
    expect(await countRows(database, 'player_reports')).toBe(2);
  });
});

describe('awardGame', () => {
  it('deja las monedas, el personaje por defecto y la primera partida', async () => {
    const report = partida();
    const clave = await gameKeyFor(JUGADOR, report);

    await awardGame(
      database,
      JUGADOR,
      report,
      clave,
      acumulado({ bestTurns: 12, gamesPlayed: 1, totalTurns: 12, hardestLevel: 2 }),
    );

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 2,
      unlocks: ['explorador'],
      achievements: ['primera-partida'],
      balance: 2,
      objects: [],
    });
  });

  it('repetir el mismo informe no duplica filas', async () => {
    const report = partida();
    const clave = await gameKeyFor(JUGADOR, report);
    const stats = acumulado({ bestTurns: 12, gamesPlayed: 1, totalTurns: 12, hardestLevel: 2 });

    await awardGame(database, JUGADOR, report, clave, stats);
    const primero = await readProgression(database, JUGADOR);

    await awardGame(database, JUGADOR, report, clave, stats);

    expect(await readProgression(database, JUGADOR)).toEqual(primero);
    expect(await countRows(database, 'player_unlocks')).toBe(4);
  });

  it('otra partida con otras cifras deja su propio fajo de monedas', async () => {
    const report = partida({ turns: 100, seed: 99 });
    const stats = acumulado({ bestTurns: 100, gamesPlayed: 2, totalTurns: 112, hardestLevel: 3 });

    await awardGame(database, JUGADOR, partida(), await gameKeyFor(JUGADOR, partida()), acumulado({
      bestTurns: 12,
      gamesPlayed: 1,
      totalTurns: 12,
      hardestLevel: 2,
    }));
    await awardGame(database, JUGADOR, report, await gameKeyFor(JUGADOR, report), stats);

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 2 + 11,
      unlocks: ['explorador', 'veterano'],
      achievements: ['primera-partida', 'turno-100', 'turno-50'],
      balance: 13,
      objects: [],
    });
  });

  it('una partida sin ningun umbral no escribe logros', async () => {
    // Este es el caso que alcanza la lista vacia de `insertUnlocks`: sin
    // partidas anotadas y sin marca, no hay nada que otorgar salvo el
    // personaje por defecto. La lista vacia no puede armarse como sentencia,
    // y el codigo se sale antes de intentarlo.
    await awardGame(database, JUGADOR, partida({ turns: 0, seed: 1 }), 'clave-sin-umbral', acumulado());

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 1,
      unlocks: ['explorador'],
      achievements: [],
      balance: 1,
      objects: [],
    });
  });

  it('cada cuenta se lleva las suyas con la misma partida', async () => {
    const report = partida();
    const clave = await gameKeyFor(JUGADOR, report);
    const stats = acumulado({ bestTurns: 12, gamesPlayed: 1, totalTurns: 12, hardestLevel: 2 });

    await awardGame(database, JUGADOR, report, clave, stats);
    await awardGame(database, OTRO, report, clave, stats);

    expect(await readProgression(database, JUGADOR)).toEqual(await readProgression(database, OTRO));
    // Ocho filas y no cuatro: la clave primaria es por cuenta, asi que la
    // moneda de uno no es la moneda del otro.
    expect(await countRows(database, 'player_unlocks')).toBe(8);
  });
});

describe('readProgression', () => {
  it('devuelve la coleccion vacia de una cuenta que nunca ha jugado', async () => {
    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 0,
      unlocks: [],
      achievements: [],
      balance: 0,
      objects: [],
    });
  });

  it('devuelve lo mismo para una cuenta que no esta en la base', async () => {
    expect(await readProgression(database, 'nadie')).toEqual({
      coins: 0,
      unlocks: [],
      achievements: [],
      balance: 0,
      objects: [],
    });
  });

  it('ordena cada coleccion, para que la respuesta se pueda comparar', async () => {
    // Una sola partida larga en Agonia cruza los cuatro umbrales a la vez, y
    // el orden que sale es el de `ORDER BY` y no el en que se escribieron:
    // `turno-100` va antes que `turno-50` porque el uno es menor que el cinco.
    const report = partida({ difficulty: 'agony', turns: 100, seed: 5 });
    await awardGame(
      database,
      JUGADOR,
      report,
      await gameKeyFor(JUGADOR, report),
      acumulado({ bestTurns: 100, gamesPlayed: 1, totalTurns: 100, hardestLevel: 3 }),
    );

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 14,
      unlocks: ['explorador', 'insomne', 'veterano'],
      achievements: ['agonia-50', 'primera-partida', 'turno-100', 'turno-50'],
      balance: 14,
      objects: [],
    });
  });

  it('el esquema rechaza un tipo de fila que no existe', async () => {
    // El unico sitio donde el esquema impone una regla de negocio. Si el
    // CHECK se fuera, un `kind` mal escrito formaria parte de una consulta
    // posterior y nadie lo notaria hasta ahi.
    await expect(
      database.run(
        `INSERT INTO player_unlocks (player_id, kind, id, obtained_at)
         VALUES (?, 'invitado', 'x', 1)`,
        [JUGADOR],
      ),
    ).rejects.toThrow();
    expect(await countRows(database, 'player_unlocks')).toBe(0);
  });
});

/**
 * Pone `cantidad` monedas de prueba en una cuenta, sin pasar por ninguna
 * partida. La tienda necesita un saldo que normalmente deja un informe, y aquí
 * lo que se prueba es la compra, no la fórmula de monedas —esa tiene sus
 * propias pruebas arriba—.
 */
async function darMonedas(playerId: string, cantidad: number): Promise<void> {
  const values = Array.from({ length: cantidad }, () => '(?, ?, ?, 1)').join(', ');
  const parameters = Array.from({ length: cantidad }, (_empty, index) => [
    playerId,
    'moneda',
    `moneda-prueba-${index}`,
  ]).flat();
  await database.run(
    `INSERT OR IGNORE INTO player_unlocks (player_id, kind, id, obtained_at) VALUES ${values}`,
    parameters,
  );
}

describe('el catálogo de la tienda', () => {
  it('es una lista cerrada con los seis precios aprobados', () => {
    expect(SHOP_CATALOG).toEqual({
      ceniza: 10,
      superviviente: 15,
      ambar: 20,
      oxido: 25,
      'calavera-doble': 30,
      nomada: 40,
    });
  });

  it('priceOf da el precio de lo que está en el catálogo', () => {
    expect(priceOf('ceniza')).toBe(10);
    expect(priceOf('calavera-doble')).toBe(30);
  });

  it('priceOf devuelve null de lo que no está, incluidas claves del prototipo', () => {
    expect(priceOf('inventado')).toBeNull();
    // `toString` no es una clave del catálogo, pero su valor tampoco es
    // `undefined`: viene de `Object.prototype`. Mirar «está definido» daría
    // una función como precio en lugar de no dar nada.
    expect(priceOf('toString')).toBeNull();
    expect(priceOf('constructor')).toBeNull();
  });
});

describe('purchaseObject', () => {
  it('escribe el objeto cuando el saldo llega', async () => {
    await darMonedas(JUGADOR, 10);

    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(true);

    const progression = await readProgression(database, JUGADOR);
    expect(progression.objects).toEqual(['ceniza']);
    expect(progression.coins).toBe(10);
    expect(progression.balance).toBe(0);
    expect(await countRows(database, 'player_unlocks', "WHERE kind = 'objeto'")).toBe(1);
  });

  it('no escribe nada cuando el saldo no llega', async () => {
    await darMonedas(JUGADOR, 9);

    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(false);

    const progression = await readProgression(database, JUGADOR);
    expect(progression.objects).toEqual([]);
    expect(progression.balance).toBe(9);
    expect(await countRows(database, 'player_unlocks', "WHERE kind = 'objeto'")).toBe(0);
  });

  it('repetir la compra con el saldo ya gastado no escribe ni descuenta dos veces', async () => {
    await darMonedas(JUGADOR, 10);

    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(true);
    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(false);

    const progression = await readProgression(database, JUGADOR);
    expect(progression.objects).toEqual(['ceniza']);
    expect(progression.balance).toBe(0);
    expect(await countRows(database, 'player_unlocks', "WHERE kind = 'objeto'")).toBe(1);
  });

  it('la repetición con saldo todavía disponible choca con la clave y no duplica', async () => {
    // El `OR IGNORE` es el otro lado de la idempotencia: cuando la comprobación
    // de saldo pasa pero la fila ya está, la sentencia choca con la clave
    // primaria y no escribe nada.
    await darMonedas(JUGADOR, 20);
    await purchaseObject(database, JUGADOR, 'ceniza');

    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(false);

    expect(await countRows(database, 'player_unlocks', "WHERE kind = 'objeto'")).toBe(1);
    expect((await readProgression(database, JUGADOR)).balance).toBe(10);
  });

  it('la segunda compra ya ve lo que gastó la primera', async () => {
    // La suma de lo gastado vive dentro de la sentencia que inserta: con 25
    // monedas caben ceniza (10) y superviviente (15), y un tercero se queda
    // fuera porque el saldo de la comprobación ya descuenta a los dos.
    await darMonedas(JUGADOR, 25);

    expect(await purchaseObject(database, JUGADOR, 'ceniza')).toBe(true);
    expect(await purchaseObject(database, JUGADOR, 'superviviente')).toBe(true);
    expect(await purchaseObject(database, JUGADOR, 'oxido')).toBe(false);

    const progression = await readProgression(database, JUGADOR);
    expect(progression.objects).toEqual(['ceniza', 'superviviente']);
    expect(progression.balance).toBe(0);
  });

  it('un id fuera del catálogo no toca la base', async () => {
    expect(await purchaseObject(database, JUGADOR, 'inventado')).toBe(false);
    expect(await countRows(database, 'player_unlocks')).toBe(0);
  });
});

describe('readProgression con la tienda', () => {
  it('el saldo resta los objetos comprados a las monedas ganadas', async () => {
    await darMonedas(JUGADOR, 30);
    await purchaseObject(database, JUGADOR, 'ambar');

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 30,
      unlocks: [],
      achievements: [],
      balance: 10,
      objects: ['ambar'],
    });
  });

  it('una fila de objeto fuera del catálogo no descuenta nada', async () => {
    // Solo se llega aquí escribiendo a mano, fuera de la ruta de la tienda: la
    // ruta solo inserta ids del catálogo. Un precio desconocido se valora en
    // cero, igual en la suma del cliente que en la sentencia del servidor.
    await darMonedas(JUGADOR, 5);
    await database.run(
      `INSERT INTO player_unlocks (player_id, kind, id, obtained_at)
       VALUES (?, 'objeto', 'fuera-del-catalogo', 1)`,
      [JUGADOR],
    );

    expect(await readProgression(database, JUGADOR)).toEqual({
      coins: 5,
      unlocks: [],
      achievements: [],
      balance: 5,
      objects: ['fuera-del-catalogo'],
    });
  });
});
