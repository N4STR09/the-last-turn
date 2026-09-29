import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';

import type { GameAction, GameState } from '../../game';
import { EscalationOverlay } from '../../ui/components/EscalationOverlay';
import { DifficultyScreen } from '../../ui/screens/DifficultyScreen';
import { GameOverScreen } from '../../ui/screens/GameOverScreen';
import { GameScreen } from '../../ui/screens/GameScreen';
import { StartScreen } from '../../ui/screens/StartScreen';
import { replayGame } from '../replay';
import { encodeReplayQuery } from '../seed';
import {
  useGameSession,
  type GameSession,
  type GameSessionOptions,
} from '../use-game-session';

/**
 * Arnés que pinta la pantalla real y deja además la sesión a la vista. Se juega
 * pulsando botones de verdad, porque lo que se prueba aquí no es el modelo: es que
 * la semilla, el enlace y la marca se comporten a lo largo de una partida
 * completa, y eso solo se puede comprobar de extremo a extremo.
 */
function Probe({
  onSession,
  options = {},
}: {
  readonly onSession: (session: GameSession) => void;
  readonly options?: GameSessionOptions;
}) {
  const session = useGameSession(options);
  onSession(session);

  if (session.state.screen === 'start') {
    return <StartScreen onBegin={session.showDifficulty} />;
  }

  if (session.state.screen === 'difficulty') {
    return <DifficultyScreen onSelect={session.selectDifficulty} />;
  }

  if (session.state.screen === 'dead') {
    return (
      <GameOverScreen
        model={session.gameOverModel!}
        shareUrl={session.shareUrl}
        onRestart={session.restart}
      />
    );
  }

  return (
    <>
      <GameScreen
        model={session.gameModel!}
        settings={session.settings!}
        onAction={session.performAction}
        surrender={session.surrender}
      />
      {session.threatNoticeModel !== null ? (
        <EscalationOverlay
          model={session.threatNoticeModel}
          onContinue={session.dismissThreatNotice}
        />
      ) : null}
    </>
  );
}

let latest: GameSession | null = null;
const capture = (session: GameSession) => {
  latest = session;
};

/**
 * Entra en partida desde donde esté la aplicación. Hay dos caminos: desde Inicio
 * hay que pulsar «Comenzar», y desde la pantalla de muerte «Volver a jugar» ya
 * deja la elección de dificultad a la vista. El botón de la pantalla de partida
 * no se busca porque en ese momento no hay partida.
 */
async function startPlaying(user: UserEvent): Promise<void> {
  const begin = screen.queryByRole('button', { name: 'Comenzar' });

  if (begin !== null) {
    await user.click(begin);
  }

  await user.click(screen.getByRole('button', { name: 'Jugar en Agonía' }));
}

/**
 * Se rinde. Alcanza la pantalla de muerte en dos clics.
 *
 * Este archivo no juega partidas enteras a propósito. Su asunto es la semilla, el
 * enlace y la marca, y ninguno de los tres necesita cuarenta turnos: una muerte
 * por rendirse produce la misma pantalla final con una fracción del trabajo. Y el
 * trabajo importa más de lo que parece: `verify` corre los 26 archivos en
 * paralelo, y una partida entera por test convertía el archivo entero en el
 * lento de la suite y lo empujaba contra el límite de cinco segundos.
 */
async function surrenderHere(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Rendirse/ }));
  await user.click(screen.getByRole('button', { name: 'Rendirme' }));
}

/**
 * Juega un turno y se rinde.
 *
 * Un turno de verdad importa cuando lo que se comprueba son las letras del enlace:
 * sin ningún turno registrado el parámetro de acciones sale vacío, y una partida
 * sin turnos no es una partida que se pueda compartir.
 */
async function playOneTurnThenSurrender(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^Explorar/ }));
  await surrenderHere(user);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  latest = null;
});

/**
 * Busca una semilla cuya partida de solo explorar muera, y devuelve el enlace
 * exacto de esa muerte. Se busca en vez de fijarla a mano para que el test siga
 * valiendo si algún día cambia el balance: lo que se comprueba es que el enlace
 * reproduce la partida, no que una semilla concreta siga muriendo igual.
 *
 * El resultado se recuerda a nivel de módulo porque la búsqueda recorre hasta 500
 * semillas y resuelve 40 turnos en cada una. Sin memoria, cada test que pide un
 * enlace repite esa búsqueda entera, y con la cobertura puesta la suma de las
 * repeticiones basta para que el archivo expire.
 */
let cachedDeadLink: ReturnType<typeof searchDeadLink> | null = null;

function searchDeadLink() {
  const actions: GameAction[] = Array.from({ length: 40 }, () => 'explore');

  for (let seed = 1; seed < 500; seed += 1) {
    const result = replayGame(seed, 'agony', actions);

    if (result.state.status === 'dead') {
      return {
        seed,
        played: actions.slice(0, result.records.length),
        turns: result.state.end.turnsSurvived,
        // El estado muerto es la referencia contra la que se compara la
        // reproducción: si el enlace no reconstruye esta partida, no la ha
        // reconstruido.
        dead: result.state,
      };
    }
  }

  throw new Error('Ninguna semilla de la prueba murió explorando.');
}

