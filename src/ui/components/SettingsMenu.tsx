import { Settings as SettingsIcon } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { AppButton } from './AppButton';
import { accountsEnabled } from '../../app/accounts';
import {
  setMotionFast,
  setMotionReduced,
  useMotionPreferences,
} from '../../app/motion';
import type { Overlay, RulesViewModel } from '../view-models/ui-types';

export interface SettingsControl {
  /** Qué hay puesto encima de la partida. */
  readonly overlay: Overlay;
  /** La semilla de esta partida, en base 36, tal y como viaja en el enlace. */
  readonly seedLabel: string;
  readonly rules: RulesViewModel;
  /**
   * Si hay alguien dentro de la cuenta, para elegir entre «Perfil» e
   * «Iniciar sesión». `false` también cubre a la cuenta cuya marca no ha
   * podido leerse: el menú no puede dejar de ofrecer el acceso por un fallo
   * de red, y la hoja consulta la sesión ella misma al abrirse.
   */
  readonly signedIn: boolean;
  readonly open: () => void;
  readonly showRules: () => void;
  /** Pide la hoja de cuenta, que sustituye al menú. */
  readonly openAccount: () => void;
  readonly close: () => void;
  /**
   * Lo que la hoja de cuenta avisa cuando cambia quién está dentro.
   *
   * Debe ser estable entre renderizaciones: el panel se consulta una vez al
   * montar y su efecto depende de esta función. La que pasa la sesión de juego
   * lo es, y por eso el menú se la puede pasar tal cual.
   */
  readonly onAccountSessionChange: (autenticado: boolean) => void;
}

export interface SettingsMenuProps {
  readonly settings: SettingsControl;
}

/**
 * El engranaje y su menú.
 *
 * Sustituye a la tecla de reglas que se pensó antes. Una tecla es un atajo para
 * quien ya conoce el juego, y lo que hacía falta era justo lo contrario: una
 * puerta visible para quien no lo conoce y no va a adivinar que existe. El menú
 * queda además como el sitio donde añadir ajustes sin tocar el teclado, que es
 * por donde empezará el siguiente, y ya lleva tres: la ayuda, el movimiento y
 * la cuenta.
 *
 * El diálogo de reglas no se abre desde aquí: este componente solo pide que se
 * abra. Quien lo pinta es la pantalla de partida, al mismo nivel que la
 * confirmación de rendirse, porque un diálogo anidado dentro del menú
 * desaparecería con él. Lo mismo vale para la hoja de cuenta.
 *
 * Los dos ajustes de movimiento se pintan con `aria-pressed` y no con una
 * etiqueta que cambia: son conmutadores, y la palabra que los nombra no debe
 * moverse mientras se pulsa —el estado lo dice el botón—. La semilla sigue
 * siendo la excepción, y sigue diciendo en qué estado está: un dato que aparece
 * sin decir de qué es se lee como un número suelto.
 *
 * La cuenta se ofrece solo donde la hay: un despliegue sin cuentas no debe
 * enseñar una puerta que no abre, igual que el panel de la portada. Y la
 * entrada cambia de nombre según lo que haya dentro, porque «Perfil» sin
 * sesión es una mentira e «Iniciar sesión» a quien ya está dentro es ruido.
 *
 * La semilla se revela con un click y no se enseña de entrada. Es un dato que no
 * hace falta para jugar, y en una pantalla que se mira por encima del hombro de
 * alguien, lo que no se pide no se ve.
 *
 * El panel es un `role="group"` etiquetado con «Ajustes», el mismo nombre que el
 * botón: sin él, un lector de pantalla solo sabe que hay un puñado de botones
 * sueltos, y con él puede saltar al bloque de una vez y oír dónde empieza.
 */
export function SettingsMenu({ settings }: SettingsMenuProps) {
  const [seedShown, setSeedShown] = useState(false);
  const motion = useMotionPreferences();
  const conCuentas = accountsEnabled();
  const { overlay } = settings;
  const open = overlay === 'settings';
  const toggleRef = useRef<HTMLButtonElement>(null);
  // La capa que había en el render anterior. Vive en una ref y no en estado
  // porque solo sirve para detectar el cierre, no para pintar nada.
  const previousOverlay = useRef(overlay);

  /*
   * Al cerrar una capa, el foco vuelve al engranaje.
   *
   * Con el menú o una hoja abiertos, el foco está dentro de ellos, y al cerrar
   * esos elementos desaparecen del árbol: sin este efecto el foco cae al
   * `body`, que no tiene dónde quedarse visible, y quien navega con teclado
   * pierde su sitio sin poder recuperarlo —el foco perdido no vuelve solo—.
   * El engranaje es el sitio del que se salió, es el primer control de la
   * página y su contorno ya se marca con el teclado, así que desde ahí el
   * tabulador sigue teniendo sentido.
   *
   * Solo actúa al pasar de una capa a ninguna. Al pasar del menú a una hoja,
   * el foco es de la hoja, que lo pide al montar, y aquí no hay nada que
   * hacer; y al montar no actúa, porque no se ha cerrado nada: el foco debe
   * seguir donde lo puso la pantalla, que es su encabezado.
   */
  useEffect(() => {
    const before = previousOverlay.current;
    previousOverlay.current = overlay;
    if (before !== 'none' && overlay === 'none') {
      toggleRef.current?.focus();
    }
  }, [overlay]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || !open) {
      return;
    }

    event.preventDefault();
    settings.close();
  }

  return (
    <div className="settings" onKeyDown={handleKeyDown}>
      <button
        aria-controls="settings-menu"
        aria-expanded={open}
        aria-label="Ajustes"
        className="settings__toggle"
        onClick={open ? settings.close : settings.open}
        ref={toggleRef}
        type="button"
      >
        <SettingsIcon aria-hidden="true" size={18} strokeWidth={1.7} />
      </button>
      {open ? (
        <div
          aria-labelledby="settings-heading"
          className="settings__panel"
          id="settings-menu"
          role="group"
        >
          <p className="settings__heading" id="settings-heading">
            Ajustes
          </p>
          <ul className="settings__list">
            <li>
              <AppButton
                className="settings__item"
                onClick={settings.showRules}
                variant="quiet"
              >
                Información
              </AppButton>
            </li>
            <li>
              <AppButton
                aria-pressed={motion.reduced}
                className="settings__item"
                onClick={() => {
                  setMotionReduced(!motion.reduced);
                }}
                variant="quiet"
              >
                Movimiento reducido
              </AppButton>
            </li>
            <li>
              <AppButton
                aria-pressed={motion.fast}
                className="settings__item"
                onClick={() => {
                  setMotionFast(!motion.fast);
                }}
                variant="quiet"
              >
                Velocidad x2
              </AppButton>
            </li>
            {conCuentas ? (
              <li>
                <AppButton
                  className="settings__item"
                  onClick={settings.openAccount}
                  variant="quiet"
                >
                  {settings.signedIn ? 'Perfil' : 'Iniciar sesión'}
                </AppButton>
              </li>
            ) : null}
            <li>
              <AppButton
                aria-pressed={seedShown}
                className="settings__item"
                onClick={() => {
                  setSeedShown((shown) => !shown);
                }}
                variant="quiet"
              >
                {seedShown ? 'Ocultar la semilla' : 'Mostrar la semilla'}
              </AppButton>
            </li>
          </ul>
          {seedShown ? (
            <p className="settings__seed">{settings.seedLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
