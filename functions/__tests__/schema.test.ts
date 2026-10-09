// @vitest-environment node
//
// Node y no jsdom, que es el que pone el proyecto por defecto. `node:sqlite` y
// `node:fs` no existen en un navegador, así que la elección no es discutible
// aquí, pero se escribe igual para que quede claro y no parezca un descuido.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { beforeEach, describe, expect, it } from 'vitest';

/**
 * El esquema, probado de verdad.
 *
 * Esto aplica el archivo de migración real sobre una base SQLite en memoria,
 * que es el mismo motor que usa D1. No se prueba una copia del SQL escrita a
 * mano: si el archivo y la prueba se separan, la prueba sigue pasando y el
 * esquema se queda sin comprobar, que es la forma habitual de que eso ocurra.
 *
 * Se puede hacer sin `workerd` porque `node:sqlite` viene en Node y habla el
 * mismo SQL. El runtime de la plataforma solo hace falta para levantar el
 * servidor, no para responder a una consulta.
 *
 * La ruta se arma con `import.meta.dirname` y no con un `URL`. Con los tipos de
 * Node y los de la plataforma en el mismo programa hay dos clases `URL` que no
 * se pueden pasar la una a la otra, y `fileURLToPath` solo acepta la de Node.
 * Con `dirname` no hay ninguna clase que cruzar.
 */
const MIGRATION = join(
  import.meta.dirname,
  '..',
  '..',
  'migrations',
  '0001_cuentas.sql',
);

type Row = Record<string, unknown>;

function freshDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(MIGRATION, 'utf8'));
  return database;
}

function countOf(database: DatabaseSync, table: string): number {
  const row = database.prepare(`SELECT count(*) AS total FROM ${table}`).get() as Row;
  return Number(row['total']);
}

function tableNames(database: DatabaseSync): string[] {
  const rows = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as Row[];
  return rows.map((row) => String(row['name']));
}

function insertPlayer(
  database: DatabaseSync,
  overrides: {
    id?: string;
    email?: string;
    displayName?: string;
    passwordHash?: string | null;
    googleSubject?: string | null;
  } = {},
): void {
  database
    .prepare(
      `INSERT INTO players (id, email, display_name, password_hash, google_subject, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1000, 1000)`,
    )
    .run(
      overrides.id ?? 'jugador-1',
      overrides.email ?? 'quien@example.com',
      overrides.displayName ?? 'Alguien',
      overrides.passwordHash === undefined
        ? 'pbkdf2_sha256$600000$c2FsdA==$aGFzaA=='
        : overrides.passwordHash,
      overrides.googleSubject ?? null,
    );
}

describe('las tablas del esquema', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = freshDatabase();
  });

  it('crea exactamente las seis que el proyecto necesita', () => {
    // La lista es completa a propósito, y esa es la forma de que la promesa de
    // no guardar partidas no sea una promesa. Cualquier tabla nueva obliga a
    // tocar esta prueba, y tocarla obliga a explicar para qué sirve. Si algún
    // día aparece una tabla `games`, esta prueba falla y pregunta.
    expect(tableNames(database)).toEqual([
      'login_attempts',
      'player_levels',
      'player_stats',
      'player_unlocks',
      'players',
      'sessions',
    ]);
  });

  it('no tiene ninguna tabla donde quepa una partida', () => {
    // Lo mismo, comprobado por otra vía: buscando por nombre. Una tabla
    // llamada `turnos` o `savegame` colaría en la prueba anterior y se
    // mencionaría en el comentario; aquí se caza por la forma.
    const suspicious = tableNames(database).filter((name) =>
      /game|partida|save|turn|state|board/i.test(name),
    );
    expect(suspicious).toEqual([]);
  });
});