function deadLink(): ReturnType<typeof searchDeadLink> {
  cachedDeadLink ??= searchDeadLink();
  return cachedDeadLink;
}

describe('la semilla y el enlace', () => {
  it('parte de una semilla nueva y la enseña al morir', async () => {
    const user = userEvent.setup();
    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    await startPlaying(user);
    await playOneTurnThenSurrender(user);

    // Un enlace son tres parámetros y nada más: semilla en base 36, dificultad
    // de una letra y una letra por turno.
    expect(latest?.shareUrl).toMatch(/[?&]seed=[0-9a-z]+&d=a&a=[ecsdr]+$/);
  });

  it('reproduce la partida exacta al abrir el enlace', () => {
    const link = deadLink();
    window.history.replaceState(
      null,
      '',
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    // La partida del enlace muere en su mismo turno, sin que nadie pulse nada.
    expect(latest?.state.screen).toBe('dead');
    expect(latest?.gameOverModel?.turnsSurvived).toBe(link.turns);
    expect(latest?.gameOverModel?.replayed).toBe(true);
  });

  it('reproduce con los mismos dados, no con una partida parecida', () => {
    const link = deadLink();
    window.history.replaceState(
      null,
      '',
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    const model = latest?.gameOverModel;
    const state: GameState = link.dead;

    if (state.status !== 'dead') {
      throw new Error('La partida de referencia no llegó a morir.');
    }

    // La misma causa y el mismo estado final es lo que significa «la misma
    // partida»: dos caminos con el mismo final podrían ser parte de un caso en
    // que el azar cambiara los eventos por el camino.
    expect(model?.reportedCause).toBe(state.end.reportedCause);
    expect(model?.stats.map((stat) => [stat.id, stat.value])).toEqual([
      ['health', `${state.health}`],
      ['energy', `${state.energy}`],
      ['hunger', `${state.hunger}`],
      ['food', `${state.food}`],
    ]);
    expect(model?.shelter.hasShelter).toBe(state.hasShelter);
  });

  it('no convierte la muerte de otro en tu mejor partida', async () => {
    const user = userEvent.setup();
    const link = deadLink();
    window.history.replaceState(
      null,
      '',
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);

    // El rival fantasma es una marca propia. La partida del enlace puede ser
    // mejor o peor que la tuya, pero no es tuya, así que no compite contigo.
    expect(latest?.gameModel?.personalBest).toBeNull();
    expect(screen.queryByText('Tu mejor')).toBeNull();
  });

  it('deja de marcar como reproducida en cuanto juegas tú', async () => {
    const user = userEvent.setup();
    const link = deadLink();
    window.history.replaceState(
      null,
      '',
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    expect(
      screen.getByText('Partida reproducida. No la has jugado tú.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);
    await surrenderHere(user);

    // Esta muerte sí es tuya, y se lee como tal. Si el rótulo se quedara, el
    // parte mentiría sobre quién acaba de morir.
    expect(
      screen.queryByText('Partida reproducida. No la has jugado tú.'),
    ).toBeNull();
    expect(latest?.gameOverModel?.replayed).toBe(false);
  });

  it('arranca una partida normal si el enlace está corrupto', () => {
    // Un enlace roto no puede romper la aplicación: se cae a la pantalla de
    // inicio, que es lo que un visitante espera al abrir una página cualquiera.
    window.history.replaceState(null, '', '/?seed=$$$&d=z&a=qqq');

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    expect(latest?.state.screen).toBe('start');
  });

  it('usa la semilla de la URL para la primera partida', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?seed=1z141z3');

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    await startPlaying(user);
    await surrenderHere(user);

    // La semilla de la URL es la de la partida, y viaja en el enlace de muerte.
    expect(latest?.shareUrl).toContain('seed=1z141z3');
  });
});

describe('el rival fantasma', () => {
  it('no existe hasta que muere una partida', () => {
    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    // En la pantalla de inicio no hay partida, así que no hay modelo con el que
    // comparar. El rival aparece en la banner, y la banner aún no existe.
    expect(latest?.gameModel).toBeNull();
  });

  it('apunta a la mejor partida de la sesión, no a la última', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Probe
          onSession={(session) => {
            capture(session);
          }}
        />
      </StrictMode>,
    );

    // Una partida con un turno de verdad, que deja marca.
    await startPlaying(user);
    await playOneTurnThenSurrender(user);

    const long = latest?.gameOverModel?.turnsSurvived;
    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));

    // Y después la peor partida posible: rendirse antes de gastar un turno. El
    // orden está al revés a propósito. Con dos muertes al azar, comprobar que la
    // marca es el máximo solo detectaría el error cuando la primera resultara ser
    // la mejor, es decir, la mitad de las veces. Con este orden la segunda es
    // siempre peor, así que si la marca se quedara con la última la borraría y el
    // test lo vería siempre.
    await startPlaying(user);
    await surrenderHere(user);

    const short = latest?.gameOverModel?.turnsSurvived;

    expect(short).toBe(0);
    expect(long).toBe(1);

    // La marca vive en el modelo de partida, así que hay que estar dentro de una
    // partida para verla. Es también cuando la banner puede decirla.
    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);

    expect(latest?.gameModel?.personalBest).toBe(long);
  });

  it('pone la insignia de récord solo cuando la partida pasa la anterior', async () => {
    const user = userEvent.setup();
    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    // Primera partida de la sesión: dura un turno y se rinde. Muere con 1.
    await startPlaying(user);
    await playOneTurnThenSurrender(user);
    expect(latest?.gameOverModel?.turnsSurvived).toBe(1);

    // No hay insignia. No había récord que batir, así que «nuevo récord» en la
    // primera muerte sería aplaudir una derrota.
    expect(latest?.gameOverModel?.newRecord).toBe(false);
    expect(screen.queryByText('Nuevo récord')).toBeNull();

    // Segunda partida: se rinde en el turno uno, así que muere con 0. Peor que la
    // anterior, y desde luego sin récord.
    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);
    await surrenderHere(user);
    expect(latest?.gameOverModel?.turnsSurvived).toBe(0);
    expect(latest?.gameOverModel?.newRecord).toBe(false);

    // Tercera partida: tres turnos de verdad y se rinde. Muere con 3, que pasa la
    // marca de 1. Aquí sí.
    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);
    await user.click(screen.getByRole('button', { name: /^Explorar/ }));
    await user.click(screen.getByRole('button', { name: /^Explorar/ }));
    await surrenderHere(user);

    expect(latest?.gameOverModel?.turnsSurvived).toBe(2);
    expect(latest?.gameOverModel?.newRecord).toBe(true);
    expect(screen.getByText('Nuevo récord')).toBeInTheDocument();

    // Cuarta partida: un turno. No bate la marca de 2, así que la insignia se va.
    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);
    await playOneTurnThenSurrender(user);

    expect(latest?.gameOverModel?.newRecord).toBe(false);
    expect(screen.queryByText('Nuevo récord')).toBeNull();
  });

  it('el banner y la insignia nunca se contradicen en la misma partida', async () => {
    // El bug que este test fija: el banner comparaba contra el número de ronda y
    // el parte contra los turnos aguantados, que es esa misma cifra menos uno. En la
    // partida que iguala la marca, el banner decía «Récord» y el parte no llevaba
    // «Nuevo récord». Dos veredictos opuestos sobre la misma partida, y solo
    // uno cierto.
    //
    // Aquí se recorre la frontera entera: empate, un turno por encima, y qué pasa
    // en el parte de cada caso.
    const user = userEvent.setup();
    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    // Marca previa: una partida de 1 turno aguantado.
    await startPlaying(user);
    await playOneTurnThenSurrender(user);
    expect(latest?.gameOverModel?.turnsSurvived).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Volver a jugar' }));
    await startPlaying(user);

    // Recién empezada: 0 aguantados contra una marca de 1.
    expect(screen.getByText('Tu mejor')).toBeInTheDocument();
    expect(screen.queryByText('Récord')).toBeNull();

    // Un turno jugado: 1 aguantado contra una marca de 1. Empate, no récord.
    await user.click(screen.getByRole('button', { name: /^Explorar/ }));
    expect(screen.getByText('Tu mejor')).toBeInTheDocument();
    expect(screen.queryByText('Récord')).toBeNull();

    // Segundo turno: 2 aguantados contra una marca de 1. Aquí sí, y el banner lo
    // dice mientras se juega.
    await user.click(screen.getByRole('button', { name: /^Explorar/ }));
    expect(screen.getByText('Récord')).toBeInTheDocument();

    // Y el parte está de acuerdo: mismo veredicto, misma medida.
    await surrenderHere(user);
    expect(latest?.gameOverModel?.newRecord).toBe(true);
    expect(screen.getByText('Nuevo récord')).toBeInTheDocument();
  });

  it('no pone insignia de récord a una partida reproducida', async () => {
    // Aunque la muerte del enlace dure más que tu marca, no es tuya. Sin este
    // filtro, abrir el enlace de alguien con una partida larga te regalaría un
    // récord que no has jugado.
    const link = deadLink();
    window.history.replaceState(
      null,
      '',
      `/?${encodeReplayQuery({
        seed: link.seed,
        difficulty: 'agony',
        actions: link.played,
      })}`,
    );

    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    expect(latest?.gameOverModel?.turnsSurvived).toBeGreaterThan(0);
    expect(latest?.gameOverModel?.newRecord).toBe(false);
    expect(screen.queryByText('Nuevo récord')).toBeNull();
  });
});

describe('el enlace se reconstruye al morir, no al empezar', () => {
  it('aparece con la muerte y desaparece al volver a jugar', async () => {
    const user = userEvent.setup();
    render(
      <Probe
        onSession={(session) => {
          capture(session);
        }}
      />,
    );

    await startPlaying(user);

    // En una partida viva no hay enlace: una partida a medias no se puede
    // reproducir, y un enlace que cambiara cada turno no valdría nada.
    expect(latest?.shareUrl).toBeNull();

    await surrenderHere(user);
    expect(latest?.shareUrl).not.toBeNull();
  });
});
