import type { PagesFunction } from '@cloudflare/workers-types';

/**
 * ¿Está la base de datos ahí y con el esquema aplicado?
 *
 * Existe para el momento en que se despliega, que es el momento en que fallan
 * cosas que en local nunca fallaron: el `database_id` equivocado, una migración
 * que no se aplicó, un enlace que no está. Las tres dan un error de D1 en
 * cualquier otra ruta, y sin este aviso se descubre mirando el registro de
 * errores en vez de mirando una dirección.
 *
 * No dice cuántos jugadores hay ni nada que venga de una fila. Dice una cosa
 * sola, y la dice bien: si llega un 200 aquí, el esquema está aplicado.
 */

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env }) => {
  try {
    // Cuenta de `players` y no `SELECT 1`. `SELECT 1` funciona con cualquier
    // base de datos, esté aplicada la migración o no, así que no distinguiría
    // una cosa de la otra. Esta consulta falla si la tabla no existe, que es
    // exactamente lo que se quiere comprobar.
    const row = await env.DB.prepare('SELECT count(*) AS total FROM players')
      .first<{ total: number }>();

    return Response.json({ ok: true, jugadores: row?.total ?? 0 });
  } catch (error) {
    // El mensaje del error de D1 puede traer la forma de la consulta y el
    // nombre del enlace. No se devuelve: esto es una dirección pública y el
    // detalle va al registro, que es donde lo lee quien tiene que arreglarlo.
    console.error('health: la base de datos no responde', error);
    return Response.json(
      { ok: false, error: 'La base de datos no responde' },
      { status: 503 },
    );
  }
};
