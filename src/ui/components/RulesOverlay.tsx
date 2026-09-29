import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { AppButton } from './AppButton';
import type { RulesViewModel } from '../view-models/ui-types';

export interface RulesOverlayProps {
  readonly model: RulesViewModel;
  readonly onClose: () => void;
}

/**
 * La hoja de reglas.
 *
 * Es un diálogo modal porque mientras está abierta la partida está congelada:
 * leer no cuesta un turno. Cierra con Escape, con su botón y con un click en la
 * parte de fuera, porque no hay nada que perder al cerrarla, y exigir puntería
 * para salir de una ayuda es lo contrario de una ayuda.
 *
 * El foco entra en el diálogo al abrirlo y se queda dentro. Con `aria-modal` la
 * partida de detrás no debería seguir siendo alcanzable con el tabulador. El foco
 * inicial va al propio diálogo y no a su primer botón para no saltarse el
 * principio de la hoja, que es justo lo que el jugador ha venido a leer.
 *
 * La cabecera y el cuerpo van separados para que el cierre siga a la vista con la
 * hoja scrolleada: una ayuda larga sin salida visible a media lectura es una
 * trampa, aunque tenga Escape.
 */
export function RulesOverlay({ model, onClose }: RulesOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>): void {
    // Solo el fondo cierra: un click dentro de la hoja, aunque sea en un hueco
    // entre dos bloques, no. Cerrar la ayuda al intentar seleccionar la semilla
    // sería el peor momento posible para cerrarla.
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    /*
     * Mismo trap que la confirmación de rendirse: el manejador está ligado al
     * diálogo, así que `currentTarget` es el propio diálogo y sus bordes son el
     * primer y el último botón. No se comprueba que la lista tenga nada porque si
     * viniera vacía el foco no sería ninguno de sus extremos, el tabulador saldría
     * y el cierre con Escape seguiría funcionando. Perder el foco es un fallo
     * recuperable; atraparlo en un diálogo sin salida, no.
     */
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
    <div className="rules-overlay" onClick={handleBackdropClick}>
      <div
        aria-labelledby="rules-title"
        aria-modal="true"
        className="rules-dialog"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="rules-dialog__bar">
          <h2 className="rules-dialog__title" id="rules-title">
            {model.title}
          </h2>
          <AppButton
            className="rules-dialog__close"
            onClick={onClose}
            variant="secondary"
          >
            Cerrar
          </AppButton>
        </div>
        <div className="rules-dialog__body">
          <p className="rules-dialog__lead">{model.lead}</p>
          <section className="rules-section">
            <h3 className="rules-dialog__heading">{model.actionsTitle}</h3>
            <ul className="rules-actions">
              {model.actions.map((action) => (
                <li className="rules-action" key={action.id}>
                  <p className="rules-action__head">
                    <span className="rules-action__label">{action.label}</span>
                    <kbd className="rules-action__key">{action.shortcut}</kbd>
                    <span className="rules-action__cost">{action.cost}</span>
                  </p>
                  <p className="rules-action__effect">{action.effect}</p>
                </li>
              ))}
            </ul>
          </section>
          {model.sections.map((section) => (
            <section className="rules-section" key={section.title}>
              <h3 className="rules-dialog__heading">{section.title}</h3>
              <ul className="rules-section__lines">
                {section.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
