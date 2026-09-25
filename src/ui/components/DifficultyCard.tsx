import type { Difficulty } from '../../game';
import { AppButton } from './AppButton';
import { Skull } from './Skull';

export interface DifficultyCardProps {
  readonly difficulty: Difficulty;
  readonly title: string;
  readonly description: string;
  readonly onSelect: (difficulty: Difficulty) => void;
}

/**
 * Tarjeta de dificultad. La de Agonía lleva la misma calavera que la partida,
 * en pequeño y más apagada todavía, para que el jugador vea la diferencia antes
 * de empezar y no se la encuentre de golpe dentro del juego.
 */
export function DifficultyCard({
  difficulty,
  title,
  description,
  onSelect,
}: DifficultyCardProps) {
  const titleId = `difficulty-${difficulty}-title`;

  return (
    <section
      className={`difficulty-card difficulty-card--${difficulty}`}
      aria-labelledby={titleId}
    >
      {difficulty === 'agony' ? (
        <span className="difficulty-card__skull">
          <Skull difficulty="agony" />
        </span>
      ) : null}
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
