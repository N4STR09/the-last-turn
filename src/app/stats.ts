import type { Difficulty } from '../game';

/**
 * Las estadísticas de la cuenta, hablando con `/api/stats`.
 *
 * Este módulo es la mitad de página del sistema de cuentas: lo que hay en el
 * servidor se lee aquí y lo que se sube se escribe aquí. No conoce React ni el
 * estado del juego; recibe los hechos de una partida y devuelve lo que el
 * servidor dice que hay. Por eso no hace falta hilo por `App.tsx`: quien
 * necesita la marca es la sesión de juego, y quien sabe cuándo cambia la
 * cuenta es el panel de cuenta, y las dos cosas se encuentran en esta función
 * y no en una pantalla.
 *
 * **Todo fallo se queda en silencio y devuelve lo que significaría "no hay
 * nada".** Sin red, con el servidor caído o con un cuerpo que no se entiende,
 * `fetchStats` devuelve `null` y `reportGame` devuelve `false`. El acceso es
 * opcional y una partida no puede dejar de jugarse porque la estadística no
 * haya podido subirse: lo que no se pudo subir se queda en la cola de
 * `use-game-session` y se intenta otra vez, y lo que no se pudo leer simplemente
 * no es una marca que batir hoy.
 *
 * **No hay ninguna palabra del juego escrita dos veces.** La dificultad que se
 * manda es `Difficulty`, el mismo tipo que usa el motor, y no una cadena
 * parecida: si un día el motor la cambiara, esto dejaría de compilar en lugar de
 * mandar al servidor una letra que nadie espera.
 */

/** Lo que se lee del servidor. Hoy solo se usa el récord; el resto lo devuelve la ruta para quien lo necesite. */
export interface StatsSummary {
  readonly bestTurns: number | null;
}

/** Lo que se declara de una partida: tres enteros, una letra y la semilla. */
export interface GameReport {
  readonly turns: number;
  readonly level: number;
  readonly difficulty: Difficulty;
  /**
   * La identidad de la partida, no un dato del motor.
   *
   * Es la misma semilla que ya guarda la sesión para el enlace de
   * reproducción. Con ella el servidor distingue un informe repetido —una
   * respuesta perdida que el cliente vuelve a mandar— de una partida nueva, y
   * por eso tiene que viajar en cada parte: sin ella el servidor rechazaría el
   * cuerpo, y con ella un reintento no cuenta dos veces.
   */
  readonly seed: number;
}

const STATS_URL = '/api/stats';

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Traduce el cuerpo de la ruta en una marca, o `null` si no se entiende.
 *
 * `autenticado` es la primera comprobación porque es la que distingue "esta
 * cuenta no tiene marca" de "esto no es la respuesta de este servidor". Sin
 * ella, un cuerpo que no tiene nada que ver se leería como un récord de cero.
 */
function summaryFrom(payload: unknown): StatsSummary | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const body = payload as { autenticado?: unknown; bestTurns?: unknown };
  if (body.autenticado !== true) {
    return null;
  }

  const bestTurns = body.bestTurns;
  if (bestTurns !== null && !isCount(bestTurns)) {
    return null;
  }

  return { bestTurns };
}

/**
 * Lee la marca de la cuenta que está dentro, o `null` si no hay.
 *
 * `null` significa las dos cosas a la vez y eso es a propósito: sin sesión y sin
 * servidor se juega igual, y la portada distingue "todavía no he batido nada"
 * con su propio `null`, no con un cero inventado.
 */
export async function fetchStats(): Promise<StatsSummary | null> {
  try {
    const response = await fetch(STATS_URL);
    return summaryFrom(await response.json());
  } catch {
    return null;
  }
}

/**
 * Declara una partida. `true` cuando el servidor la ha contado.
 *
 * El cuerpo es el informe tal cual: la ruta no acepta quién lo manda porque eso
 * viene en la cookie, y por eso aquí no hay ni un campo de identificación. Un
 * `false` puede ser "no hay sesión" o "no hay red", y la diferencia no importa
 * a quien llama: las dos dejan la partida en la cola para otro intento.
 */
export async function reportGame(report: GameReport): Promise<boolean> {
  try {
    const response = await fetch(STATS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    });
    return response.ok;
  } catch {
    return false;
  }
}
