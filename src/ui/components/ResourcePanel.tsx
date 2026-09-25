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
    <ul className="stats" aria-label="Lo que te mantiene en pie">
      {resources.map((resource) => {
        const Icon = resourceIcons[resource.id];
        const lit = Math.min(Math.max(resource.units, 0), resource.capacity);
        // El estado solo se escribe cuando hay algo que avisar. En el resto de
        // la partida la fila es etiqueta, cifra y barra, que es toda la
        // información que hace falta. Y cuando aparece, el aviso ya no depende
        // del color ni del parpadeo: está en texto.
        const hasWarning = resource.tone === 'warning';

        return (
          <li
            className={[
              'stat',
              `stat--${resource.id}`,
              resource.critical ? 'stat--critical' : '',
            ]
              .filter((name) => name !== '')
              .join(' ')}
            data-critical={resource.critical}
            data-resource-id={resource.id}
            key={resource.id}
          >
            <span className="stat__label">
              <span className="stat__icon">
                <Icon aria-hidden="true" size={12} strokeWidth={2} />
              </span>
              {resource.label}
            </span>
            <span className="stat__value">{resource.value}</span>
            {/*
              * La barra va oculta a lectores de pantalla: la cifra y la
              * etiqueta ya están en texto a su lado, así que los bloques son
              * redundancia visual. Un bloque por unidad, que es lo que hace
              // legible de un vistazo una barra casi vacía.
              */}
            <span
              aria-hidden="true"
              className="stat__bar"
              data-units={resource.units}
            >
              {Array.from({ length: resource.capacity }, (_, index) => (
                <span
                  className={
                    index < lit
                      ? 'stat__block stat__block--filled'
                      : 'stat__block'
                  }
                  key={index}
                />
              ))}
            </span>
            <span className="stat__state">
              {hasWarning ? resource.stateLabel : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
