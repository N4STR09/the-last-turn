import type { Difficulty } from '../../game';
import { AppButton } from './AppButton';

export interface DifficultyCardProps {
  readonly difficulty: Difficulty;
  readonly title: string;
  readonly description: string;
  readonly onSelect: (difficulty: Difficulty) => void;
}

export function DifficultyCard({
  difficulty,
  title,
  description,
  onSelect,
}: DifficultyCardProps) {
  const titleId = `difficulty-${difficulty}-title`;

  return (
    <section className="difficulty-card" aria-labelledby={titleId}>
      <div className="difficulty-card__content">
        <p className="difficulty-card__label">Modo de supervivencia</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>
      <AppButton
        variant="secondary"
        onClick={() => onSelect(difficulty)}
      >
        Jugar en {title}
      </AppButton>
    </section>
  );
}
