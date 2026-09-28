import {
  Bandage,
  Map,
  Moon,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { GameAction } from '../../game/types';
import type { ActionViewModel } from '../view-models/ui-types';
import { AppButton } from './AppButton';
import {
  SurrenderControl,
  type SurrenderControl as Surrender,
} from './SurrenderControl';

export interface ActionGridProps {
  readonly actions: ReadonlyArray<ActionViewModel>;
  readonly onAction: (action: GameAction) => void;
  readonly surrender: Surrender;
}

const actionIcons: Record<GameAction, LucideIcon> = {
  explore: Map,
  eat: Utensils,
  cure: Bandage,
  rest: Moon,
  repair: Wrench,
};

/**
 * Las cinco acciones y, al final, rendirse. Comparte rejilla con ellas para que
 * quede claro que es una más y no un enlace perdido en el margen, pero ocupa la
 * fila entera y lleva otro color: es la única que tira la partida.
 */
export function ActionGrid({ actions, onAction, surrender }: ActionGridProps) {
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
      <SurrenderControl surrender={surrender} />
    </div>
  );
}
