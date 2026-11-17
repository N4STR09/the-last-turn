-- Progresión por cuenta: qué informes se han aceptado y a qué ritmo.
--
-- `player_reports` no guarda una partida. Guarda la clave de un informe ya
-- procesado, y esa clave es un resumen de una sola dirección que calcula el
-- servidor a partir de la cuenta y de los hechos de la partida (jugador,
-- semilla, dificultad, turnos, nivel). Con esa fila en la base, repetir el
-- mismo informe no vuelve a contar ni a premiar: la clave ya está puesta y el
-- `ON CONFLICT` lo dice sin escribir nada. Desde el hash no se reconstruye
-- ninguna semilla ni ningún tablero, así que la promesa de no guardar partidas
-- sigue sin depender de que nadie se acuerde de cumplirla.
--
-- `report_attempts` es el freno de ritmo de los informes, con la misma forma
-- que `login_attempts`: un contador por sesión y una ventana que se reinicia
-- sola cuando pasan los diez minutos. Sin esto, una cola de invitado larga o
-- un script podrían inundar la ruta de estadísticas sin que nada lo notara, y
-- el límite es el único sitio donde eso se decide.
CREATE TABLE IF NOT EXISTS player_reports (
  player_id   TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  game_key    TEXT NOT NULL,
  reported_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, game_key)
);

CREATE TABLE IF NOT EXISTS report_attempts (
  bucket       TEXT PRIMARY KEY,
  reports      INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
