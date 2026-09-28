import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SurrenderControl } from '../components/SurrenderControl';
import { GameScreen, type GameScreenProps } from '../screens/GameScreen';
import type { GameViewModel } from '../view-models/ui-types';

const model: GameViewModel = {
  difficulty: 'agony',
  turn: 3,
  threat: 1,
  stats: [
    {
      id: 'hunger',
      label: 'Hambre',
      value: '4',
      stateLabel: 'Hambre al límite',
      tone: 'warning',
      units: 4,
      capacity: 12,
    },
    {
      id: 'energy',
      label: 'Energía',
      value: '8',
      stateLabel: 'Energía disponible',
      tone: 'positive',
      units: 8,
      capacity: 12,
    },
    {
      id: 'food',
      label: 'Comida',
      value: '2',
      stateLabel: 'Provisiones disponibles',
      tone: 'positive',
      units: 2,
      capacity: 12,
    },
    {
      id: 'health',
      label: 'Salud',
      value: '5',
      stateLabel: 'Sangrando',
      tone: 'positive',
      units: 5,
      capacity: 10,
    },
  ],
  shelter: {
    label: 'Refugio',
    hasShelter: false,
    status: 'Destruido',
    tone: 'warning',
  },
  forecast: {
    headline: 'El aire pesa.',
    detail: 'Algo baja desde el norte. El refugio no lo va a resistir.',
    count: 1,
  },
  resolution: {
    actionId: 'repair',
    headline: 'No consigues reparar el refugio.',
    details: ['El refugio conserva su estado anterior.'],
    deltas: [
      {
        id: 'energy',
        label: 'Energía',
        value: '−2',
        tone: 'warning',
      },
    ],
    events: [
      {
        type: 'storm',
        headline: 'Tormenta',
        description: 'Tu refugio ha resultado dañado por las fuertes tormentas!',
      },
    ],
  },
  actions: [
    { id: 'explore', label: 'Explorar', cost: '(+1 hambre, −1 energía)' },
    { id: 'eat', label: 'Comer', cost: '(+1 hambre, −1 energía)' },
    { id: 'cure', label: 'Curarse', cost: '(+1 hambre, −1 energía)' },
    { id: 'rest', label: 'Descansar', cost: '(+1 hambre, −1 energía)' },
    { id: 'repair', label: 'Reparar refugio', cost: '(+2 hambre, −2 energía)' },
  ],
};

function createSurrender(
  overrides: Partial<SurrenderControl> = {},
): SurrenderControl {
  return {
    pending: false,
    ask: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    ...overrides,
  };
}

function renderScreen(props: Partial<GameScreenProps> = {}) {
  const onAction = props.onAction ?? vi.fn();
  const surrender = props.surrender ?? createSurrender();
  const view = render(
    <GameScreen
      model={props.model ?? model}
      onAction={onAction}
      surrender={surrender}
    />,
  );

  return { ...view, onAction, surrender };
}

