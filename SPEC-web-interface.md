# Especificación: `web-interface`

## Objetivo

Crear una interfaz oscura, atmosférica e interactiva para jugar *The Last Turn* en un navegador moderno. La interfaz debe hacer comprensible el estado y cada resolución sin copiar el diseño de terminal ni ocultar el comportamiento real de las reglas.

## Dirección visual

- Tema oscuro con fondos carbón, texto marfil y acentos desaturados.
- Rojo oscuro reservado para peligro, hambre, meteoritos y estado final.
- Ámbar para refugio, energía y progreso.
- Verde apagado para resultados favorables que no sean refugio.
- Tipografía sans serif del sistema; no se cargarán fuentes externas.
- Iconos de `lucide-react`, decorativos cuando el texto ya aporta el nombre y con nombre accesible si un icono es el único contenido.
- Texturas y profundidad mediante CSS: gradientes, bordes y sombras; sin imágenes externas ni peticiones de red.
- Animaciones breves y no esenciales, desactivadas con `prefers-reduced-motion`.

La estética será de supervivencia oscura, no una terminal ni un panel administrativo genérico.

## Pantallas

### 1. Inicio

Elementos:

- Título “The Last Turn”.
- Descripción breve del juego.
- Botón principal “Comenzar”.
- Nota de que la partida dura mientras la página permanezca abierta.

No habrá selector de dificultad en esta pantalla.

### 2. Dificultad

Opciones:

- **Normal:** no habilita eventos aleatorios.
- **Agonía:** habilita eventos aleatorios que pueden destruir el refugio, robar comida o matar al jugador.

La interfaz aclarará que ambas dificultades comparten el aumento de hambre, la pérdida de energía y los hitos de los turnos 15 y 30. Esta aclaración refleja el C y evita atribuir a Agonía una penalización que también existe en Normal.

Cada opción será un control grande, con teclado, foco claro y confirmación mediante botón. No se usarán inputs ocultos ni tarjetas que parezcan clicables sin serlo.

### 3. Partida

Composición de escritorio:

- Cabecera: turno actual, dificultad y acceso a ayuda.
- Panel de recursos: hambre, energía, comida y refugio.
- Panel narrativo: resultado de la última acción, evento opcional e hito opcional.
- Panel de acciones: seis acciones jugables más ayuda.

En móvil, el orden será cabecera → recursos → resolución → acciones. Cada estadística tendrá icono, etiqueta, valor y estado textual; nunca dependerá solo del color.

Las acciones, en orden de presentación, serán:

1. Buscar comida.
2. Descansar.
3. Explorar.
4. Fabricar o reparar refugio.
5. Cazar o pescar.
6. Comer.
7. Ayuda.

La salud no se mostrará como recurso, igual que en la interfaz C. El meteorito y la muerte por salud se comunicarán mediante el resultado de la acción y la pantalla final.

Atajos de teclado durante la partida: `B`, `D`, `E`, `R`, `P`, `C` y `?`. Repetirán los botones; no crearán acciones nuevas.

### 4. Fin de partida

- Título claro de derrota.
- Texto correspondiente a `end.reportedCause`, respetando la precedencia fiel del C.
- Total de turnos aguantados: `end.turnsSurvived`.
- Botón “Volver a jugar” que vuelve a la selección de dificultad y descarta la partida anterior.

No habrá pantalla de victoria en esta migración.

## Contratos de componentes

La interfaz consumirá view models, no el estado interno del motor:

```ts
export interface ResourceViewModel {
  readonly id: 'hunger' | 'energy' | 'food' | 'shelter';
  readonly label: string;
  readonly value: string;
  readonly stateLabel: string;
  readonly tone: 'neutral' | 'warning' | 'positive';
}

export interface ResolutionViewModel {
  readonly actionId: GameAction;
  readonly headline: string;
  readonly details: readonly string[];
  readonly deltas: ReadonlyArray<ResourceDeltaViewModel>;
  readonly event: EventViewModel | null;
  readonly milestone: string | null;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly resources: ReadonlyArray<ResourceViewModel>;
  readonly resolution: ResolutionViewModel | null;
}

export interface GameOverViewModel {
  readonly difficulty: Difficulty;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
}

export interface StartScreenProps {
  readonly onBegin: () => void;
}

export interface DifficultyScreenProps {
  readonly onSelect: (difficulty: Difficulty) => void;
}

export interface GameScreenProps {
  readonly model: GameViewModel;
  readonly onAction: (action: GameAction) => void;
}

export interface GameOverScreenProps {
  readonly model: GameOverViewModel;
  readonly onRestart: () => void;
}
```

La capa de aplicación construirá estos view models. Los componentes solo representarán los datos o emitirán callbacks; no calcularán resultados ni mutarán `GameState`.

## Comportamiento de una acción

