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
import type { ActionViewModel } from '../view-models/ui-types';
import { AppButton } from './AppButton';

export interface ActionGridProps {
  readonly actions: ReadonlyArray<ActionViewModel>;
  readonly onAction: (action: GameAction) => void;
}

const actionIcons: Record<GameAction, LucideIcon> = {
  forage: Search,
  rest: Moon,
  explore: Map,
  repair: Wrench,
  fish: Fish,
  eat: Utensils,
  help: BookOpen,
};

export function ActionGrid({ actions, onAction }: ActionGridProps) {
  return (
    <div
      aria-label="Acciones"
      className="action-grid"
      role="group"
    >
      {actions.map((action) => {
        const Icon = actionIcons[action.id];

        return (
          <AppButton
            className="action-button"
            data-action={action.id}
            key={action.id}
            onClick={() => onAction(action.id)}
            variant="quiet"
          >
            <span className="action-button__icon">
              <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
            </span>
            <span className="action-button__copy">
              <strong>{action.label}</strong>
              <span className="action-button__cost">{action.cost}</span>
            </span>
          </AppButton>
        );
      })}
    </div>
  );
}
