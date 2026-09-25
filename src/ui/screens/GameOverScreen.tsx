import type { DeathCause, Difficulty } from '../../game/types';
import { AppButton } from '../components/AppButton';
import type { GameOverViewModel } from '../view-models/ui-types';

export interface GameOverScreenProps {
  readonly model: GameOverViewModel;
  readonly onRestart: () => void;
}

const difficultyLabels: Record<Difficulty, string> = {
  normal: 'Normal',
  agony: 'Agonía',
};

const causeMessages: Record<DeathCause, string> = {
  hunger:
    'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
  energy: 'El cuerpo cedió al agotamiento. Cada paso fue el último.',
  health: 'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
};

function formatTurns(turns: number): string {
  return turns === 1
    ? '1 turno aguantado'
    : `${turns} turnos aguantados`;
}

export function GameOverScreen({ model, onRestart }: GameOverScreenProps) {
  return (
    <main
      className="screen screen--game-over"
      aria-labelledby="game-over-title"
    >
      <section className="game-over-panel">
        <p className="eyebrow">El último aliento</p>
        <h1 id="game-over-title" tabIndex={-1}>
          La partida ha terminado
        </h1>
        <div className="game-over-panel__alert" role="alert">
          <p>{causeMessages[model.reportedCause]}</p>
        </div>
        <dl className="game-over-meta">
          <div>
            <dt>Dificultad</dt>
            <dd>{difficultyLabels[model.difficulty]}</dd>
          </div>
          <div>
            <dt>Supervivencia</dt>
            <dd>{formatTurns(model.turnsSurvived)}</dd>
          </div>
        </dl>
        <AppButton onClick={onRestart}>Volver a jugar</AppButton>
      </section>
    </main>
  );
}