1. El usuario activa un botón o atajo.
2. La aplicación resuelve la acción mediante el motor.
3. Se muestra la resolución completa en este orden: resultado de acción, evento opcional e hito opcional.
4. Se actualizan el turno y los recursos sin recargar la página.
5. Si la partida termina, la capa de aplicación sustituye la pantalla de juego por la pantalla final.
6. El panel de resolución se anuncia de forma accesible a lectores de pantalla.

La web no replicará las pausas artificiales de `getch()`. La resolución es síncrona y no depende de animaciones ni de cargas de red. Si la partida termina, la pantalla final sustituye los controles de acción.

## Comportamiento de Ayuda

Ayuda es una acción de juego, no solo un modal informativo. Seleccionarla no consume turnos, pero en Agonía el motor todavía puede devolver un evento. El panel de resolución mostrará primero la ayuda y, después, cualquier evento conectado.

## Accesibilidad

Objetivo: WCAG 2.2 AA para los flujos del MVP.

- HTML semántico con `header`, `main` y `section`; `nav` solo si existe navegación real.
- Un único `h1` visible por pantalla.
- Botones nativos con nombre accesible.
- Foco visible y nunca eliminado.
- Navegación completa por teclado.
- Contraste mínimo 4.5:1 para texto normal y 3:1 para texto grande y componentes gráficos.
- Objetivos táctiles de al menos 44 × 44 CSS pixels.
- `aria-live="polite"` y `aria-atomic="true"` para la resolución de una acción.
- La pantalla final recibirá foco al aparecer y se anunciará como error sin duplicar dos regiones `alert`; sus encabezados de pantalla usarán `tabIndex={-1}` para recibir foco programático.
- Respeto de `prefers-reduced-motion`.
- Sin información comunicada exclusivamente mediante color o iconografía.
- Las cifras largas no se recortan ni inducen desplazamiento horizontal.

## Responsive

- Anchos de referencia: 360, 768 y 1440 px.
- Sin desplazamiento horizontal entre 320 y 1440 px.
- Acciones en una columna en móvil pequeño y en cuadrícula adaptable desde tablet.
- Orden lógico de paneles al cambiar a una columna.
- Valores grandes de energía o comida que no rompan el layout.
- Controles y textos legibles sin necesidad de ampliar la página.

## Estructura prevista

```text
src/ui/
  screens/
    StartScreen.tsx
    DifficultyScreen.tsx
    GameScreen.tsx
    GameOverScreen.tsx
  components/
    ResourcePanel.tsx
    ActionGrid.tsx
    ResolutionPanel.tsx
    DifficultyCard.tsx
    AppButton.tsx
  view-models/
    ui-types.ts
  styles/
    tokens.css
    screens.css
    components.css

src/styles/
  app.css
```

`src/styles/app.css` será la entrada global. No se usarán Tailwind, Bootstrap ni una librería de componentes.

## Estrategia de pruebas

Con Vitest, jsdom y React Testing Library:

- Cada pantalla representa su estado principal.
- Los botones llaman callbacks con la acción o dificultad correcta.
- La selección de dificultad funciona con teclado y puntero.
- Los recursos tienen etiquetas textuales además de color.
- La resolución se anuncia correctamente.
- La pantalla final muestra la causa comunicada y los turnos.
- Los atajos se ignoran al repetir una tecla, usar modificadores o pulsar otro control interactivo.
- Se comprueban landmarks, nombres accesibles y el foco inicial principal.
- Pruebas de instantáneas solo para casos visuales estables; se priorizan aserciones semánticas.

Comandos previstos:

```text
npm run test -- src/ui
npm run test:coverage -- src/ui
npm run lint
npm run typecheck
```

## Límites

- Siempre: usar HTML semántico, foco visible y nombres accesibles.
- Siempre: mantener en español el texto visible; los identificadores de dominio pueden permanecer en inglés.
- Siempre: comprobar móvil, teclado y movimiento reducido en navegador real.
- Preguntar antes: añadir una librería visual, sonido, recursos externos o una pantalla no especificada.
- Nunca: importar `resolveTurn` directamente desde un componente de presentación.
- Nunca: ocultar una estadística solo con color.
- Nunca: cargar fuentes, imágenes o datos desde servicios externos.
- Nunca: ocultar o corregir un comportamiento `F-*` sin actualizar `docs/fidelity.md`.

## Criterios de éxito

- El jugador identifica en un vistazo turno, recursos, refugio y último resultado.
- Todas las acciones son accesibles con puntero y teclado.
- La interfaz es usable a 360 px y 1440 px sin desbordamiento horizontal.
- Los estados peligrosos son identificables sin depender del color.
- No hay errores de consola ni peticiones externas al cargar o jugar.
- Las pruebas semánticas cubren todos los flujos principales.

## Preguntas abiertas

Ninguna. La dirección visual, el alcance local y la migración fiel fueron confirmados.