describe('la tabla de cuentas', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = freshDatabase();
  });

  it('acepta una cuenta que solo tiene contraseña', () => {
    insertPlayer(database, { id: 'correo', googleSubject: null });
    const row = database
      .prepare('SELECT google_subject FROM players WHERE id = ?')
      .get('correo') as Row;
    expect(row['google_subject']).toBeNull();
  });

  it('acepta una cuenta que solo tiene Google, sin contraseña que guardar', () => {
    insertPlayer(database, { id: 'google', passwordHash: null });
    const row = database
      .prepare('SELECT password_hash FROM players WHERE id = ?')
      .get('google') as Row;
    expect(row['password_hash']).toBeNull();
  });

  it('guarda el hash de la contraseña y no la contraseña', () => {
    const hash = 'pbkdf2_sha256$600000$c2FsdA==$aGFzaA==';
    insertPlayer(database, { passwordHash: hash });

    const row = database
      .prepare('SELECT password_hash AS hash FROM players')
      .get() as Row;
    // La forma autodocumentada: algoritmo, iteraciones, sal y resultado, con
    // cada parte separada por `$`. El algoritmo está escrito en la propia fila
    // para poder subir las iteraciones dentro de un año sin mover los datos.
    expect(String(row['hash'])).toBe(hash);
    expect(String(row['hash']).split('$')).toHaveLength(4);
  });

  it('no normaliza el correo, así que la responsabilidad es del código', () => {
    // Por qué está aquí y no dentro de la aplicación. En SQLite, `TEXT UNIQUE`
    // distingue mayúsculas, así que estas dos filas entran las dos y hay dos
    // cuentas para la misma persona. Normalizar antes de insertar es lo que lo
    // evita; esta prueba deja constancia de que la base de datos no ayuda.
    insertPlayer(database, { id: 'a', email: 'Quien@Example.com' });
    insertPlayer(database, { id: 'b', email: 'quien@example.com' });

    expect(countOf(database, 'players')).toBe(2);
  });

  it('rechaza dos cuentas con el mismo correo', () => {
    insertPlayer(database, { id: 'a' });
    expect(() => insertPlayer(database, { id: 'b' })).toThrow();
  });

  it('rechaza dos cuentas con el mismo asunto de Google', () => {
    insertPlayer(database, { id: 'a', googleSubject: 'sub-123' });
    expect(() =>
      insertPlayer(database, {
        id: 'b',
        email: 'otro@example.com',
        googleSubject: 'sub-123',
      }),
    ).toThrow();
  });
});

describe('la tabla de desbloqueos', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = freshDatabase();
    insertPlayer(database);
  });

  function unlock(kind: string, id: string): void {
    database
      .prepare(
        'INSERT INTO player_unlocks (player_id, kind, id, obtained_at) VALUES (?, ?, ?, 1000)',
      )
      .run('jugador-1', kind, id);
  }

  it.each(['moneda', 'personaje', 'logro'])('acepta el tipo %s', (kind) => {
    expect(() => unlock(kind, `${kind}-1`)).not.toThrow();
  });

  it('rechaza un tipo que no existe, en vez de guardarlo', () => {
    // El CHECK protege la consulta que contará monedas. Sin él, un 'moneda'
    // escrito como 'coins' entraría sin decir nada y el recuento saldría mal
    // más adelante, sin error que lo señalara.
    expect(() => unlock('coins', 'moneda-1')).toThrow();
  });

  it('no desbloquea dos veces lo mismo, porque la fila es la prueba', () => {
    unlock('moneda', 'moneda-50');
    expect(() => unlock('moneda', 'moneda-50')).toThrow();
  });

  it('obtiene el saldo contando filas, y así no hay nada que descontar dos veces', () => {
    unlock('moneda', 'moneda-10');
    unlock('moneda', 'moneda-25');
    unlock('moneda', 'moneda-50');
    unlock('logro', 'primera-noche');

    // Un saldo guardado como número es un número que se puede restar dos veces.
    // Un recuento de filas no tiene esa forma: no hay ningún número que restar,
    // solo filas que están o no están.
    const balance = database
      .prepare(
        "SELECT count(*) AS total FROM player_unlocks WHERE player_id = ? AND kind = 'moneda'",
      )
      .get('jugador-1') as Row;
    expect(balance['total']).toBe(3);
  });
});

