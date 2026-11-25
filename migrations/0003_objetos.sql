-- Los objetos de la tienda: una cuarta fila en `player_unlocks`.
--
-- Las tres colecciones que ya vivían aquí se ganan jugando y no se gastan
-- entre sí. Los objetos rompen esa frase a medias y conviene decirlo en su
-- propio sitio: se compran con monedas, así que las monedas sí se gastan —aunque
-- no se borre ninguna fila, porque el saldo sigue siendo un recuento menos una
-- suma—, y el objeto comprado, una vez comprado, es una fila que está o no
-- está, igual que las otras tres. Por eso el cuarto `kind` entra en esta tabla y
-- no en una aparte: la clave `(player_id, kind, id)` es ya exactamente la clave
-- de una compra repetida, y el `INSERT OR IGNORE` que ampara a las otras
-- colecciones ampara también a esta.
--
-- El saldo no es ninguna columna. Sigue siendo `count(kind = 'moneda')` menos
-- la suma de los precios de las filas `kind = 'objeto'`, y esa resta vive dentro
-- de la propia sentencia que inserta el objeto (ver `_lib/unlocks.ts`). Ninguna
-- fila guarda un número que se pueda restar dos veces, que era la razón de ser
-- del recuento: dos peticiones simultáneas no gastan dos veces la misma moneda
-- porque la comprobación y la escritura son una sola sentencia atómica, no
-- porque no haya nada que restar.
--
-- SQLite no admite cambiar un `CHECK` en su sitio: hay que recrear la tabla,
-- copiar las filas y devolverle su nombre. Se hace aquí, una vez. `player_unlocks`
-- no es referenciada por ninguna otra tabla, así que el cambio de nombre no
-- arrastra a nadie, y las migraciones corren en transacción, de modo que la
-- tabla nueva solo existe entera si la copia termina.
CREATE TABLE IF NOT EXISTS player_unlocks_nueva (
  player_id   TEXT    NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('moneda', 'personaje', 'logro', 'objeto')),
  id          TEXT    NOT NULL,
  obtained_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, kind, id)
);

INSERT INTO player_unlocks_nueva (player_id, kind, id, obtained_at)
  SELECT player_id, kind, id, obtained_at FROM player_unlocks;

DROP TABLE player_unlocks;

ALTER TABLE player_unlocks_nueva RENAME TO player_unlocks;
