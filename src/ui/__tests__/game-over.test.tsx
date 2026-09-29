import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GameOverScreen } from '../screens/GameOverScreen';
import type {
  ActionUsageViewModel,
  GameOverViewModel,
  ResourceViewModel,
  ShelterViewModel,
} from '../view-models/ui-types';

/**
 * El modelo completo por defecto. Los tests que no miran una sección concreta no
 * tienen por qué escribirla entera, pero los que sí la tienen que poder poner a
 * su gusto, así que el relleno sale de aquí y no de cada `...model` suelto.
 */
function makeModel(
  overrides: Partial<GameOverViewModel> = {},
): GameOverViewModel {
  const stats: ResourceViewModel[] = [
    {
      id: 'health',
      label: 'Salud',
      value: '0',
      stateLabel: 'Crítico',
      tone: 'warning',
      units: 0,
      capacity: 10,
    },
    {
      id: 'hunger',
      label: 'Hambre',
      value: '7',
      stateLabel: 'Hambriento',
      tone: 'warning',
      units: 7,
      capacity: 12,
    },
    {
      id: 'energy',
      label: 'Energía',
      value: '3',
      stateLabel: 'Agotado',
      tone: 'warning',
      units: 3,
      capacity: 12,
    },
    {
      id: 'food',
      label: 'Comida',
      value: '2',
      stateLabel: 'Escaso',
      tone: 'warning',
      units: 2,
      capacity: 12,
    },
  ];

  const shelter: ShelterViewModel = {
    label: 'Refugio',
    hasShelter: true,
    status: 'Construido',
    tone: 'positive',
  };

  const breakdown: ActionUsageViewModel[] = [
    { id: 'explore', label: 'Explorar', count: 4 },
    { id: 'eat', label: 'Comer', count: 2 },
    { id: 'cure', label: 'Curarse', count: 0 },
    { id: 'rest', label: 'Descansar', count: 1 },
    { id: 'repair', label: 'Reparar', count: 0 },
  ];

  return {
    difficulty: 'agony',
    reportedCause: 'hunger',
    turnsSurvived: 7,
    newRecord: false,
    stats,
    shelter,
    breakdown,
    lastShift: { turn: 5, label: 'Comer' },
    seed: '1z141z3',
    replayed: false,
    ...overrides,
  };
}

const model = makeModel();

