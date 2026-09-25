import type { Difficulty, GameAction } from '../../game/types';
import { ActionGrid } from '../components/ActionGrid';
import { ResolutionPanel } from '../components/ResolutionPanel';
import { ResourcePanel } from '../components/ResourcePanel';
import type { GameViewModel } from '../view-models/ui-types';

export interface GameScreenProps {
  readonly model: GameViewModel;
  readonly onAction: (action: GameAction) => void;
}

const difficultyLabels: Record<Difficulty, string> = {
  normal: 'Normal',
  agony: 'Agonía',
};

export function GameScreen({ model, onAction }: GameScreenProps) {
  return (
    <main className="screen screen--game" aria-labelledby="game-title">
      <header className="game-header">
        <div>
          <p className="eyebrow">Supervivencia por turnos</p>
          <h1 id="game-title" tabIndex={-1}>
            La partida
          </h1>
        </div>
        <dl className="game-meta">
          <div>
            <dt>Turno</dt>
            <dd>{model.turn}</dd>
          </div>
          <div>
            <dt>Dificultad</dt>
            <dd>{difficultyLabels[model.difficulty]}</dd>
          </div>
        </dl>
      </header>
      <div className="game-layout">
        <ResourcePanel resources={model.resources} />
        <ResolutionPanel resolution={model.resolution} />
        <ActionGrid onAction={onAction} />
      </div>
    </main>
  );
}
