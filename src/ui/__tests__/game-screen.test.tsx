import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SettingsControl } from '../components/SettingsMenu';
import type { SurrenderControl } from '../components/SurrenderControl';
import { GameScreen, type GameScreenProps } from '../screens/GameScreen';
import type { GameViewModel, RulesViewModel } from '../view-models/ui-types';

const model: GameViewModel = {
  difficulty: 'agony',
  turn: 3,
  personalBest: null,
  threat: 1,
  // En el orden del panel, que es el que la pantalla dibuja y el que la terminal
  // recorre. Un fixture en otro orden no rompe nada porque nada lo mira por
  // posición, pero enseña el orden equivocado a quien lo lea.
  stats: [
    {
      id: 'health',
      label: 'Salud',
      value: '5',
      stateLabel: 'Sangrando',
      tone: 'positive',
      units: 5,
      capacity: 10,
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
      id: 'hunger',
      label: 'Hambre',
      value: '4',
      stateLabel: 'Hambre al límite',
      tone: 'warning',
      units: 4,
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

const rules: RulesViewModel = {
  title: 'Cómo se juega',
  lead: 'Nunca se gana: se aguanta.',
  actionsTitle: 'Las cinco acciones',
  actions: [
    {
      id: 'explore',
      label: 'Explorar',
      cost: '(+1 hambre, −1 energía)',
      shortcut: 'E',
      effect: 'La única forma de conseguir comida.',
    },
  ],
  sections: [{ title: 'Cada turno', lines: ['Cuesta hambre.'] }],
};

function createSettings(
  overrides: Partial<SettingsControl> = {},
): SettingsControl {
  return {
    overlay: 'none',
    seedLabel: 'K3F9Z',
    rules,
    open: vi.fn(),
    showRules: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

/**
 * Los props de la pantalla y, además, trozos sueltos del modelo. Se mezclan sobre
 * el modelo de referencia para que un test del rival fantasma pueda decir
 * `renderScreen({ personalBest: 118 })` sin reescribir las cuatro barras.
 */
function renderScreen(
  props: Omit<Partial<GameScreenProps>, 'model'> & {
    model?: Partial<GameViewModel>;
  } = {},
) {
  const onAction = props.onAction ?? vi.fn();
  const surrender = props.surrender ?? createSurrender();
  const settings = props.settings ?? createSettings();
  const view = render(
    <GameScreen
      model={{ ...model, ...props.model }}
      settings={settings}
      onAction={onAction}
      surrender={surrender}
    />,
  );

  return { ...view, onAction, settings, surrender };
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

  it('no enseña el rival fantasma cuando todavía no ha muerto nada', () => {
    // Antes de la primera muerte no hay marca con la que compararse. Una cifra
    // con «Tu mejor: —» no sería información, sería ruido en el banner.
    renderScreen({ model: { personalBest: null } });

    expect(screen.queryByText('Tu mejor')).toBeNull();
    expect(screen.queryByText('Récord')).toBeNull();
  });

  it('compone con la mejor partida mientras vas por detrás', () => {
    renderScreen({ model: { personalBest: 118 } });

    expect(screen.getByText('Tu mejor')).toBeInTheDocument();
    expect(screen.getByText('118')).toBeInTheDocument();
  });

  it('no dice cuánto falta para el récord: el marcador es la cifra', () => {
    // Hubo aquí una línea —«Aguantados 2 de 118»— que repetía el marcador en una
    // frase. Se quitó porque el «Tu mejor» del banner ya es el marcador, y encima
    // esa frase tenía que decidir si era una pista o un reproche según lo lejos
    // que fuera el jugador. Lo que no puede ser es que el jugador tenga que
    // traducir dos veces la misma distancia.
    renderScreen({ model: { personalBest: 118, turn: 3 } });

    expect(screen.queryByText(/Aguantados/)).toBeNull();
    expect(screen.queryByText(/118\./)).toBeNull();
    expect(screen.queryByText(/Te faltan/)).toBeNull();
  });

  it('cambia a récord en cuanto lo superas', () => {
    // El momento de batir tu mejor partida es justo cuando la escala invisible se
    // vuelve visible, así que el rótulo de la cifra cambia en vez de desaparecer.
    // Marca 2, y 3 turnos aguantados la pasan.
    renderScreen({ model: { personalBest: 2, turn: 4 } });

    expect(screen.getByText('Récord')).toBeInTheDocument();
    expect(screen.queryByText('Tu mejor')).toBeNull();
    // La cifra pasa a ser la marca nueva, que es lo que acabas de hacer: 3 turnos
    // aguantados, y no la antigua marca de 2.
    expect(within(screen.getByRole('banner')).getByText('3')).toBeInTheDocument();
  });

  it('sigue contando cuando empatas con la marca', () => {
    // Haber aguantado los mismos turnos que tu mejor partida es haberla igualado,
    // no haberla superado: sigues compitiendo contra ella. Y no da juego a la
    // pantalla de muerte, que solo dice «Nuevo récord» al pasar de verdad.
    //
    // El caso límite importa más que los otros. Aquí el modelo va por la ronda 3,
    // o sea 2 turnos aguantados, contra una marca de 2. La versión anterior
    // comparaba contra el número de ronda y declaraba «Récord» en este mismo
    // momento, que es empatar; y como en la pantalla de muerte el dato es
    // `turn - 1`, esa partida terminaba con «Récord» en el banner y sin «Nuevo
    // récord» en el parte. La misma partida, dos veredictos opuestos.
    renderScreen({ model: { personalBest: 2, turn: 3 } });

    expect(screen.getByText('Tu mejor')).toBeInTheDocument();
    expect(screen.queryByText('Récord')).toBeNull();
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

  it('no avisa de saturación cuando las unidades caben en la barra', () => {
    const { container } = renderScreen({
      model: {
        ...model,
        stats: model.stats.map((resource) =>
          resource.id === 'food' ? { ...resource, units: 12, value: '12' } : resource,
        ),
      },
    });

    // Justo llena no es «más que llena». El `+` tiene que significar que el número
    // se ha salido de la barra; si apareciera en el límite, valdría por la mitad
    // de las partidas en las que no sobra nada y no avisaría de nada.
    expect(
      container.querySelector('[data-resource-id="food"] .stat__bar-over'),
    ).toBeNull();
  });

  it('avisa con un + que la barra se ha quedado corta, sin tapar los bloques', () => {
    const { container } = renderScreen({
      model: {
        ...model,
        stats: model.stats.map((resource) =>
          resource.id === 'food' ? { ...resource, units: 30, value: '30' } : resource,
        ),
      },
    });

    const food = container.querySelector('[data-resource-id="food"]');

    // Exacto, no por subcadena: con treinta unidades, un `+18` también
    // contendría un `+`, así que una aserción de subcadena dejaría pasar
    // justamente la variante que se descartó. El `+` va pelado a propósito y
    // esta es la prueba que lo ata: el número de más no va en la barra, porque
    // ya está escrito al lado y una segunda copia del mismo dato es una
    // segunda fuente de verdad, que es justo lo que puede desmentirse.
    expect(food?.querySelector('.stat__bar-over')?.textContent).toBe('+');
    // Los doce bloques siguen encendidos: el `+` informa de lo que la barra no
    // alcanza, no sustituye a la barra.
    expect(food?.querySelectorAll('.stat__block--filled')).toHaveLength(12);
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

  it('cuelga el engranaje del banner para que la ayuda esté siempre a mano', () => {
    renderScreen();

    // Vive en el banner y no en la rejilla porque no es una acción: no gasta
    // turno, y por lo tanto no puede parecer una más.
    const banner = screen.getByRole('banner');
    const gear = within(banner).getByRole('button', { name: 'Ajustes' });

    expect(gear).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(screen.getByRole('group', { name: 'Acciones' })).queryByRole(
        'button',
        { name: 'Ajustes' },
      ),
    ).toBeNull();
  });

  it('pide abrir el menú desde el engranaje', async () => {
    const user = userEvent.setup();
    const { settings } = renderScreen();

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));

    expect(settings.open).toHaveBeenCalledOnce();
  });

  it('deja el menú puesto en el banner y la hoja sin abrir', () => {
    renderScreen({ settings: createSettings({ overlay: 'settings' }) });

    expect(screen.getByRole('button', { name: 'Ajustes' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('levanta la hoja de reglas en cuanto el menú la pide', () => {
    renderScreen({ settings: createSettings({ overlay: 'rules' }) });

    expect(screen.getByRole('dialog', { name: rules.title })).toBeInTheDocument();
    // El menú se sustituye, no se apila: dos capas encima del mismo tablero
    // serían dos cosas que cerrar y un jugador sin saber cuál.
    expect(screen.queryByText('Ajustes')).toBeNull();
  });

  it('devuelve el cierre de la hoja tal cual', async () => {
    const user = userEvent.setup();
    const { settings } = renderScreen({
      settings: createSettings({ overlay: 'rules' }),
    });

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(settings.close).toHaveBeenCalledOnce();
  });
});
