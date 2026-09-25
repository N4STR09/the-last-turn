import {
  BookOpen,
  Fish,
  Map,
  Moon,
  Search,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { GameAction } from '../../game/types';
import { AppButton } from './AppButton';

export interface ActionGridProps {
  readonly onAction: (action: GameAction) => void;
}

interface ActionDefinition {
  readonly id: GameAction;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

const actionDefinitions: ReadonlyArray<ActionDefinition> = [
  {
    id: 'forage',
    label: 'Buscar comida',
    description: 'Rastrea una fuente de alimento.',
    icon: Search,
  },
  {
    id: 'rest',
    label: 'Descansar',
    description: 'Recupera algo de energía.',
    icon: Moon,
  },
  {
    id: 'explore',
    label: 'Explorar',
    description: 'Busca refugio o comida.',
    icon: Map,
  },
  {
    id: 'repair',
    label: 'Fabricar o reparar refugio',
    description: 'Intenta levantar un lugar seguro.',
    icon: Wrench,
  },
  {
    id: 'fish',
    label: 'Cazar o pescar',
    description: 'Persigue una captura útil.',
    icon: Fish,
  },
  {
    id: 'eat',
    label: 'Comer',
    description: 'Intenta aprovechar lo que llevas.',
    icon: Utensils,
  },
  {
    id: 'help',
    label: 'Ayuda',
    description: 'Consulta las reglas de esta partida.',
    icon: BookOpen,
  },
];

export function ActionGrid({ onAction }: ActionGridProps) {
  return (
    <section
      className="action-panel screen-section"
      aria-labelledby="actions-heading"
    >
      <div className="section-heading">
        <p className="eyebrow">Elige tu siguiente movimiento</p>
        <h2 id="actions-heading">Acciones</h2>
      </div>
      <div className="action-grid">
        {actionDefinitions.map(({ id, label, description, icon: Icon }) => (
          <AppButton
            aria-label={label}
            className="action-button"
            data-action={id}
            key={id}
            onClick={() => onAction(id)}
            variant="quiet"
          >
            <span className="action-button__icon" aria-hidden="true">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <span className="action-button__copy">
              <strong>{label}</strong>
              <span>{description}</span>
            </span>
          </AppButton>
        ))}
      </div>
    </section>
  );
}
