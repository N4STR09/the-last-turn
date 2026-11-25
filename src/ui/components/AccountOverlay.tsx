import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { AccountPanel } from './AccountPanel';
import { AppButton } from './AppButton';

export interface AccountOverlayProps {
  readonly onClose: () => void;
  /**
   * Aviso de que cambia quién está dentro. Opcional, igual que en el panel de
   * la portada: sin él la hoja se comporta igual, solo que la sesión de juego
   * no se entera.
   *
   * Admite `undefined` explícito porque `exactOptionalPropertyTypes` distingue
   * «no me lo han pasado» de «me lo han pasado sin valor», y aquí el que la
   * pinta reenvía el suyo, que puede no existir.
   */
  readonly onSessionChange?: ((autenticado: boolean) => void) | undefined;
}

/**
 * La hoja de cuenta dentro de la partida.
 *
 * Existe porque el acceso no puede esperar a la pantalla de inicio: el menú de
 * ajustes promete el perfil —o el inicio de sesión— mientras se juega, y esto
 * es lo que abre. La cuenta la pinta `AccountPanel` entera, con su propia
 * consulta de sesión, así que aquí no se duplica ni se decide nada: la hoja es
 * el marco, y el marco es el mismo que el de la ayuda por la misma razón que
 * allí —una capa modal a pantalla completa, con su barra y su cierre—.
 *
 * Se pinta con el mismo marco que la hoja de reglas y no con uno aparte: es la
 * misma capa de la interfaz, y dos marcos idénticos escritos dos veces son dos
 * sitios donde arreglar el borde que se nos olvide.
 *
 * Cierra con Escape, con su botón y con un click en la parte de fuera, porque
 * no hay nada que perder al cerrarla. El foco entra en el diálogo al abrirlo y
 * el tabulador no se sale de él mientras esté puesto.
 */
export function AccountOverlay({
  onClose,
  onSessionChange,
}: AccountOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>): void {
    // Solo el fondo cierra: un click dentro de la hoja, en un hueco entre dos
    // bloques, no. Cerrar el acceso al tropezar con el ratón sería dejar a
    // alguien sin poder entrar por un error de puntería.
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
     * Mismo trap que la confirmación de rendirse y la hoja de reglas: el
     * manejador está ligado al diálogo, así que `currentTarget` es el propio
     * diálogo y sus bordes son el primer y el último botón. No se comprueba
     * que la lista tenga nada porque si viniera vacía el foco no sería ninguno
     * de sus extremos, el tabulador saldría y el cierre con Escape seguiría
     * funcionando. Perder el foco es un fallo recuperable; atraparlo en un
     * diálogo sin salida, no.
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
        aria-labelledby="account-title"
        aria-modal="true"
        className="rules-dialog"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="rules-dialog__bar">
          <h2 className="rules-dialog__title" id="account-title">
            Cuenta
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
          <AccountPanel onSessionChange={onSessionChange} />
        </div>
      </div>
    </div>
  );
}
