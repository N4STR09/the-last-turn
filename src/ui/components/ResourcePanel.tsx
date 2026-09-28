import {
  Apple,
  Drumstick,
  HeartPulse,
  Tent,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type {
  ResourceViewModel,
  ShelterViewModel,
  StatId,
} from '../view-models/ui-types';

export interface ResourcePanelProps {
  readonly stats: ReadonlyArray<ResourceViewModel>;
  readonly shelter: ShelterViewModel;
}

const resourceIcons: Record<StatId, LucideIcon> = {
  hunger: Drumstick,
  energy: Zap,
  food: Apple,
  health: HeartPulse,
};

/**
 * Lo que tienes, en dos bloques distintos porque son dos cosas distintas: cuatro
 * cifras, de las que tres suben y bajan y una solo baja, y un techo que o existe
 * o no existe. Mezclarlos en la misma rejilla obligaba a inventar un cuarto
 * formato de fila para un dato que no es una cifra, y el resultado se leía como
 * un número más.
 */
export function ResourcePanel({ stats, shelter }: ResourcePanelProps) {
  return (
    <>
      <ul className="stats" aria-label="Lo que te mantiene en pie">
        {stats.map((resource) => {
          const Icon = resourceIcons[resource.id];
          const lit = Math.min(Math.max(resource.units, 0), resource.capacity);
          // El estado solo se escribe cuando hay algo que avisar. En el resto
          // de la partida la fila es etiqueta, cifra y barra, que es toda la
          // información que hace falta. Y cuando aparece, el aviso ya no depende
          // del color ni del parpadeo: está en texto.
          const hasWarning = resource.tone === 'warning';

          return (
            <li
              className={[
                'stat',
                `stat--${resource.id}`,
                hasWarning ? 'stat--critical' : '',
              ]
                .filter((name) => name !== '')
                .join(' ')}
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
                * legible de un vistazo una barra casi vacía.
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
      {/*
        * El refugio va debajo y con su propio formato, no como una fila más. Un
        * bloque, como el resto del lenguaje de barras, y la palabra entera que
        * lo dice: no hay ningún punto en el que quedarse sin techo sea una
        * muerte, así que aquí no hay aviso ni parpadeo, solo una posición.
        */}
      <p className="shelter" data-tone={shelter.tone}>
        {/*
         * Icono y etiqueta en un solo elemento, igual que hace `.stat__label`
         * con las suyas: es lo que permite que el refugio use la misma rejilla
         * de cuatro columnas y caiga cuadrado con las barras de arriba en lugar
         * de medirse a ojo.
         */}
        <span className="shelter__label">
          <span className="shelter__icon">
            <Tent aria-hidden="true" size={12} strokeWidth={2} />
          </span>
          {shelter.label}
        </span>
        <strong className="shelter__status">{shelter.status}</strong>
        <span aria-hidden="true" className="shelter__block">
          <span
            className={
              shelter.hasShelter
                ? 'stat__block stat__block--filled'
                : 'stat__block'
            }
          />
        </span>
      </p>
    </>
  );
}
