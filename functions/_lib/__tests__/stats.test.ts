// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '../database';
import { parseGameReport, readStats, recordGame } from '../stats';
import { countRows, freshDatabase, readCell } from '../../__tests__/helpers/sqlite-database';

/**
 * Las estadisticas de cuenta, contra SQLite de verdad.
 *
 * Aqui no se prueba la reparticion del tiempo ni los errores de acceso: se
 * prueba lo unico que este modulo tiene que acertar, que un entero declarado
 * por alguien de fuera no puede bajar un acumulado, y que la celda de cada
 * partida cae donde dice su dificultad.
 *
 * Todas las partidas que escriben estas pruebas son de la misma persona. No
 * hay estadisticas compartidas en este juego, ni tabla de puntuaciones, ni
 * nadie que mire las tuyas: `player_id` no es un ranking, es tu cajon.
 */

const JUGADOR = 'jugador-de-pruebas';

/** Una base con una cuenta creada y sin ninguna partida registrada. */
async function cuenta(): Promise<Database> {
  const database = freshDatabase();
  await database.run(
    `INSERT INTO players (id, email, display_name, created_at, updated_at)
     VALUES (?, 'alguien@example.com', 'alguien', 1, 1)`,
    [JUGADOR],
  );
  return database;
}

let database: Database;

beforeEach(async () => {
  database = await cuenta();
});

describe('readStats', () => {
  it('devuelve el cajon vacio de una cuenta que nunca ha jugado', async () => {
    expect(await readStats(database, JUGADOR)).toEqual({
      bestTurns: null,
      gamesPlayed: 0,
      totalTurns: 0,
      hardestLevel: 0,
    });
  });

  it('devuelve lo mismo para una cuenta que no esta en la base', async () => {
    expect(await readStats(database, 'nadie')).toEqual({
      bestTurns: null,
      gamesPlayed: 0,
      totalTurns: 0,
      hardestLevel: 0,
    });
  });

  it('lee lo que dejo una partida', async () => {
    await recordGame(database, JUGADOR, { turns: 12, level: 2, difficulty: 'normal' });

    expect(await readStats(database, JUGADOR)).toEqual({
      bestTurns: 12,
      gamesPlayed: 1,
      totalTurns: 12,
      hardestLevel: 2,
    });
  });
});

