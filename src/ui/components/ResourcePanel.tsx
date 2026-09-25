import {
  Apple,
  Drumstick,
  Tent,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type {
  ResourceId,
  ResourceViewModel,
} from '../view-models/ui-types';

export interface ResourcePanelProps {
  readonly resources: ReadonlyArray<ResourceViewModel>;
}

const resourceIcons: Record<ResourceId, LucideIcon> = {
  hunger: Drumstick,
  energy: Zap,
  food: Apple,
  shelter: Tent,
};

export function ResourcePanel({ resources }: ResourcePanelProps) {
  return (
    <section
      className="resource-panel screen-section"
      aria-labelledby="resources-heading"
    >
      <div className="section-heading">
        <p className="eyebrow">Lo que te mantiene en pie</p>
        <h2 id="resources-heading">Recursos</h2>
      </div>
      <ul className="resource-grid" aria-label="Recursos disponibles">
        {resources.map((resource) => {
          const Icon = resourceIcons[resource.id];

          return (
            <li
              className={`resource-card resource-card--${resource.tone}`}
              data-resource-id={resource.id}
              key={resource.id}
            >
              <div className="resource-card__heading">
                <span className="resource-card__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="resource-card__label">{resource.label}</span>
              </div>
              <strong className="resource-card__value">{resource.value}</strong>
              <span className="resource-card__state">{resource.stateLabel}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
