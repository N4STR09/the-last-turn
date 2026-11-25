/**
 * La colección de la cuenta, hablando con `/api/unlocks`.
 *
 * Monedas, personajes y logros se leen aquí, del mismo modo que las marcas se
 * leen en `stats.ts` y por las mismas razones: sin React, sin estado del juego
 * y con todo fallo traducido a `null`. El panel de cuenta es quien lo necesita
 * para pintarlo, y un despliegue sin cuentas ni siquiera llega a llamar a esta
 * función, igual que no llega a la de sesión.
 *
 * **El cliente no manda nada.** Esta es solo lectura: no hay POST a
 * `/api/unlocks`, no hay cuerpos que escribir y no hay identidad que mandar —
 * la cuenta viene en la cookie. La progresión se gana jugando, y eso entra
 * exclusivamente por `reportGame`, con los hechos de la partida validados en
 * el servidor. Aquí solo se traduce lo que el servidor devuelve.
 */

/** Lo que se lee de la colección: un saldo y dos listas de identificadores. */
export interface ProgressionSummary {
  /** Saldo en monedas. */
  readonly coins: number;
  /** Personajes desbloqueados, en el orden que manda el servidor. */
  readonly unlocks: readonly string[];
  /** Logros ganados, en el orden que manda el servidor. */
  readonly achievements: readonly string[];
}

/**
 * El nombre con el que se enseña cada personaje.
 *
 * Son los mismos identificadores que otorga el servidor, ya traducidos al
 * vocabulario de la interfaz: la columna guarda la letra tal cual, porque un
 * solo vocabulario en los dos lados es la forma de que nadie escriba `agonia`
 * y nadie espere `agony`. Un id que no esté en el mapa —un personaje
 * añadido mañana— se enseña tal cual en lugar de desaparecer: la colección no
 * puede quedarse muda porque el cliente se entere tarde de un estreno.
 */
const CHARACTER_LABELS: Record<string, string> = {
  explorador: 'Explorador',
  veterano: 'Veterano',
  insomne: 'Insomne',
  huesped: 'Huésped',
};

/** Lo mismo para los logros, que son los que se ganan jugando. */
const ACHIEVEMENT_LABELS: Record<string, string> = {
  'primera-partida': 'Primera partida',
  'turno-50': '50 turnos',
  'turno-100': '100 turnos',
  'agonia-50': '50 turnos en Agonía',
};

function labelFor(labels: Record<string, string>, id: string): string {
  return labels[id] ?? id;
}

/** Cómo se enseña un personaje de la colección; sin traducir, si aún no lo hay. */
export function characterLabel(id: string): string {
  return labelFor(CHARACTER_LABELS, id);
}

/** Lo mismo para un logro. */
export function achievementLabel(id: string): string {
  return labelFor(ACHIEVEMENT_LABELS, id);
}

const UNLOCKS_URL = '/api/unlocks';

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Traduce el cuerpo de la ruta en una colección, o `null` si no se entiende.
 *
 * `autenticado` va primero por el mismo motivo que en `stats.ts`: distingue
 * «esta cuenta no tiene colección» de «esto no es la respuesta de este
 * servidor». Una lista con un número dentro, un saldo negativo o un cuerpo
 * que no es un objeto acaban en `null`, que el panel enseña como «no hay nada
 * que enseñar» —que es exactamente lo que hace hoy con cualquier fallo.
 */
function progressionFrom(payload: unknown): ProgressionSummary | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const body = payload as {
    autenticado?: unknown;
    coins?: unknown;
    unlocks?: unknown;
    achievements?: unknown;
  };
  if (body.autenticado !== true) {
    return null;
  }
  if (!isCount(body.coins)) {
    return null;
  }
  if (!isStringList(body.unlocks) || !isStringList(body.achievements)) {
    return null;
  }

  return {
    coins: body.coins,
    unlocks: body.unlocks,
    achievements: body.achievements,
  };
}

/**
 * Lee la colección de la cuenta que está dentro, o `null` si no hay.
 *
 * `null` significa las dos cosas a la vez, igual que en `fetchStats`: sin
 * sesión y sin servidor la pantalla sigue funcionando, y la diferencia entre
 * «no hay cuenta» y «no hay red» no le cambia nada al panel, que en los dos
 * casos enseña el correo y nada más.
 */
export async function fetchUnlocks(): Promise<ProgressionSummary | null> {
  try {
    const response = await fetch(UNLOCKS_URL);
    return progressionFrom(await response.json());
  } catch {
    return null;
  }
}
