import { Settings as SettingsIcon } from 'lucide-react';
import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { AppButton } from './AppButton';
import type { Overlay, RulesViewModel } from '../view-models/ui-types';

export interface SettingsControl {
  /** Qué hay puesto encima de la partida. */
  readonly overlay: Overlay;
  /** La semilla de esta partida, en base 36, tal y como viaja en el enlace. */
  readonly seedLabel: string;
  readonly rules: RulesViewModel;
  readonly open: () => void;
  readonly showRules: () => void;
  readonly close: () => void;
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
 * queda además como el sitio donde añadir ajustes sin tocar el teclado, que es por
 * donde empezará el siguiente.
 *
 * El diálogo de reglas no se abre desde aquí: este componente solo pide que se
 * abra. Quien lo pinta es la pantalla de partida, al mismo nivel que la
 * confirmación de rendirse, porque un diálogo anidado dentro del menú
 * desaparecería con él.
 *
 * La semilla se revela con un click y no se enseña de entrada. Es un dato que no
 * hace falta para jugar, y en una pantalla que se mira por encima del hombro de
 * alguien, lo que no se pide no se ve. El botón dice en qué estado está: un dato
 * que aparece sin decir de qué es se lee como un número suelto.
 */
export function SettingsMenu({ settings }: SettingsMenuProps) {
  const [seedShown, setSeedShown] = useState(false);
  const open = settings.overlay === 'settings';

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
        type="button"
      >
        <SettingsIcon aria-hidden="true" size={18} strokeWidth={1.7} />
      </button>
      {open ? (
        <div className="settings__panel" id="settings-menu">
          <p className="settings__heading">Ajustes</p>
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