describe('GameOverScreen', () => {
  it('presenta la derrota con la causa comunicada y los turnos', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Game Over',
      }),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    );
    expect(screen.getByText('7 turnos aguantados')).toBeInTheDocument();
    expect(screen.getByText('Agonía')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Volver a jugar' }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      'hunger',
      'El estómago vacío marcó tu final. Cada bocado perdido se cobró su precio.',
    ],
    [
      'energy',
      'El cuerpo cedió al agotamiento. Cada paso fue el último.',
    ],
    [
      'health',
      'Estoy seguro de que eso no te lo esperabas. La vida es dura.',
    ],
    [
      'surrender',
      'Te has autoeliminado con un botón. El refugio queda intacto y tú, desinstalado.',
    ],
  ] as const)('traduce la causa comunicada %s', (reportedCause, message) => {
    render(
      <GameOverScreen
        model={makeModel({ reportedCause })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('anuncia el nuevo récord solo cuando la partida lo bate', () => {
    const { rerender } = render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(screen.queryByText('Nuevo récord')).toBeNull();

    rerender(
      <GameOverScreen
        model={makeModel({ newRecord: true })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText('Nuevo récord')).toBeInTheDocument();
  });

  it('pone el récord debajo de los turnos aguantados, no suelto', () => {
    // El récord califica a esa cifra, así que tiene que leerse como parte de ella
    // y no como un bloque suelto de la lista. En el árbol se comprueba con la
    // relación entre los dos, que es la que sobrevive al CSS.
    render(
      <GameOverScreen
        model={makeModel({ newRecord: true, turnsSurvived: 12 })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    const badge = screen.getByText('Nuevo récord');
    const turns = screen.getByText('12 turnos aguantados');

    // Comparten el mismo `<div>` del `<dl>`, o sea la misma celda, y esa celda es
    // la de supervivencia. La relación entre los dos es lo que sobrevive al CSS.
    const cell = turns.parentElement;
    expect(cell).toBe(badge.parentElement);
    expect(cell).toHaveTextContent('Supervivencia');
  });

  it('no pone rótulo sobre el título, ni para una muerte ni para una rendición', () => {
    const { rerender } = render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    // Encima del `Game Over` no hay nada. El rótulo que hubo aquí —«El último
    // aliento», o «Fin voluntario» si te habías rendido— se borró porque el parte
    // ya no decía nada que no estuviera dicho más abajo y con más precisión.
    // Rendirse sigue siendo una de las cuatro causas, así que el mensaje de
    // derrota lo reconoce igual.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('El último aliento')).toBeNull();
    expect(screen.queryByText('Fin voluntario')).toBeNull();

    rerender(
      <GameOverScreen
        model={makeModel({ reportedCause: 'surrender' })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.queryByText('El último aliento')).toBeNull();
    expect(screen.queryByText('Fin voluntario')).toBeNull();

    // Lo que no se puede perder es que la rendición se reconozca. Va en el
    // mensaje de derrota, no en un rótulo.
    expect(
      screen.getByText(/Te has autoeliminado con un botón/),
    ).toBeInTheDocument();
  });

  it('usa el singular para una partida de un turno', () => {
    render(
      <GameOverScreen
        model={makeModel({ turnsSurvived: 1 })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText('1 turno aguantado')).toBeInTheDocument();
  });

  it('no explica la muerte: la causa la dice el remate y el parte, los datos', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    // Aquí hubo una autopsia —«Moriste de hambre en el turno 7, con 2 de comida
    // guardada»— y se quitó. Encima del `Game Over` lo que funciona es el remate,
    // y los tres datos que daba la autopsia ya están en el parte: la causa en el
    // mensaje, el turno en «Supervivencia» y la comida en «Cómo terminaste».
    // Repitiéndolo era leer lo mismo dos veces con dos redacciones.
    expect(screen.queryByText(/Moriste de/)).toBeNull();
    expect(screen.queryByText(/Te rendiste/)).toBeNull();
    expect(screen.queryByText(/en el turno 7,/)).toBeNull();
  });

  it('cierra los cinco recursos del final en su propio bloque', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    const finalState = screen.getByRole('region', { name: 'Cómo terminaste' });

    expect(finalState).toHaveTextContent('Salud');
    expect(finalState).toHaveTextContent('Hambre');
    expect(finalState).toHaveTextContent('Energía');
    expect(finalState).toHaveTextContent('Comida');
    // El refugio cierra la lista: son cinco, y el quinto es el interruptor.
    expect(finalState).toHaveTextContent('Refugio');
    expect(finalState).toHaveTextContent('Construido');
  });

  it('desglosa cuántas veces se usó cada acción, y solo la cuenta', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    const usage = screen.getByRole('region', { name: 'Cómo jugaste' });

    expect(usage).toHaveTextContent('Explorar');
    expect(usage).toHaveTextContent('4 veces');
    expect(usage).toHaveTextContent('2 veces');
    expect(usage).toHaveTextContent('1 vez');
    // El «desde el turno N» de cada fila se quitó: el turno de la primera vez ya
    // lo dice el parte, una vez y mejor, con el de `lastShift`.
    expect(usage).not.toHaveTextContent('desde el turno');
  });

  it('lista también las acciones que nunca se usaron, a cero', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    const usage = screen.getByRole('region', { name: 'Cómo jugaste' });

    // Un parte que solo lista lo que se hizo esconde lo interesante: la acción
    // que tenía delante y no usó.
    expect(usage).toHaveTextContent('Curarse');
    expect(usage).toHaveTextContent('0 veces');
    expect(usage).toHaveTextContent('Reparar');
  });

  it('no inventa un último giro cuando no hubo ninguna acción', () => {
    render(
      <GameOverScreen
        model={makeModel({ lastShift: null })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Dejaste de estrenar/)).toBeNull();
  });

  it('dice cuándo dejó de estrenar acciones', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(
      screen.getByText(
        'Dejaste de estrenar acciones en el turno 5, con comer.',
      ),
    ).toBeInTheDocument();
  });

  it('avisa de que la partida es reproducida y no del visitante', () => {
    render(
      <GameOverScreen
        model={makeModel({ replayed: true })}
        shareUrl={null}
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Partida reproducida. No la has jugado tú.'),
    ).toBeInTheDocument();
  });

  it('no dice nada de reproducción en una partida propia', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(screen.queryByText(/Partida reproducida/)).toBeNull();
  });

  it('comparte la muerte con un enlace que reproduce la partida', async () => {
    const user = userEvent.setup();
    const shareUrl =
      'https://example.test/?seed=1z141z3&d=a&a=ecdsees';
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <GameOverScreen model={model} shareUrl={shareUrl} onRestart={vi.fn()} />,
    );

    expect(screen.getByText(shareUrl)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Compartir mi muerte' }),
    );

    expect(writeText).toHaveBeenCalledWith(shareUrl);
  });

  it('no ofrece compartir cuando no hay enlace que compartir', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(
      screen.queryByRole('button', { name: 'Compartir mi muerte' }),
    ).toBeNull();
  });

  it('deja el enlace a la vista aunque el portapapeles falle', async () => {
    const user = userEvent.setup();
    const shareUrl = 'https://example.test/?seed=1z141z3&d=a&a=ecdsees';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('bloqueado')) },
    });

    render(
      <GameOverScreen model={model} shareUrl={shareUrl} onRestart={vi.fn()} />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Compartir mi muerte' }),
    );

    // El portapapeles puede estar bloqueado y la partida sigue siendo
    // compartible: el enlace está escrito.
    expect(screen.getByText(shareUrl)).toBeInTheDocument();
  });

  it('no falla cuando el navegador no tiene portapapeles', async () => {
    const user = userEvent.setup();
    const shareUrl = 'https://example.test/?seed=1z141z3&d=a&a=ecdsees';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    render(
      <GameOverScreen model={model} shareUrl={shareUrl} onRestart={vi.fn()} />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Compartir mi muerte' }),
    );

    expect(screen.getByText(shareUrl)).toBeInTheDocument();
  });

  it('muestra la semilla de la partida', () => {
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={vi.fn()} />,
    );

    expect(screen.getByText('1z141z3')).toBeInTheDocument();
  });

  it('reinicia mediante un único callback', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <GameOverScreen model={model} shareUrl={null} onRestart={onRestart} />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Volver a jugar' }),
    );

    expect(onRestart).toHaveBeenCalledOnce();
  });
});
