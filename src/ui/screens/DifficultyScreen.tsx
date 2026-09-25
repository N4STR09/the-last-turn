import type { Difficulty } from '../../game';
import { DifficultyCard } from '../components/DifficultyCard';

export interface DifficultyScreenProps {
  readonly onSelect: (difficulty: Difficulty) => void;
}

export function DifficultyScreen({ onSelect }: DifficultyScreenProps) {
  return (
    <main className="screen screen--difficulty" aria-labelledby="difficulty-title">
      <header className="screen-header">
        <p className="eyebrow">Elige tu camino</p>
        <h1 id="difficulty-title" tabIndex={-1}>
          Elige dificultad
        </h1>
        <p>
          Elige cómo quieres jugar la partida. Puedes cambiar de dificultad al
          comenzar otra vez.
        </p>
      </header>
      <div className="difficulty-grid">
        <DifficultyCard
          difficulty="normal"
          title="Normal"
          description="Una partida sin eventos aleatorios. Las acciones y la escalada siguen activas."
          onSelect={onSelect}
        />
        <DifficultyCard
          difficulty="agony"
          title="Agonía"
          description="Eventos aleatorios pueden destruir el refugio, robar comida o quitarte salud."
          onSelect={onSelect}
        />
      </div>
      <p className="rules-note">
        Solo Agonía añade eventos aleatorios. En las dos dificultades el hambre
        sube, la energía baja, y la escalada sube el nivel cada pocos turnos
        hasta que todo se vuelve más caro.
      </p>
    </main>
  );
}
