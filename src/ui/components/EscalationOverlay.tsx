import { useEffect, useRef } from 'react';

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
