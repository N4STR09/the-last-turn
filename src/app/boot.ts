import {
  createInitialAppState,
  createReplayedAppState,
  type AppState,
} from './app-state';
import { isDeadReplay, replayGame, type DeadReplayResult } from './replay';
import { isReplayLink, type ReplayLink } from './seed';
import { readReplayLink } from './seed-url';

/**
 * Lo que la URL tenía que decir al abrir la página.
 *
 * Solo hay dos respuestas: la página se abre con un enlace de partida, o se abre
 * como se abre siempre. No hay una tercera, y no debería haberla: si el enlace no
 * reconstruye una muerte, la aplicación arranca normal y punto.
 */
export interface Boot {
  readonly link: ReplayLink;
  readonly result: DeadReplayResult;
}

/**
 * Lee el enlace de la barra de direcciones y reproduce la partida a la que
 * apunta. Devuelve `null` cuando no hay enlace, cuando está corrupto y cuando la
 * partida que describe no termina: sin muerte no hay nada que reproducir, y una
 * partida que sobrevive al enlace es un enlace escrito a mano que no significa lo
 * que dice.
 *
 * Se llama una sola vez, al montar, desde un inicializador perezoso. No es un
 * efecto: leer la URL no necesita un render para poder leerse, y hacerlo en el
 * efecto obligaría a saltar a la pantalla de muerte después de haber pintado la
 * de inicio.
 */
export function readBoot(): Boot | null {
  const link = readReplayLink();

  if (!isReplayLink(link)) {
    return null;
  }

  const result = replayGame(link.seed, link.difficulty, link.actions);

  if (!isDeadReplay(result)) {
    return null;
  }

  return { link, result };
}

/** El estado de la aplicación que corresponde a lo que se leyó al abrir. */
export function bootState(boot: Boot | null): AppState {
  if (boot === null) {
    return createInitialAppState();
  }

  return createReplayedAppState(boot.result.state, boot.result.resolution);
}
