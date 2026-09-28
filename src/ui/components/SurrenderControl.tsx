import { Flag } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { AppButton } from './AppButton';

export interface SurrenderControl {
  /** La confirmación está puesta: el diálogo está abierto. */
  readonly pending: boolean;
  readonly ask: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export interface SurrenderControlProps {
  readonly surrender: SurrenderControl;
}

/**
 * Rendirse, y el diálogo que lo pide antes de hacerlo.
 *
 * Botón y diálogo viven en el mismo componente a propósito: así el foco puede
 * volver al botón al cancelar sin tener que atravesar la aplicación buscando un
 * disparador que está dos niveles más arriba. Al confirmar no hace falta: la
 * pantalla final se lleva el foco ella sola.
 *
 * El diálogo cierra con Escape o con «Seguir jugando», nunca con un click fuera:
 * una confirmación de derrota no se acepta por errar el ratón. Y el foco se
 * mantiene dentro, porque con un `role="dialog"` modal, la partida que hay
 * detrás no debería seguir siendo alcanzable con el tabulador.
 */
export function SurrenderControl({ surrender }: SurrenderControlProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (surrender.pending) {
      dialogRef.current?.focus();
    } else if (wasOpen.current) {
      // Solo al cerrar, nunca al montar: al entrar en la partida el foco lo
      // lleva el encabezado de la pantalla, y quitárselo en la primera pintada
      // sería robarle el foco a la pantalla.
      triggerRef.current?.focus();
    }

    wasOpen.current = surrender.pending;
  }, [surrender.pending]);

  function handleDialogKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      surrender.cancel();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    // El manejador está ligado al diálogo, así que `currentTarget` es el propio
    // diálogo: no hace falta un ref para buscar sus botones. Sus bordes son el
    // primero y el último, y no se comprueba que la lista tenga nada porque si
    // viniera vacía el foco no sería ninguno de sus extremos, el tabulador
    // saldría y el cierre con Escape seguiría funcionando. Perder el foco es un
    // fallo recuperable; atraparlo en un diálogo sin salida, no.
    const focusable =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }

    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last?.focus();
    }
  }

  return (
    <>
      <AppButton
        className="action-button action-button--surrender"
        onClick={surrender.ask}
        ref={triggerRef}
        variant="quiet"
      >
        <span className="action-button__icon">
          <Flag aria-hidden="true" size={18} strokeWidth={1.7} />
        </span>
        <span className="action-button__copy">
          <strong>Rendirse</strong>
          <span className="action-button__cost">(te lleva la partida)</span>
        </span>
      </AppButton>
      {surrender.pending ? (
        <div className="surrender-overlay">
          <div
            aria-labelledby="surrender-title"
            aria-modal="true"
            className="surrender-dialog"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <p className="surrender-dialog__title" id="surrender-title">
              ¿Seguro que te rindes?
            </p>
            <p className="surrender-dialog__body">
              Se acabó. El refugio se queda sin nadie que lo mantenga y la
              partida termina aquí, con el turno que llevas.
            </p>
            <div className="surrender-dialog__actions">
              <AppButton onClick={surrender.cancel}>Seguir jugando</AppButton>
              <AppButton onClick={surrender.confirm} variant="danger">
                Rendirme
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
