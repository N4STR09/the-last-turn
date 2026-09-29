import { useState } from 'react';

import type { DeathCause, Difficulty } from '../../game/types';
import { AppButton } from '../components/AppButton';
import type { GameOverViewModel } from '../view-models/ui-types';

export interface GameOverScreenProps {
  readonly model: GameOverViewModel;
  /** Enlace que reproduce esta partida, o `null` si no se puede construir. */
  readonly shareUrl: string | null;
  readonly onRestart: () => void;
}

const difficultyLabels: Record<Difficulty, string> = {
  normal: 'Normal',
  agony: 'Agonía',
};

/*
 * El mensaje de causa es lo primero que se lee después del título, y es
 * deliberadamente lo único. Antes aquí iba también la autopsia —«Moriste de hambre
 * en el turno 7, con 2 de comida guardada»—, y se quitó: el parte de abajo ya
 * dice la causa, el turno y el estado final, y encima del `Game Over` lo que
 * funciona es el remate. La causa sigue reconociéndose igual porque el remate es
 * distinto para las cuatro, y el de rendirse lo dice sin ninguna otra frase.
 */
const causeMessages: Record<DeathCause, string> = {
  hunger:
    'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
  energy: 'El cuerpo cedió al agotamiento. Cada paso fue el último.',
  health: 'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
  surrender:
    'Te has autoeliminado con un botón. El refugio queda intacto y tú, desinstalado.',
};

function formatTurns(turns: number): string {
  return turns === 1
    ? '1 turno aguantado'
    : `${turns} turnos aguantados`;
}

/**
 * El parte final, en el orden en que se lee: qué pasó, en qué turno, con qué te
 * quedaste, cómo jugaste y cómo volver a intentarlo.
 *
 * El estado final va como cifra y no como barra. Las barras de `ResourcePanel`
 * sirven mientras decides; en una lápida serían adorno, y además esta pantalla es
 * estrecha, así que cuatro rejillas de bloques entrarían peor que una lista. Lo
 * que sí se conserva es la lectura de cada recurso —mismo orden, mismas
 * etiquetas, mismo tono— para que el jugador no tenga que traducir entre el
 * parte y la partida que acaba de perder.
 */
export function GameOverScreen({
  model,
  shareUrl,
  onRestart,
}: GameOverScreenProps) {
  const [copied, setCopied] = useState(false);

  // Recibe el enlace ya resuelto por quien la llama. El botón solo existe cuando
  // hay enlace, así que comprobarlo aquí otra vez sería una guarda para un caso
  // que no se puede dar.
  const copyShareUrl = (url: string) => {
    // El portapapeles puede estar bloqueado (contexto no seguro, permiso
    // denegado). No es un error que merezca una pantalla: el enlace sigue escrito
    // debajo en un desplegable, así que la partida se puede compartir igual.
    if (navigator.clipboard !== undefined) {
      void navigator.clipboard.writeText(url).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    }
  };

  return (
    <main
      className="screen screen--game-over"
      aria-labelledby="game-over-title"
    >
      {/*
       * Aquí no hay rótulo sobre el título. Antes ponía «El último aliento», y
       * «Fin voluntario» si te habías rendido, y se borró porque el parte ya no
       * aportaba nada: la causa está en el mensaje de debajo y rendirse es una de
       * las cuatro, así que el dato ya está dicho y con más precisión. Encima del
       * `Game Over` solo quedaba una frase que lo decía de otra manera.
       */}
      <section className="game-over-panel">
        <h1 id="game-over-title" tabIndex={-1}>
          Game Over
        </h1>
        {/*
         * Una partida reproducida es la muerte de otra persona. Sin esta línea
         * el visitante leería un parte como si fuera suyo, y sería mentira.
         */}
        {model.replayed ? (
          <p className="game-over-replay">Partida reproducida. No la has jugado tú.</p>
        ) : null}
        <div className="game-over-panel__alert" role="alert">
          <p>{causeMessages[model.reportedCause]}</p>
        </div>
        <dl className="game-over-meta">
          <div>
            <dt>Dificultad</dt>
            <dd>{difficultyLabels[model.difficulty]}</dd>
          </div>
          <div>
            <dt>Supervivencia</dt>
            <dd>{formatTurns(model.turnsSurvived)}</dd>
            {/*
             * El récord va debajo de los turnos aguantados y no en otro bloque,
             * porque es lo que califica a esa cifra: no es un dato más de la
             * partida, es lo que esa cifra valió frente a la anterior. Se dice con
             * dos palabras y sin vocear; el CSS lo pone en dorado y pequeño, que
             * es todo lo que se le concede en una pantalla de muerte.
             */}
            {model.newRecord ? (
              <p className="game-over-record">Nuevo récord</p>
            ) : null}
          </div>
          <div>
            <dt>Semilla</dt>
            <dd>{model.seed}</dd>
          </div>
        </dl>

        <section
          aria-labelledby="game-over-final-state"
          className="game-over-block"
        >
          <h2
            className="game-over-subtitle"
            id="game-over-final-state"
          >
            Cómo terminaste
          </h2>
          <dl className="game-over-stats">
            {model.stats.map((stat) => (
              <div data-tone={stat.tone} key={stat.id}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
            <div data-tone={model.shelter.tone}>
              <dt>{model.shelter.label}</dt>
              <dd>{model.shelter.status}</dd>
            </div>
          </dl>
        </section>

        {/*
         * Solo la cuenta, y con las cinco acciones aunque no se usaran nunca. Aquí
         * se quitaron las dos cosas que también eran el turno de la acción: el
         * «desde el turno N» de cada fila, que repetía un mismo dato cinco veces, y
         * el párrafo de debajo, que lo decía una vez y en forma de juicio sobre
         * cómo se jugó. Un parte que dice cuántas veces se usó cada cosa es un
         * parte; añadirle el cuándo lo convertía en un índice que no se leía, se
         * recorría.
         */}
        <section
          aria-labelledby="game-over-usage"
          className="game-over-block"
        >
          <h2 className="game-over-subtitle" id="game-over-usage">
            Cómo jugaste
          </h2>
          <dl className="game-over-breakdown">
            {model.breakdown.map((usage) => (
              <div data-used={usage.count > 0} key={usage.id}>
                <dt>{usage.label}</dt>
                <dd>{usage.count === 1 ? '1 vez' : `${usage.count} veces`}</dd>
              </div>
            ))}
          </dl>
        </section>

        {shareUrl === null ? null : (
          <div className="game-over-share">
            <AppButton
              onClick={() => copyShareUrl(shareUrl)}
              variant="secondary"
            >
              {copied ? 'Enlace copiado' : 'Compartir mi muerte'}
            </AppButton>
            {/*
             * El enlace escrito, no solo el botón. El portapapeles puede fallar y
             * la partida debe poder compartirse igual, así que la URL está siempre
             * disponible para leerla y copiarla a mano.
             */}
            <details className="game-over-share__details">
              <summary>Ver el enlace</summary>
              <code className="game-over-share__url">{shareUrl}</code>
            </details>
          </div>
        )}

        <AppButton onClick={onRestart}>Volver a jugar</AppButton>
      </section>
    </main>
  );
}
