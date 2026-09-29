import type { GameAction } from '../../game/types';
import { ActionGrid } from '../components/ActionGrid';
import { ResolutionPanel } from '../components/ResolutionPanel';
import { ResourcePanel } from '../components/ResourcePanel';
import { RulesOverlay } from '../components/RulesOverlay';
import { SettingsMenu } from '../components/SettingsMenu';
import type { SettingsControl as Settings } from '../components/SettingsMenu';
import type { SurrenderControl as Surrender } from '../components/SurrenderControl';
import type { GameViewModel } from '../view-models/ui-types';

export interface GameScreenProps {
  readonly model: GameViewModel;
  readonly settings: Settings;
  readonly onAction: (action: GameAction) => void;
  readonly surrender: Surrender;
}

/**
 * Pantalla de partida, en el orden que se lee: qué partida es, en qué ronda y
 * con qué nivel, qué tienes, qué acaba de pasar y qué puedes hacer.
 *
 * La dificultad no se escribe aquí a propósito: la calavera de la terminal ya
 * la dice, con cuernos y ojos rojos en Agonía. Repetirla en el banner sería
 * decirlo dos veces de dos maneras, y la segunda sería solo texto.
 */
export function GameScreen({ model, settings, onAction, surrender }: GameScreenProps) {
  /*
   * El rival fantasma tiene tres estados y ninguno es el de dejarlo fuera: sin
   * partidas muertas no hay marca con la que compararse, así que la banner no
   * dice nada; por debajo de la marca se enseña la marca; por encima, la cifra ya
   * es un récord de la sesión y decirlo cambia lo que significa ese número. Un
   * jugador que acaba de batir su mejor partida necesita ver eso, y es justo el
   * momento en que la escala invisible se vuelve visible.
   *
   * La comparación va sobre los turnos **ya aguantados**, no sobre `model.turn`. El
   * contador avanza al consumir el turno, así que la ronda que se ve arriba es la
   * que aún no se ha jugado, y `turn - 1` es lo que llevas. No es un matiz: si
   * miráramos `turn`, el banner diría «Récord» en la ronda que iguala la marca, que
   * es empatar, y al morir en esa misma ronda la pantalla de muerte no llevaría
   * «Nuevo récord». El juego prometería algo y luego lo negaría en la misma
   * partida. Las dos medidas tienen que ser la misma, y la del parte es la
   * correcta porque es la que se imprime en el informe.
   *
   * Aquí no hay ninguna línea de texto que diga cuánto falta. Antes la había —
   * «Aguantados 3 de 7»—, y se quitó porque la cifra del rival fantasma ya es el
   * marcador: repetirlo en una frase añadía un dato derivado sin añadir
   * información, y encima obligaba a decidir si esa frase es una pista o un reproche
   * según lo lejos que vaya el jugador. El marcador es un número y el jugador hace
   * con él lo que quiera.
   */
  const best = model.personalBest;
  const survived = model.turn - 1;
  const beaten = best !== null && survived > best;

  return (
    <main className="screen screen--game" aria-labelledby="game-title">
      <header className="banner">
        <h1 className="banner__title" id="game-title" tabIndex={-1}>
          The Last Turn
        </h1>
        <SettingsMenu settings={settings} />
        <p className="banner__readout">
          <span className="banner__stat">
            <span className="banner__stat-label">Ronda</span>
            <span className="banner__stat-value">{model.turn}</span>
          </span>
          <span className="banner__stat">
            <span className="banner__stat-label">Nivel</span>
            <span className="banner__stat-value">{model.threat}</span>
          </span>
          {best === null ? null : (
            <span className="banner__stat banner__stat--ghost">
              <span className="banner__stat-label">
                {beaten ? 'Récord' : 'Tu mejor'}
              </span>
              <span className="banner__stat-value">
                {beaten ? survived : best}
              </span>
            </span>
          )}
        </p>
      </header>
      <ResourcePanel
        stats={model.stats}
        shelter={model.shelter}
        deltas={model.resolution?.deltas ?? null}
        turn={model.turn}
      />
      <ResolutionPanel
        difficulty={model.difficulty}
        forecast={model.forecast}
        resolution={model.resolution}
        turn={model.turn}
      />
      <ActionGrid
        actions={model.actions}
        onAction={onAction}
        surrender={surrender}
      />
      {settings.overlay === 'rules' ? (
        <RulesOverlay model={settings.rules} onClose={settings.close} />
      ) : null}
    </main>
  );
}
