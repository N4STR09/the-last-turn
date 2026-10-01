// @vitest-environment node
//
// Node y no jsdom, que es el que pone el proyecto por defecto: una ruta de
// Pages corre en el runtime de la plataforma, no en un navegador. También por
// el cuerpo de la respuesta, que en jsdom es de otro reino.
import { describe, expect, it, vi } from 'vitest';

import { onRequestGet } from '../health';

/**
 * Un D1 de mentira con una sola respuesta. Es la superficie que usa la ruta, ni
 * una más: `prepare` y `first`. Si algún día la ruta empieza a usar `run` o
 * `all`, esta pieza se queda sin implementar y la prueba falla al llamarla,
 * que es la forma de que un cambio en la consulta no pase sin que nadie lo lea.
 */
function databaseReturning(
  outcome: { total: number } | { failure: unknown },
): D1Database {
  return {
    prepare: () => ({
      first: async () => {
        if ('failure' in outcome) {
          throw outcome.failure;
        }
        return outcome;
      },
    }),
  } as unknown as D1Database;
}

/**
 * La ruta no usa de su contexto más que `env`. El resto son cosas que la
 * plataforma pone y que no existen fuera de ella, así que se rellenan con `null`
 * en vez de inventar valores: si la ruta empezara a leer `request` o `params`,
 * el acceso a `null` lo diría en la prueba en vez de fingir que funciona.
 *
 * El tipo se saca de la firma de la propia ruta con `Parameters`, y no de
 * escribirlo a mano, para que cambiar la firma de la ruta no obligue a cambiar
 * también esta pieza.
 */
type HealthContext = Parameters<typeof onRequestGet>[0];

function contextFor(database: D1Database): HealthContext {
  return {
    env: { DB: database },
    request: null,
    params: {},
    data: {},
    functionPath: '/api/health',
    waitUntil: () => undefined,
    next: () => undefined,
  } as unknown as HealthContext;
}

describe('GET /api/health', () => {
  it('responde 200 y el número de jugadores cuando el esquema está aplicado', async () => {
    const response = await onRequestGet(contextFor(databaseReturning({ total: 7 })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, jugadores: 7 });
  });

  it('responde 503 sin filtrar el error cuando la base de datos falla', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await onRequestGet(
      contextFor(
        databaseReturning({ failure: new Error('D1_ERROR: database_id no existe') }),
      ),
    );

    expect(response.status).toBe(503);
    // El detalle va al registro y no a la respuesta. Una dirección pública que
    // devuelve el nombre del enlace o la forma de la consulta le dice a quien
    // va a atacar por ahí cuál de los dos está mal.
    //
    // El cuerpo se lee una vez y se vuelve a interpretar con `JSON.parse`, y no
    // con `text()` y luego `json()`: un cuerpo de respuesta se puede leer una
    // sola vez, y la segunda llamada falla con «Body is unusable» en vez de
    // devolver lo mismo.
    const body: unknown = JSON.parse(await response.text());

    expect(JSON.stringify(body)).not.toContain('D1_ERROR');
    expect(JSON.stringify(body)).not.toContain('database_id');
    expect(body).toEqual({ ok: false, error: 'La base de datos no responde' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('no inventa jugadores cuando la consulta no devuelve fila', async () => {
    const empty = { prepare: () => ({ first: async () => null }) } as unknown as D1Database;

    const response = await onRequestGet(contextFor(empty));

    // Cero y no `null`: un contador ausente es cero. La diferencia importa
    // porque un `null` en un JSON se lleva a la interfaz como dato, y quien lo
    // ve a propósito de este repositorio tiene una base de datos.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, jugadores: 0 });
  });
});