describe('GameScreen', () => {
  it('abre con el nombre del juego y el foco listo para recibirlo', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('sitúa la ronda y el nivel de escalada como lo más brillante del banner', () => {
    renderScreen();

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('3')).toBeInTheDocument();
    expect(within(banner).getByText('1')).toBeInTheDocument();
    expect(within(banner).getByText('Ronda')).toBeInTheDocument();
    expect(within(banner).getByText('Nivel')).toBeInTheDocument();
  });

  it('muestra las cuatro cifras y el refugio, con la salud entre ellas', () => {
    renderScreen();

    for (const label of ['Hambre', 'Energía', 'Comida', 'Salud', 'Refugio']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    // La salud se ve porque se administra: explorar la gasta, curar la
    // devuelve, y un dato que no sale por ningún sitio no se puede decidir.
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('anuncia arriba lo que ya está tirado para el turno siguiente', () => {
    const { container } = renderScreen();

    const forecast = screen.getByText('El aire pesa.');
    expect(
      screen.getByText('Algo baja desde el norte. El refugio no lo va a resistir.'),
    ).toBeInTheDocument();

    // El aviso va por encima de la pantalla, no dentro: es una advertencia de
    // futuro y el registro es el parte de lo que ya pasó. Mezclados, el aviso
    // parecía un resultado más, que es justo lo contrario de lo que significa.
    const screen_ = container.querySelector('.terminal__screen');
    expect(screen_).not.toBeNull();
    expect(
      forecast.compareDocumentPosition(screen_ as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Y es su propia región viva, para que no vuelva a leer el parte entero.
    expect(forecast.closest('[role="status"]')).toBe(forecast.parentElement);
  });

  it('no inventa un aviso cuando no hay nada en cola', () => {
    renderScreen({ model: { ...model, forecast: null } });

    expect(screen.queryByText('El aire pesa.')).toBeNull();
  });

  it('cuenta los avisos cuando el turno trae más de una tirada', () => {
    renderScreen({
      model: {
        ...model,
        forecast: { ...model.forecast!, count: 3 },
      },
    });

    // Con carga 4 en adelante el turno tira dos o tres veces, así que la cola
    // puede traer el mismo evento repetido. Un "1" fijo mentiría en dos de cada
    // tres turnos de Agonía.
    expect(screen.getByText('Vienen 3 cosas.')).toBeInTheDocument();
  });

  it('no cuenta cuando solo viene una cosa', () => {
    renderScreen();

    expect(screen.queryByText(/^Vienen/)).toBeNull();
  });

  it('deja el refugio fuera de la lista de cifras', () => {
    renderScreen();

    const stats = screen.getByRole('list', { name: 'Lo que te mantiene en pie' });
    const rows = within(stats).getAllByRole('listitem');

    // Cuatro filas, y el refugio no es una quinta: el interruptor va debajo,
    // con su propio formato, porque no es una cifra.
    expect(rows).toHaveLength(4);
    expect(within(stats).queryByText('Refugio')).toBeNull();
  });

  it('da a la salud la barra del cuerpo, no la compartida con las cifras', () => {
    const { container } = renderScreen();

    // Diez bloques, no doce: la salud se mide contra MAX_HEALTH y las otras tres
    // contra una escala común de doce. Si se mezclaran, una salud a 6 se leería
    // como media barra y a 10 como casi llena, y las dos cosas son la misma
    // foto de un cuerpo a la mitad.
    const health = container.querySelector('[data-resource-id="health"] .stat__bar');
    expect(health?.querySelectorAll('.stat__block')).toHaveLength(10);
    expect(health?.querySelectorAll('.stat__block--filled')).toHaveLength(5);
  });

  it('ordena la fila del refugio como las cifras, para que quede cuadrada', () => {
    const { container } = renderScreen();

    const shelter = container.querySelector('.shelter');
    expect(shelter).not.toBeNull();

    // El cuadre con las barras no se mide a ojo: `.shelter` reparte a sus hijos
    // en las mismas cuatro columnas que `.stat`, y el reparto es por orden del
    // DOM. Por eso la etiqueta lleva dentro su icono —como hace `.stat__label`
    // con el suyo— y por eso el orden de los tres hijos es exactamente este.
    // Añadir un cuarto hijo o mover el bloque descuadraría la fila entera sin
    // que ninguna prueba fallara, así que aquí se deja escrito.
    expect(
      [...(shelter?.children ?? [])].map((child) => child.className),
    ).toStrictEqual(['shelter__label', 'shelter__status', 'shelter__block']);
    expect(
      shelter?.querySelector('.shelter__label > .shelter__icon'),
    ).not.toBeNull();
  });

  it('dice el estado del refugio con una palabra entera', () => {
    renderScreen();

    expect(screen.getByText('Destruido')).toBeInTheDocument();
    expect(screen.queryByText('Ausente')).toBeNull();
    expect(screen.queryByText('Expuesto')).toBeNull();
  });

  it('dice que el refugio está construido cuando lo está', () => {
    renderScreen({
      model: {
        ...model,
        shelter: {
          label: 'Refugio',
          hasShelter: true,
          status: 'Construido',
          tone: 'positive',
        },
      },
    });

    expect(screen.getByText('Construido')).toBeInTheDocument();
  });

  it('enciende el bloque del refugio solo cuando hay techo', () => {
    const { container, unmount } = renderScreen();

    const destroyed = container.querySelector('.shelter__block');
    expect(destroyed?.querySelectorAll('.stat__block')).toHaveLength(1);
    expect(destroyed?.querySelectorAll('.stat__block--filled')).toHaveLength(0);
    unmount();

    const { container: built } = renderScreen({
      model: {
        ...model,
        shelter: {
          label: 'Refugio',
          hasShelter: true,
          status: 'Construido',
          tone: 'positive',
        },
      },
    });

    expect(
      built
        .querySelector('.shelter__block')
        ?.querySelectorAll('.stat__block--filled'),
    ).toHaveLength(1);
  });

  it('dibuja un bloque encendido por unidad y apaga el resto', () => {
    const { container } = renderScreen();

    const energy = container.querySelector(
      '[data-resource-id="energy"] .stat__bar',
    );
    const blocks = energy?.querySelectorAll('.stat__block--filled') ?? [];

    expect(energy?.querySelectorAll('.stat__block')).toHaveLength(12);
    expect(blocks).toHaveLength(8);
  });

  it('apaga la barra entera cuando la comida está a cero', () => {
    const { container } = renderScreen();

    const food = container.querySelector(
      '[data-resource-id="food"] .stat__bar',
    );

    expect(food?.querySelectorAll('.stat__block--filled')).toHaveLength(2);
  });

  it('escribe el aviso en texto solo cuando hay algo que avisar', () => {
    renderScreen();

    expect(screen.getByText('Hambre al límite')).toBeInTheDocument();
    // 'Energía disponible', 'Provisiones disponibles' y 'Sangrando' no se
    // escriben: la fila se limita a etiqueta, cifra y barra cuando no hay
    // peligro. Que la salud esté a 5 y aun así no grite es lo que hace que
    // avise de verdad cuando cae a 3.
    expect(screen.queryByText('Energía disponible')).toBeNull();
    expect(screen.queryByText('Provisiones disponibles')).toBeNull();
    expect(screen.queryByText('Sangrando')).toBeNull();
  });

  it('grita por la salud cuando queda a un paso, sin depender del color', () => {
    renderScreen({
      model: {
        ...model,
        stats: model.stats.map((resource) =>
          resource.id === 'health'
            ? {
                ...resource,
                value: '2',
                units: 2,
                tone: 'warning' as const,
                stateLabel: 'A un paso de la muerte',
              }
            : resource,
        ),
      },
    });

    expect(document.querySelector('[data-resource-id="health"]')).toHaveClass(
      'stat--critical',
    );
    expect(screen.getByText('A un paso de la muerte')).toBeInTheDocument();
  });

  it('marca la fila que avisa para que el aviso no dependa del color', () => {
    renderScreen({
      model: {
        ...model,
        stats: model.stats.map((resource) =>
          resource.id === 'energy'
            ? {
                ...resource,
                value: '2',
                units: 2,
                tone: 'warning' as const,
                stateLabel: 'Reserva crítica',
              }
            : resource,
        ),
      },
    });

    const energy = document.querySelector('[data-resource-id="energy"]');
    expect(energy).toHaveClass('stat--critical');
    expect(screen.getByText('Reserva crítica')).toBeInTheDocument();
  });

  it('no marca las filas que no avisan', () => {
    const { container } = renderScreen();

    expect(
      container.querySelector('[data-resource-id="food"]'),
    ).not.toHaveClass('stat--critical');
  });

  it('anuncia la resolución en orden: acción, detalles y evento', () => {
    renderScreen();

    // La región del parte se busca por su clase, no por `role="status"`: con el
    // aviso previo hay dos regiones vivas y el papel solo ya no dice cuál es cuál.
    const resolution = document.querySelector('.terminal__screen') as HTMLElement;

    expect(resolution).toHaveAttribute('aria-live', 'polite');
    expect(resolution).toHaveAttribute('aria-atomic', 'true');
    const text = resolution.textContent ?? '';
    expect(text.indexOf('No consigues')).toBeLessThan(
      text.indexOf('El refugio conserva'),
    );
    expect(text.indexOf('El refugio conserva')).toBeLessThan(
      text.indexOf('Tormenta'),
    );
    expect(within(resolution).getByText(/Energía −2/)).toBeInTheDocument();
  });

  it('abre la terminal esperando órdenes antes del primer turno', () => {
    renderScreen({ model: { ...model, resolution: null } });

    expect(screen.getByText('Sin órdenes todavía.')).toBeInTheDocument();
  });

  it('omite listas y avisos cuando la resolución no tiene detalles opcionales', () => {
    renderScreen({
      model: {
        ...model,
        resolution: {
          actionId: 'eat',
          headline: 'No tienes nada que comer.',
          details: [],
          deltas: [],
          events: [],
        },
      },
    });

    const resolution = document.querySelector('.terminal__screen') as HTMLElement;
    expect(resolution).toHaveTextContent('No tienes nada que comer.');
    expect(
      within(resolution).queryByRole('list', { name: 'Cambios de recursos' }),
    ).toBeNull();
  });

  it('pone la calavera de Agonía con cuernos y ojos rojos en la terminal', () => {
    const { container } = renderScreen();

    const skull = container.querySelector('.terminal .skull');
    expect(skull).toHaveAttribute('data-difficulty', 'agony');
    expect(skull?.querySelector('.skull__horns')).not.toBeNull();
  });

  it('quita los cuernos en Normal', () => {
    const { container } = renderScreen({
      model: { ...model, difficulty: 'normal' },
    });

    const skull = container.querySelector('.terminal .skull');
    expect(skull).toHaveAttribute('data-difficulty', 'normal');
    expect(skull?.querySelector('.skull__horns')).toBeNull();
  });

  it('emite las cinco acciones con su gasto y sus identificadores', async () => {
    const user = userEvent.setup();
    const { onAction } = renderScreen();

    const expected = [
      ['Explorar', 'explore'],
      ['Comer', 'eat'],
      ['Curarse', 'cure'],
      ['Descansar', 'rest'],
      ['Reparar refugio', 'repair'],
    ] as const;

    for (const [label] of expected) {
      await user.click(screen.getByRole('button', { name: new RegExp(label) }));
    }

    expect(onAction).toHaveBeenCalledTimes(expected.length);
    expected.forEach(([, action], index) => {
      expect(onAction).toHaveBeenNthCalledWith(index + 1, action);
    });
  });

  it('imprime el gasto real de cada acción junto a su nombre', () => {
    renderScreen();

    const actions = screen.getByRole('group', { name: 'Acciones' });
    // El único gasto distinto es el de reparar, que dura dos turnos. Ninguna
    // acción dice «hasta»: ya no hay ninguna cuyo precio dependa de una tirada,
    // así que el número del botón es el número que se paga.
    expect(
      within(actions).getByText('(+2 hambre, −2 energía)'),
    ).toBeInTheDocument();
    // Cuatro de las cinco comparten gasto porque cuatro duran un turno; el texto
    // se repite y por eso se cuenta en vez de buscarse.
    expect(within(actions).getAllByText('(+1 hambre, −1 energía)')).toHaveLength(4);
    expect(within(actions).queryByText(/hasta/)).toBeNull();
  });

  it('cierra la rejilla con rendirse, que no es una acción más', async () => {
    const user = userEvent.setup();
    const { onAction, surrender } = renderScreen();

    const surrenderButton = screen.getByRole('button', { name: /Rendirse/ });

    // Comparte grupo y rejilla con las acciones, pero no emite una acción al
    // motor: pide confirmación.
    expect(
      within(screen.getByRole('group', { name: 'Acciones' })).getByRole(
        'button',
        { name: /Rendirse/ },
      ),
    ).toBe(surrenderButton);
    expect(surrenderButton).toHaveClass('action-button--surrender');
    expect(within(surrenderButton).getByText('(te lleva la partida)')).toBeInTheDocument();

    await user.click(surrenderButton);

    expect(surrender.ask).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });
});
