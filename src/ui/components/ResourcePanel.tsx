import {
  Apple,
  Drumstick,
  HeartPulse,
  Tent,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type {
  ResourceDeltaViewModel,
  ResourceViewModel,
  ShelterViewModel,
  StatId,
} from '../view-models/ui-types';

export interface ResourcePanelProps {
  readonly stats: ReadonlyArray<ResourceViewModel>;
  readonly shelter: ShelterViewModel;
  /**
   * Los cambios del turno que acaba de resolverse, para el flotante de cada barra.
   * `null` cuando no hay resolución todavía: es lo mismo que un cambio vacío, y se
   * distingue para que quien lo lea sepa que no es que falte el dato.
   */
  readonly deltas: ReadonlyArray<ResourceDeltaViewModel> | null;
  /**
   * Turno actual. No se dibuja con él: solo cambia la clave del flotante para que
   * la animación vuelva a empezar cuando llega un cambio nuevo. Sin esto la cifra
   * saldría una vez y se quedaría quieta el resto de la partida.
   */
  readonly turn: number;
}

const resourceIcons: Record<StatId, LucideIcon> = {
  hunger: Drumstick,
  energy: Zap,
  food: Apple,
  health: HeartPulse,
};

/**
 * Las barras que llevan flotante.
 *
 * Son las tres que se mueven en todos los turnos, que es donde un cambio se pierde
 * de vista: la salud por las heridas, la energía y el hambre por el coste de cada
 * turno. La comida queda fuera: es la única que se acumula, y lo que su barra no
 * llega a decir lo dice el `+` de saturación.
 *
 * El flotante no es el canal del dato. Los cambios salen todos en la terminal, en
 * texto y en el mismo orden que las filas. Es el canal del sitio: la cifra se
 * levanta en la barra, que es donde está la vista cuando se elige la acción.
 */
const floatingStats: ReadonlySet<StatId> = new Set([
  'health',
  'energy',
  'hunger',
]);

/**
 * Lo que tienes, en dos bloques distintos porque son dos cosas distintas: cuatro
 * cifras, de las que tres suben y bajan y una solo baja, y un techo que o existe
 * o no existe. Mezclarlos en la misma rejilla obligaba a inventar un cuarto
 * formato de fila para un dato que no es una cifra, y el resultado se leía como
 * un número más.
 */
export function ResourcePanel({
  stats,
  shelter,
  deltas,
  turn,
}: ResourcePanelProps) {
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
          // Más unidades que bloques es siempre la misma imagen: la barra llena.
          // Y una barra llena no dice si sobran cuatro o doscientas. El `+` avisa
          // de que la cuenta se ha salido de ahí, no de cuánto: el número exacto
          // está escrito al lado y ese sigue siendo el dato.
          const saturated = resource.units > resource.capacity;
          const delta =
            deltas?.find((change) => change.id === resource.id) ?? null;
          const float =
            delta !== null && floatingStats.has(resource.id) ? delta : null;

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
               * La barra va oculta a lectores de pantalla: la cifra y la etiqueta
               * ya están en texto a su lado, así que los bloques son redundancia
               * visual. Un bloque por unidad, que es lo que hace legible de un
               * vistazo una barra casi vacía.
               *
               * El `+` y el flotante viven dentro de la barra y heredan ese
               * ocultamiento. Los dos son pistas sobre una cifra que ya está
               * escrita al lado, y el flotante repite además lo que la terminal
               * acaba de narrar: no añaden nada a un lector de pantalla, y en un
               * lector de voz serían ruido antes que ayuda.
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
                {saturated ? <span className="stat__bar-over">+</span> : null}
                {/*
                 * La clave lleva el turno a propósito: es lo que reinicia la
                 * animación. Sin ella React reutiliza el nodo y el CSS solo
                 * reproduciría la animación del primer cambio. Es la forma
                 * idiomática de repetir una animación declarativa sin estado ni
                 * temporizadores, y por eso no hay ningún efecto que la dispare.
                 */}
                {float === null ? null : (
                  <span
                    className="stat__float"
                    data-tone={float.tone}
                    key={`turno-${turn}`}
                  >
                    {float.value}
                  </span>
                )}
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
