import type { ResolutionViewModel } from '../view-models/ui-types';

export interface ResolutionPanelProps {
  readonly resolution: ResolutionViewModel | null;
}

export function ResolutionPanel({ resolution }: ResolutionPanelProps) {
  return (
    <section
      className="resolution-panel screen-section"
      aria-labelledby="resolution-heading"
    >
      <div className="section-heading">
        <p className="eyebrow">Lo que acaba de ocurrir</p>
        <h2 id="resolution-heading">Última resolución</h2>
      </div>
      <div
        className="resolution-panel__live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-labelledby="resolution-heading"
      >
        {resolution === null ? (
          <p className="empty-state">
            Todavía no has realizado ninguna acción.
          </p>
        ) : (
          <div data-action-id={resolution.actionId}>
            <p className="resolution-panel__headline">{resolution.headline}</p>
            {resolution.details.length > 0 ? (
              <ul
                className="resolution-panel__details"
                aria-label="Detalles de la acción"
              >
                {resolution.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {resolution.deltas.length > 0 ? (
              <ul
                className="resolution-panel__deltas"
                aria-label="Cambios de recursos"
              >
                {resolution.deltas.map((delta) => (
                  <li
                    className={`resource-delta resource-delta--${delta.tone}`}
                    data-resource-id={delta.id}
                    key={delta.id}
                  >
                    {delta.label}: {delta.value}
                  </li>
                ))}
              </ul>
            ) : null}
            {resolution.events.length > 0 ? (
              <div className="resolution-events">
                {resolution.events.map((event, index) => (
                  <div
                    className="resolution-event"
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
