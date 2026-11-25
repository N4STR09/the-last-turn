import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { ThreatNoticeViewModel } from '../view-models/ui-types';

export interface EscalationOverlayProps {
  readonly model: ThreatNoticeViewModel;
  readonly onContinue: () => void;
}

/**
 * Pantalla de escalada. Cierra con click en cualquier sitio, Enter o Espacio,
 * y mantiene el foco dentro mientras está abierta. El estado del juego ya
 * lleva el incremento aplicado: aquí solo se descarta el aviso.
 */
export function EscalationOverlay({
  model,
  onContinue,
}: EscalationOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [model.threat]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isContinue =
        event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';

      if (!isContinue) {
        return;
      }

      event.preventDefault();
      onContinue();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onContinue]);

  /*
   * El tabulador no sale de aquí.
   *
   * El aviso es modal —`aria-modal` lo promete— y dentro no hay ni un solo
   * control: se descarta con click o con Enter, y el propio diálogo es el
   * único destino al que se puede volver. Sin este manejador, un tabulador
   * saltaría al juego congelado de detrás, que es justo lo que la promesa de
   * `aria-modal` dice que no puede pasar, y el foco caería en una partida que
   * no acepta nada.
   *
   * Mismo criterio que el trap de los otros diálogos: el manejador vive en el
   * diálogo, así que `currentTarget` es él mismo y a él vuelve, en las dos
   * direcciones.
   */
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    dialogRef.current?.focus();
  }

  return (
    // El click vive en la capa exterior y los clicks interiores suben hasta
    // ella: así "click en cualquier sitio" incluye el propio diálogo. El
    // equivalente de teclado es el listener de Enter y Espacio de arriba, con
    // el foco ya dentro del diálogo, de modo que no hace falta un manejador de
    // teclado en este elemento.
    <div
      className="escalation-overlay"
      data-threat={model.threat}
      onClick={onContinue}
    >
      <div
        aria-labelledby="escalation-message"
        aria-modal="true"
        className="escalation-overlay__dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="escalation-overlay__level">{model.level}</p>
        <p className="escalation-overlay__message" id="escalation-message">
          {model.message}
        </p>
        <p className="escalation-overlay__hint">{model.hint}</p>
      </div>
    </div>
  );
}
