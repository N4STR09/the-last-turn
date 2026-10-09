// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { bindD1, integerColumn, textColumn, type Row } from '../database';

/**
 * Lo que se prueba aqui es el puente y nada mas: que cada una de las tres
 * operaciones llega a D1 con la sentencia y los parametros en el sitio, y que
 * las lectoras de columnas no devuelven un `NaN` ni un texto donde va un entero.
 *
 * El SQL en si no se prueba aqui. Ese se prueba con SQLite de verdad en
 * `accounts.test.ts` y en las rutas, que es donde hay claves, unicidades y
 * sentencias escritas de verdad. Aqui solo se necesita saber que el puente no
 * pierde nada por el camino.
 */

/** Fila de mentira que el D1 de mentira devuelve a todo lo que le pregunten. */
const FILA: Row = { id: 7, texto: 'hola', nada: null };

/** Lo que el D1 de mentira ha ido anotando. */
interface Nota {
  readonly consultas: string[];
  readonly parametros: unknown[][];
}

/**
 * Un D1 de mentira que anota cada consulta y devuelve {@link FILA}.
 *
 * Hace falta porque `bindD1` recibe un `D1Database` y no una base. El doble
 * camino de `prepare` no es un detalle: `bindD1` llama a `first()` directamente
 * cuando no hay parametros y a `bind(...).first()` cuando los hay, y las dos
 * ramas tienen que existir en el doble o una quedaria sin probar.
 */
function d1Falso(): { d1: D1Database; nota: Nota } {
  const nota: Nota = { consultas: [], parametros: [] };

  function sentencia(sql: string) {
    let parametros: readonly unknown[] = [];
    const anotar = () => {
      nota.consultas.push(sql);
      nota.parametros.push([...parametros]);
    };

    return {
      bind(...parameters: unknown[]) {
        parametros = parameters;
        return this;
      },
      async first() {
        anotar();
        return FILA;
      },
      async run() {
        anotar();
        return { success: true };
      },
      async all() {
        anotar();
        return { results: [FILA] };
      },
    };
  }

  return {
    d1: {
      prepare(sql: string) {
        return sentencia(sql);
      },
    } as unknown as D1Database,
    nota,
  };
}

describe('bindD1', () => {
  it('pasa la sentencia y los parametros a first', async () => {
    const { d1, nota } = d1Falso();

    const fila = await bindD1(d1).first('SELECT id FROM players WHERE email = ?', ['a@b.c']);

    expect(fila).toEqual(FILA);
    expect(nota.consultas).toEqual(['SELECT id FROM players WHERE email = ?']);
    expect(nota.parametros).toEqual([['a@b.c']]);
  });

  it('sin parametros no llama a bind, que es cuando D1 lo rechaza', async () => {
    // D1 no acepta `bind()` con la lista vacia, asi que el camino de "no hay
    // parametros" tiene que ser distinto y no solo `bind(...[])`.
    const { d1, nota } = d1Falso();

    await bindD1(d1).first('SELECT 1 AS uno');

    expect(nota.consultas).toEqual(['SELECT 1 AS uno']);
    expect(nota.parametros).toEqual([[]]);
  });

  it('pasa la sentencia y los parametros a run', async () => {
    const { d1, nota } = d1Falso();

    await bindD1(d1).run('DELETE FROM sessions WHERE token_hash = ?', ['abc']);

    expect(nota.consultas).toEqual(['DELETE FROM sessions WHERE token_hash = ?']);
    expect(nota.parametros).toEqual([['abc']]);
  });

  it('tambien admite run sin parametros', async () => {
    const { d1, nota } = d1Falso();

    await bindD1(d1).run('DELETE FROM sessions');

    expect(nota.parametros).toEqual([[]]);
  });

  it('devuelve las filas de all tal cual, sin envolverlas de nuevo', async () => {
    // D1 no devuelve un array sino un objeto con `results`. Si se devolviera el
    // objeto, quien llama veria un array con un unico elemento que ademas tiene
    // una propiedad, y la suma de estadisticas contaria una fila de mas.
    const { d1, nota } = d1Falso();

    const filas = await bindD1(d1).all<Row>('SELECT id FROM players');

    expect(filas).toEqual([FILA]);
    expect(nota.consultas).toEqual(['SELECT id FROM players']);
  });

  it('tambien admite all sin parametros', async () => {
    const { d1, nota } = d1Falso();

    await bindD1(d1).all('SELECT id FROM players');

    expect(nota.parametros).toEqual([[]]);
  });
});

describe('integerColumn', () => {
  const casos: [string, Row | null, string, number][] = [
    ['no hay fila', null, 'id', 0],
    ['no hay columna', {}, 'id', 0],
    ['la columna es NULL', { id: null }, 'id', 0],
    ['la columna no esta', { id: undefined }, 'id', 0],
    ['un entero', { id: 42 }, 'id', 42],
    ['un decimal', { id: 4.5 }, 'id', 4.5],
    ['un entero escrito como texto', { id: '42' }, 'id', 42],
    ['un entero grande, que llega como bigint', { id: 42n }, 'id', 42],
    ['texto que no es numero', { id: 'cuarenta' }, 'id', 0],
    ['un NaN', { id: Number.NaN }, 'id', 0],
    ['un infinito', { id: Number.POSITIVE_INFINITY }, 'id', 0],
  ];

  it.each(casos)('lee %s como entero', (_etiqueta, fila, columna, esperado) => {
    expect(integerColumn(fila, columna)).toBe(esperado);
  });
});

describe('textColumn', () => {
  const casos: [string, Row | null, string, string | null][] = [
    ['no hay fila', null, 'texto', null],
    ['no hay columna', {}, 'texto', null],
    ['la columna es NULL', { texto: null }, 'texto', null],
    ['una cadena', { texto: 'hola' }, 'texto', 'hola'],
    ['una cadena vacia', { texto: '' }, 'texto', ''],
    ['un numero', { texto: 42 }, 'texto', null],
    ['un booleano', { texto: false }, 'texto', null],
    ['un objeto', { texto: {} }, 'texto', null],
  ];

  it.each(casos)('lee %s como texto o devuelve null', (_etiqueta, fila, columna, esperado) => {
    expect(textColumn(fila, columna)).toBe(esperado);
  });
});