describe('recordGame', () => {
  it('la primera partida abre el acumulado', async () => {
    const resumen = await recordGame(database, JUGADOR, {
      turns: 7,
      level: 1,
      difficulty: 'agony',
    });

    expect(resumen).toEqual({
      bestTurns: 7,
      gamesPlayed: 1,
      totalTurns: 7,
      hardestLevel: 1,
    });
  });

  it('cuenta una partida mas con cada llamada', async () => {
    await recordGame(database, JUGADOR, { turns: 7, level: 1, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 9, level: 1, difficulty: 'normal' });

    const resumen = await readStats(database, JUGADOR);
    expect(resumen.gamesPlayed).toBe(2);
    expect(resumen.totalTurns).toBe(16);
  });

  it('una marca peor no baja la mejor', async () => {
    await recordGame(database, JUGADOR, { turns: 40, level: 3, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 9, level: 1, difficulty: 'normal' });

    const resumen = await readStats(database, JUGADOR);
    expect(resumen.bestTurns).toBe(40);
    expect(resumen.hardestLevel).toBe(3);
  });

  it('una marca mejor la sube', async () => {
    await recordGame(database, JUGADOR, { turns: 40, level: 3, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 41, level: 4, difficulty: 'normal' });

    const resumen = await readStats(database, JUGADOR);
    expect(resumen.bestTurns).toBe(41);
    expect(resumen.hardestLevel).toBe(4);
  });

  it('acepta una partida de cero turnos sin romper la marca', async () => {
    // Es posible morir en el primer turno, y entonces lo sobrevivido es cero.
    // Cero es un valor honesto, no un "todavia no hay marca": por eso `bestTurns`
    // distingue `null` de `0`.
    await recordGame(database, JUGADOR, { turns: 0, level: 0, difficulty: 'normal' });

    expect(await readStats(database, JUGADOR)).toEqual({
      bestTurns: 0,
      gamesPlayed: 1,
      totalTurns: 0,
      hardestLevel: 0,
    });
  });

  it('anota la partida en su nivel y su dificultad', async () => {
    await recordGame(database, JUGADOR, { turns: 7, level: 2, difficulty: 'normal' });

    expect(await countRows(database, 'player_levels')).toBe(1);
    expect(
      await readCell(
        database,
        'SELECT games FROM player_levels WHERE player_id = ? AND difficulty = ? AND level = ?',
        [JUGADOR, 'normal', 2],
      ),
    ).toBe(1);
  });

  it('acumula cuando se repite la misma celda', async () => {
    await recordGame(database, JUGADOR, { turns: 7, level: 2, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 3, level: 2, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 5, level: 2, difficulty: 'normal' });

    expect(
      await readCell(
        database,
        'SELECT games FROM player_levels WHERE player_id = ? AND difficulty = ? AND level = ?',
        [JUGADOR, 'normal', 2],
      ),
    ).toBe(3);
    expect(await countRows(database, 'player_levels')).toBe(1);
  });

  it('mantiene separadas las dificultades', async () => {
    await recordGame(database, JUGADOR, { turns: 7, level: 2, difficulty: 'normal' });
    await recordGame(database, JUGADOR, { turns: 7, level: 2, difficulty: 'agony' });

    expect(await countRows(database, 'player_levels')).toBe(2);
    expect(
      await readCell(
        database,
        'SELECT games FROM player_levels WHERE difficulty = ?',
        ['agony'],
      ),
    ).toBe(1);
  });

  it('mantiene separadas las cuentas', async () => {
    await database.run(
      `INSERT INTO players (id, email, display_name, created_at, updated_at)
       VALUES ('otra', 'otra@example.com', 'otra', 1, 1)`,
    );
    await recordGame(database, JUGADOR, { turns: 7, level: 2, difficulty: 'normal' });
    await recordGame(database, 'otra', { turns: 7, level: 2, difficulty: 'normal' });

    expect((await readStats(database, JUGADOR)).gamesPlayed).toBe(1);
    expect((await readStats(database, 'otra')).gamesPlayed).toBe(1);
    expect(await countRows(database, 'player_stats')).toBe(2);
  });
});

describe('parseGameReport', () => {
  it('acepta una partida bien escrita', () => {
    expect(parseGameReport({ turns: 12, level: 3, difficulty: 'normal' })).toEqual({
      turns: 12,
      level: 3,
      difficulty: 'normal',
    });
    expect(parseGameReport({ turns: 0, level: 0, difficulty: 'agony' })).toEqual({
      turns: 0,
      level: 0,
      difficulty: 'agony',
    });
  });

  it.each<[string, unknown]>([
    ['un texto', 'una frase cualquiera'],
    ['un numero', 12],
    ['una lista', [1, 2, 3]],
    ['nada', null],
    ['undefined', undefined],
  ])('rechaza un cuerpo que es %s', (_nombre, cuerpo) => {
    expect(parseGameReport(cuerpo)).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ['falta', {}],
    ['no es numero', { turns: '12' }],
    ['no es entero', { turns: 12.5 }],
    ['es negativo', { turns: -1 }],
    ['es enorme', { turns: 1_000_001 }],
  ])('rechaza un turno que %s', (_nombre, parcial) => {
    const cuerpo = { level: 1, difficulty: 'normal', ...parcial };
    expect(parseGameReport(cuerpo)).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ['falta', {}],
    ['no es numero', { level: '3' }],
    ['no es entero', { level: 3.5 }],
    ['es negativo', { level: -3 }],
    ['es enorme', { level: 1_000_001 }],
  ])('rechaza un nivel que %s', (_nombre, parcial) => {
    const cuerpo = { turns: 12, difficulty: 'normal', ...parcial };
    expect(parseGameReport(cuerpo)).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ['falta', {}],
    ['no es de este juego', { difficulty: 'brutal' }],
    ['esta en espanol', { difficulty: 'agonia' }],
  ])('rechaza una dificultad que %s', (_nombre, parcial) => {
    const cuerpo = { turns: 12, level: 3, ...parcial };
    expect(parseGameReport(cuerpo)).toBeNull();
  });

  it('rechaza campos de mas sin importarlos', () => {
    expect(
      parseGameReport({ turns: 12, level: 3, difficulty: 'normal', estado: 'vivo' }),
    ).toEqual({ turns: 12, level: 3, difficulty: 'normal' });
  });
});
