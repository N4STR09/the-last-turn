import type { Difficulty } from '../../game/types';
import type { ResolutionViewModel } from '../view-models/ui-types';
import { Skull } from './Skull';

export interface ResolutionPanelProps {
  readonly resolution: ResolutionViewModel | null;
  readonly turn: number;
  readonly difficulty: Difficulty;
}

/**
 * Terminal del turno. Muestra solo la última resolución, no un historial: la
 * información que importa es qué acaba de pasar, y acumular turnos aquí solo
 * empujaría los botones fuera de la pantalla.
 *
 * `role="status"` sigue en la capa viva y no en la caja entera, porque un
 * anuncio de región completa repetiría el rótulo de la calavera en cada turno.
 */
export function ResolutionPanel({
  resolution,
  turn,
  difficulty,
}: ResolutionPanelProps) {
  return (
    <section className="terminal" aria-label="Registro del turno">
      <Skull difficulty={difficulty} />
      <div
        aria-atomic="true"
        aria-live="polite"
        className="terminal__screen"
        role="status"
      >
        {resolution === null ? (
          <p className="terminal__idle">Sin órdenes todavía.</p>
        ) : (
          <div data-action-id={resolution.actionId}>
            <p className="terminal__prompt">
              <span className="terminal__turn">&gt; ronda {turn}</span>
              <span className="terminal__verb">{resolution.headline}</span>
            </p>
            {resolution.details.length > 0 ? (
              <ul className="terminal__details">
                {resolution.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {resolution.deltas.length > 0 ? (
              <ul
                aria-label="Cambios de recursos"
                className="terminal__deltas"
              >
                {resolution.deltas.map((delta) => (
                  <li data-tone={delta.tone} key={delta.id}>
                    {delta.label} {delta.value}
                  </li>
                ))}
              </ul>
            ) : null}
            {resolution.events.length > 0 ? (
              <div className="terminal__events">
                {resolution.events.map((event, index) => (
                  <div
                    className="terminal__event"
                    data-event-type={event.type}
                    // Con tiradas extra el mismo evento puede repetirse, así
                    // que la clave necesita el índice además del tipo.
                    key={`${event.type}-${index}`}
                  >
                    <strong>{event.headline}</strong>
                    <p>{event.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
