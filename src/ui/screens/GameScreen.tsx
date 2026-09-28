import type { GameAction } from '../../game/types';
import { ActionGrid } from '../components/ActionGrid';
import { ResolutionPanel } from '../components/ResolutionPanel';
import { ResourcePanel } from '../components/ResourcePanel';
import type { SurrenderControl as Surrender } from '../components/SurrenderControl';
import type { GameViewModel } from '../view-models/ui-types';

export interface GameScreenProps {
  readonly model: GameViewModel;
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
export function GameScreen({ model, onAction, surrender }: GameScreenProps) {
  return (
    <main className="screen screen--game" aria-labelledby="game-title">
      <header className="banner">
        <h1 className="banner__title" id="game-title" tabIndex={-1}>
          The Last Turn
        </h1>
        <p className="banner__readout">
          <span className="banner__stat">
            <span className="banner__stat-label">Ronda</span>
            <span className="banner__stat-value">{model.turn}</span>
          </span>
          <span className="banner__stat">
            <span className="banner__stat-label">Nivel</span>
            <span className="banner__stat-value">{model.threat}</span>
          </span>
        </p>
      </header>
      <ResourcePanel stats={model.stats} shelter={model.shelter} />
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
    </main>
  );
}