describe('el reparto por nivel', () => {
  it('acumula en la misma fila cuando el nivel se repite', () => {
    // Esto es lo que va a usar la ruta de estadísticas, y por eso se prueba con
    // la misma forma de sentencia. Un `INSERT` a secas sobre la clave primaria
    // lanzaría, así que la suma tiene que ser un `ON CONFLICT DO UPDATE`: es
    // el servidor quien acumula, y por eso dos dispositivos a la vez no se
    // pisan.
    const database = freshDatabase();
    insertPlayer(database);
    const record = (difficulty: string, level: number) =>
      database
        .prepare(
          `INSERT INTO player_levels (player_id, difficulty, level, games)
           VALUES (?, ?, ?, 1)
           ON CONFLICT (player_id, difficulty, level)
           DO UPDATE SET games = games + 1`,
        )
        .run('jugador-1', difficulty, level);

    record('normal', 3);
    record('normal', 3);
    record('normal', 4);
    record('agony', 1);

    const row = database
      .prepare(
        'SELECT games FROM player_levels WHERE player_id = ? AND difficulty = ? AND level = ?',
      )
      .get('jugador-1', 'normal', 3) as Row;
    expect(row['games']).toBe(2);
    // Tres filas: dos niveles en normal y uno en agony. La segunda partida en
    // el nivel 3 de normal sumó a la fila que ya estaba, no creó otra.
    expect(countOf(database, 'player_levels')).toBe(3);
  });

  it('mantiene separadas las dificultades', () => {
    const database = freshDatabase();
    insertPlayer(database);
    const record = (difficulty: string) =>
      database
        .prepare(
          `INSERT INTO player_levels (player_id, difficulty, level, games)
           VALUES (?, ?, 1, 1)
           ON CONFLICT (player_id, difficulty, level)
           DO UPDATE SET games = games + 1`,
        )
        .run('jugador-1', difficulty);

    record('normal');
    record('agony');

    const row = database
      .prepare('SELECT games FROM player_levels WHERE difficulty = ?')
      .get('agony') as Row;
    expect(row['games']).toBe(1);
  });
});

describe('el borrado en cascada', () => {
  it('se lleva todo lo derivado de la cuenta', () => {
    // El asunto de Google se queda en la base de datos de Google, que no es
    // nuestra. Lo nuestro es lo derivado, y por eso la cascada salta desde
    // `players`: es la única fila que tenemos de esa persona.
    const database = freshDatabase();
    insertPlayer(database, { id: 'google', googleSubject: 'sub-123' });
    database
      .prepare(
        'INSERT INTO sessions (token_hash, player_id, created_at, last_seen_at, expires_at) VALUES (?, ?, 1, 1, 2)',
      )
      .run('hash-de-sesion', 'google');
    database
      .prepare(
        'INSERT INTO player_stats (player_id, best_turns, games_played, total_turns, hardest_level, updated_at) VALUES (?, 10, 2, 30, 3, 1)',
      )
      .run('google');
    database
      .prepare(
        'INSERT INTO player_levels (player_id, difficulty, level, games) VALUES (?, ?, ?, 1)',
      )
      .run('google', 'normal', 3);
    database
      .prepare(
        'INSERT INTO player_unlocks (player_id, kind, id, obtained_at) VALUES (?, ?, ?, 1)',
      )
      .run('google', 'logro', 'primera-noche');

    database.prepare('DELETE FROM players WHERE id = ?').run('google');

    expect(countOf(database, 'players')).toBe(0);
    for (const table of ['sessions', 'player_stats', 'player_levels', 'player_unlocks']) {
      expect(countOf(database, table)).toBe(0);
    }
  });
});
