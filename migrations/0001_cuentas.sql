-- Cuentas, sesiones, estadísticas y desbloqueos.
--
-- Este esquema no guarda partidas. No hay tabla donde meter una, y no hay forma
-- de añadir una por accidente: la ruta que escribe estadísticas manda enteros y
-- el motor de SQL los agrega. Un estado de partida no cabe en ninguna de las
-- columnas de aquí, así que la promesa de no guardarlo no depende de que
-- alguien se acuerde de cumplirla.
--
-- Las estadísticas se guardan como acumulados y los agrega el servidor, nunca el
-- cliente. El cliente manda lo que pasó en una partida —su mejor turno y un
-- contador— y la base de datos lo suma con un `MAX` o una suma. Si el cliente
-- mandara totales, el último en escribir ganaría, y con dos dispositivos a la vez
-- se perderían partidas. Así el servidor es el dueño del dato y el cliente no
-- puede declararse un récord que no tiene.

CREATE TABLE IF NOT EXISTS players (
  id             TEXT    PRIMARY KEY,
  -- Normalizado en minúsculas y sin espacios en el código, no aquí: la unicidad
  -- de esta columna es la que impide que dos cuentas sean la misma cuenta con
  -- distinta capitalización.
  email          TEXT    NOT NULL UNIQUE,
  display_name   TEXT    NOT NULL,
  -- NULL cuando la cuenta es solo de Google. Un hash, nunca una contraseña: ver
  -- `src/server/password.ts` para por qué cifrar sería peor.
  password_hash  TEXT,
  -- El `sub` del token de Google, que es estable por cuenta de Google y no
  -- cambia si la persona renombra su dirección. NULL si nunca ha entrado con
  -- Google. Es la única parte de su identidad que se guarda de Google, y es la
  -- única que no puede reasignar nadie.
  google_subject TEXT    UNIQUE,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- Las sesiones guardan el hash del token, no el token. Si alguien se lleva la
-- base de datos entera no se lleva con ella ninguna sesión utilizable, porque
-- para hacer falta el token en claro y eso solo estaba en la cookie del jugador.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT    PRIMARY KEY,
  player_id    TEXT    NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_by_player ON sessions (player_id);
CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS player_stats (
  player_id     TEXT    PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  best_turns    INTEGER NOT NULL DEFAULT 0,
  games_played  INTEGER NOT NULL DEFAULT 0,
  total_turns   INTEGER NOT NULL DEFAULT 0,
  hardest_level INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);

-- Reparto por nivel y dificultad. Es lo que permitió medir la línea base de 400
-- semillas, y sin cada partida guardada esa medición no se puede repetir con
-- partidas de alguien que no sea el piloto automático.
CREATE TABLE IF NOT EXISTS player_levels (
  player_id  TEXT    NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  difficulty TEXT    NOT NULL,
  level      INTEGER NOT NULL,
  games      INTEGER NOT NULL,
  PRIMARY KEY (player_id, difficulty, level)
);

-- Monedas, personajes y logros en la misma tabla, distinguidos por `kind`. Es una
-- decisión de forma, no de comodidad: las tres cosas se ganan y no se gastan
-- entre sí, así que las tres son «estas filas existen». Las monedas en concreto
-- son un saldo que se descontaría, y un saldo es un número que se puede restar
-- dos veces; contando filas no hay doble gasto posible porque no hay nada que
-- restar.
--
-- `kind` lleva un CHECK para que un valor mal escrito falle al insertar y no
-- forme parte de una consulta posterior. Es la única vez que el esquema impone
-- una regla de negocio, y se impone aquí porque el sitio del que depende es un
-- sitio de escritura.
CREATE TABLE IF NOT EXISTS player_unlocks (
  player_id   TEXT    NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('moneda', 'personaje', 'logro')),
  id          TEXT    NOT NULL,
  obtained_at INTEGER NOT NULL,
  -- La misma moneda no se puede desbloquear dos veces, porque la fila entera es
  -- la prueba de que se tiene y duplicarla serían dos pruebas de lo mismo.
  PRIMARY KEY (player_id, kind, id)
);

-- Intentos de inicio de sesión, para el bloqueo progresivo. Sin esto el login no
-- tiene ninguna defensa contra alguien probando contraseñas a razón de millones
-- por segundo, y el hasheado solo pondría un límite de ritmo al atacante, no al
-- atacante.
--
-- La clave es un hash de IP y correo juntos, no el valor en claro: este es el
-- único sitio donde se guardaría una dirección IP, y guardarla en claro sería un
-- dato personal más, con su propio propósito de protección.
CREATE TABLE IF NOT EXISTS login_attempts (
  bucket       TEXT    PRIMARY KEY,
  failures     INTEGER NOT NULL,
  first_at     INTEGER NOT NULL,
  locked_until INTEGER
);
