import type { ThreatNotice } from '../game';
import type { ThreatNoticeViewModel } from '../ui/view-models/ui-types';

/**
 * Mensajes jocosos de la escalada. El tono empeora con el nivel: los primeros
 * son casi bromas y los últimos ya no lo son. Solo viven en la capa de
 * aplicación; el motor no conoce texto.
 */
const threatMessages: readonly string[] = [
  'El refugio se ha encogido un poco. No preguntes por qué.',
  'Se acabó la tregua. Nadie te va a avisar cuando pare.',
  'El hambre ya camina más deprisa. Tú todavía no.',
  'Algo cambió en el aire y nadie da explicaciones.',
  'Descansar ya no significa lo mismo. Lo siento mucho.',
  'El mapa se está desvaniendo. Como era de esperar.',
  'Has sobrevivido más de lo previsto. Eso tiene un precio.',
  'La suerte se ha ido de vacaciones y no ha vuelto.',
  'Esto ya no es dificultad: es una amenaza con buenos modales.',
  'El mundo ha decidido que todavía no era suficiente.',
  'Ya apenas queda nada por perder. Bienvenido al final del principio.',
  'Aviso: seguir jugando aquí ha sido decisión tuya. Honrada y bastante tonta.',
];

export function threatMessageFor(threat: number): string {
  // La función es total. El motor solo produce enteros positivos, pero un nivel
  // no utilizable cae al primer mensaje en vez de romper el renderizado.
  const level = Number.isSafeInteger(threat) && threat > 0 ? threat : 1;
  const offset = level - 1;
  const index = offset % threatMessages.length;
  const base = threatMessages.slice(index, index + 1).join('');

  // A partir del segundo ciclo se añade el nivel, para que la pantalla siga
  // siendo inequívoca aunque el tono se repita.
  return offset < threatMessages.length
    ? base
    : `${base} (Nivel ${level})`;
}

export function createThreatNoticeViewModel(
  notice: ThreatNotice,
): ThreatNoticeViewModel {
  return {
    threat: notice.threat,
    load: notice.load,
    level: `Nivel de amenaza ${notice.threat}`,
    message: threatMessageFor(notice.threat),
    hint: 'Haz click para continuar...',
  };
}
