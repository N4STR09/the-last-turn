import type {
  DeathCause,
  Difficulty,
  GameAction,
} from '../../game/types';

/** Los tres recursos con cifra. El refugio no es un stat: es un interruptor. */
export type StatId = 'hunger' | 'energy' | 'food' | 'health';
export type ResourceId = StatId | 'shelter';
export type Tone = 'neutral' | 'warning' | 'positive';

export interface ResourceViewModel {
  readonly id: StatId;
  readonly label: string;
  readonly value: string;
  readonly stateLabel: string;
  /**
   * `warning` avisa y late a la vez: es el mismo peligro escrito en texto y
   * dibujado en luz. Hasta que el refugio salió de esta lista era el único
   * sitio donde las dos señales se separaban, así que no hace falta un campo
   * aparte para el parpadeo.
   */
  readonly tone: Tone;
  /** Unidades actuales. La barra dibuja un bloque por unidad. */
  readonly units: number;
  /** Bloques que caben en la barra. El valor numérico siempre se imprime. */
  readonly capacity: number;
}

/**
 * Estado del refugio, en su propia línea debajo de las cifras. Se dice con una
 * palabra y no con un aviso porque no hay ningún punto en el que quedarse sin
 * techo sea una muerte: es una posición, no un peligro.
 */
export interface ShelterViewModel {
  readonly label: string;
  readonly hasShelter: boolean;
  readonly status: 'Construido' | 'Destruido';
  readonly tone: Tone;
}

export interface ResourceDeltaViewModel {
  readonly id: ResourceId;
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
}

export interface EventViewModel {
  readonly type: 'storm' | 'raccoon' | 'meteorite';
  readonly headline: string;
  readonly description: string;
}

/**
 * Lo que ya está tirado y va a caer en el turno siguiente.
 *
 * No es un resultado: es un aviso. El motor tira el evento al final de un turno y
 * lo guarda, así que la partida entera le da al jugador un turno entero de
 * reacción antes de que el dado cobre. La medición que lo justifica: el 52 % de
 * las partidas de Agonía terminaban en los tres turnos siguientes a una tormenta
 * y el 90 % de las muertes por energía tenían una a la vista.
 */
export interface ForecastViewModel {
  readonly headline: string;
  readonly detail: string;
  /** Cuántos eventos hay en cola, para no prometer solo el primero. */
  readonly count: number;
}

export interface ResolutionViewModel {
  readonly actionId: GameAction;
  readonly headline: string;
  readonly details: readonly string[];
  readonly deltas: ReadonlyArray<ResourceDeltaViewModel>;
  readonly events: readonly EventViewModel[];
}

export interface ActionViewModel {
  readonly id: GameAction;
  readonly label: string;
  /**
   * Gasto de la acción en hambre y energía, entre paréntesis. Se calcula contra
   * la amenaza actual, así que sube con la escalada, y en reparar refleja que
   * dura dos turnos. Es el gasto exacto: ninguna acción tiene coste azar.
   */
  readonly cost: string;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  /**
   * El rival fantasma: la mejor partida de esta sesión, en turnos, o `null` si
   * todavía no ha muerto ninguna. Vive solo en memoria y se pierde al recargar,
   * que es justo lo que lo hace un rival y no un récord.
   */
  readonly personalBest: number | null;
  /** Nivel de escalada vigente. La dificultad la comunica la calavera. */
  readonly threat: number;
  /** Hambre, energía, comida y salud, en ese orden. */
  readonly stats: ReadonlyArray<ResourceViewModel>;
  /** El refugio, en su propia línea debajo de las cifras. */
  readonly shelter: ShelterViewModel;
  /**
   * El aviso de lo que ya está tirado para el turno siguiente. `null` en Normal y
   * cuando no hay nada en cola, que incluye el primer turno de cada partida.
   */
  readonly forecast: ForecastViewModel | null;
  readonly resolution: ResolutionViewModel | null;
  readonly actions: ReadonlyArray<ActionViewModel>;
}

/** Pantalla de escalada: congela la partida hasta que se continúa. */
export interface ThreatNoticeViewModel {
  readonly threat: number;
  readonly load: number;
  readonly level: string;
  readonly message: string;
  readonly hint: string;
}

/**
 * Cuántas veces se usó una acción.
 *
 * Solo la cuenta. El modelo se quedó así después de quitarle las dos cosas que
 * también eran el turno de la acción: el «desde el turno N» de cada fila, que
 * repetía un mismo dato cinco veces, y la frase del último estreno, que lo decía
 * una sola vez y no añadía nada a un parte que ya dice en qué turno murió.
 */
export interface ActionUsageViewModel {
  readonly id: GameAction;
  readonly label: string;
  readonly count: number;
}

export interface GameOverViewModel {
  readonly difficulty: Difficulty;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
  /**
   * `true` cuando esta partida dejó la marca de la sesión más alta. Va en la
   * pantalla de muerte y solo en ella: durante la partida lo dice el rival
   * fantasma en vivo, y al morir ya no hace falta que lo diga dos veces.
   *
   * No es una victoria. En este juego siempre se muere, así que lo único que se
   * puede superar es la propia marca anterior.
   */
  readonly newRecord: boolean;
  /** Los cinco recursos en su valor final, con la misma lectura que en partida. */
  readonly stats: ReadonlyArray<ResourceViewModel>;
  readonly shelter: ShelterViewModel;
  /** Las cinco acciones, aunque no se hayan usado nunca. */
  readonly breakdown: ReadonlyArray<ActionUsageViewModel>;
  /** La semilla en base 36, tal y como va en el enlace. */
  readonly seed: string;
  /**
   * `true` cuando esta muerte viene de un enlace y es la partida de otra persona.
   * La pantalla lo dice porque, sin decirlo, sería la partida del visitante y
   * mentiría sobre quién murió.
   */
  readonly replayed: boolean;
}
