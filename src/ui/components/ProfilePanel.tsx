import { useEffect, useState } from 'react';

import { AppButton } from './AppButton';
import { achievementLabel, characterLabel } from '../../app/progression';
import type { ProgressionSummary } from '../../app/progression';
import { fetchStats } from '../../app/stats';

/**
 * El perfil de la cuenta que está dentro: quién es, lo que ha ganado y lo que
 * ha aguantado.
 *
 * Se separa de `AccountPanel` porque son dos responsabilidades distintas y ya
 * venían mezcladas: la cuenta gestiona quién está dentro —entrar, crear, salir—
 * y el perfil solo pinta lo que esa sesión trae, que es lo que cambia con cada
 * partida jugada y no con cada apertura de formulario. El perfil no decide nada:
 * recibe el correo y la colección ya leídos y consulta él mismo la marca, de
 * modo que un cambio en cómo se pinta la colección no puede tocar el acceso.
 *
 * No pinta nada de colección mientras no la haya: `progression === null` cubre
 * a la vez la consulta que aún no ha llegado y la que no se pudo hacer, con el
 * mismo criterio silencioso de siempre —un fallo no pone un aviso rojo en una
 * pantalla que funciona—, y el correo y la salida se ven igual, porque lo único
 * que hace falta para enseñarlos es la sesión, que ya se sabe.
 *
 * La marca se consulta con `fetchStats`, la misma frontera que usa la sesión de
 * juego, y se enseña solo cuando hay: sin sesión, sin red o con una cuenta que
 * todavía no ha batido nada no hay cifra que pintar, y la línea no aparece en
 * lugar de enseñar un cero inventado.
 */

export interface ProfilePanelProps {
  /** El correo de la sesión abierta. */
  readonly email: string;
  /** La colección de la cuenta, o `null` mientras no haya ninguna que enseñar. */
  readonly progression: ProgressionSummary | null;
  /** Cierra la sesión, con el mismo aviso que le llega a la cuenta. */
  readonly onSignOut: () => void;
}

export function ProfilePanel({
  email,
  progression,
  onSignOut,
}: ProfilePanelProps) {
  // La marca de mejores turnos. `null` mientras no la haya —todavía sin leer,
  // cuenta sin marca o consulta fallida—, que para pintar es lo mismo en los
  // tres casos: no hay cifra, no hay línea.
  const [mejor, setMejor] = useState<number | null>(null);

  // La consulta de la marca. Se hace una vez al montar, que es cuando hay
  // alguien dentro —el perfil solo existe con sesión—, y el `vivo` es el mismo
  // cuidado que en el resto de paneles: si el perfil se va antes de que la
  // respuesta llegue, no se escribe en una pantalla que ya no está.
  useEffect(() => {
    let vivo = true;
    void fetchStats().then((resumen) => {
      if (vivo) {
        setMejor(resumen?.bestTurns ?? null);
      }
    });

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <>
      <div className="account-panel__session">
        <p className="account-panel__mail">{email}</p>
        <AppButton onClick={onSignOut} variant="quiet">
          Cerrar sesión
        </AppButton>
      </div>
      {progression === null ? null : (
        <div className="account-panel__collection">
          <p className="account-panel__coins">
            {progression.coins === 1
              ? '1 moneda'
              : `${progression.coins} monedas`}
          </p>
          {progression.unlocks.length > 0 ? (
            <p className="account-panel__line">
              <span className="account-panel__key">Personajes</span>{' '}
              {progression.unlocks.map(characterLabel).join(' · ')}
            </p>
          ) : null}
          {progression.achievements.length > 0 ? (
            <p className="account-panel__line">
              <span className="account-panel__key">Logros</span>{' '}
              {progression.achievements.map(achievementLabel).join(' · ')}
            </p>
          ) : null}
        </div>
      )}
      {mejor === null ? null : (
        <p className="account-panel__line">
          <span className="account-panel__key">Mejor marca</span>{' '}
          {mejor === 1 ? '1 turno' : `${mejor} turnos`}
        </p>
      )}
    </>
  );
}
