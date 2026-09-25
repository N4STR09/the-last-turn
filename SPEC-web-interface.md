# Especificación: `web-interface`

## Objetivo

Crear una interfaz oscura, atmosférica e interactiva para jugar *The Last Turn* en un navegador moderno. La interfaz debe hacer comprensible el estado y cada resolución sin ocultar el comportamiento real de las reglas, y sin caer en el panel de administración: negro, una luz por elemento y nada más.

## Dirección visual

- **La pantalla es oscuridad y cada elemento es una fuente de luz.** El fondo es
  negro casi puro (`#050706`) y el brillo se consigue con `text-shadow` en varias
  capas, nunca aclarando el color del texto: un texto claro sobre fondo claro
  pierde contraste, mientras que un texto brillante sobre negro lo gana.
- El brillo va siempre en `text-shadow` y no en el color, para que el relleno
  del glifo siga siendo sólido y el contraste no dependa del halo.
- Un color por recurso, medidos sobre el fondo de página: hambre `#ff5f4d`
  (6.73:1), energía `#ffd166` (14.01:1), comida `#7ee08a` (12.43:1) y refugio
  `#5ec8f5` (10.64:1). Todos AA o mejor.
- El peligro es un color solo, `--color-alarm`, deliberadamente el mismo que el
  del hambre: no hay una segunda familia roja que compita con ella.
- Tipografía del sistema: sans para el cuerpo, serif para los titulares y
  monoespaciada del sistema para la terminal. No se cargarán fuentes externas.
- Iconos de `lucide-react`, decorativos cuando el texto ya aporta el nombre y
  con nombre accesible si un icono es el único contenido.
- Texturas y profundidad mediante CSS: gradientes, bordes y sombras; sin imágenes
  externas ni peticiones de red.
- Animaciones breves y no esenciales, desactivadas con `prefers-reduced-motion`.

La estética es de supervivencia oscura con un único elemento deliberadamente
terminal, el registro del turno. Ese elemento es la excepción que da el tono, y
no se extiende a la aplicación: el resto son superficies planas sobre negro, sin
marcos ni paneles que parezcan una aplicación de oficina.

### Registro del turno

Recuadro oscuro con monoespaciada, y detrás una calavera en SVG en línea
decorativa: gris apagado, perceptible sin leerse como amenaza. En Agonía la
calavera lleva cuernos y los ojos cambian a rojo con aura. La calavera es la
única representación de la dificultad dentro de la partida, así que la interfaz
no repite la dificultad en el banner.

El registro muestra solo la última resolución, no un historial: acumular turnos
empujaría los botones fuera de la pantalla. El aviso de escalada conserva su
propio lenguaje, que es el que fija el tono: negro puro, mensaje en rojo sangre
y pista en gris apagado.

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
- **Agonía:** habilita eventos aleatorios que pueden destruir el refugio, robar comida o quitarte salud.

La interfaz aclarará que ambas dificultades comparten el aumento del hambre, la pérdida de energía y la escalada progresiva del nivel. Esta aclaración mantiene la presión compartida sin atribuirle a Agonía una regla que también existe en Normal. La Fase 2 sustituyó los antiguos hitos de los turnos 15 y 30 por escalada continua, y el copy de esta pantalla ya no debe mencionarlos.

Cada opción será un control grande, con teclado, foco claro y confirmación mediante botón. No se usarán inputs ocultos ni tarjetas que parezcan clicables sin serlo. La tarjeta de Agonía lleva la calavera con cuernos, en pequeño, para que el jugador vea la diferencia antes de empezar y no se la encuentre de golpe dentro del juego.

### 3. Partida

Una sola columna estrecha, de 52 rem como máximo. El vacío a los lados es lo que hace que lo que brille destaque; a dos columnas el ojo saltaría entre paneles y se perdería el efecto.

El orden es el de lectura y no cambia con el tamaño:

1. **Banner.** Nombre del juego en blanco, en serif con mucho `letter-spacing`, discreto. Debajo, la ronda y el nivel de escalada en blanco puro y con halo, que es lo más brillante de la pantalla mientras haya partida.
2. **Recursos.** Una fila por recurso, en el orden hambre, energía, comida y refugio. Cada fila lleva etiqueta con icono, cifra y barra de bloques.
3. **Registro del turno.** La terminal descrita en la dirección visual.
4. **Acciones.** Siete botones: icono, título y gasto.

El nivel que se muestra es el de escalada, no el modo de dificultad. La dificultad la dice la calavera.

Las acciones, en orden de presentación, serán:

1. Buscar comida.
2. Descansar.
3. Explorar.
4. Reparar refugio.
5. Cazar o pescar.
6. Comer.
7. Ayuda.

Atajos de teclado durante la partida: `B`, `D`, `E`, `R`, `P`, `C` y `?`. Repetirán los botones; no crearán acciones nuevas.

#### Barras de recursos

Un bloque por unidad, hasta un máximo de doce. Por encima de la capacidad la barra satura y la cifra sigue siendo la verdad: la barra es una pista visual, no el dato. El refugio es binario y se dibuja con un solo bloque.

Los bloques van ocultos a lectores de pantalla porque la cifra y la etiqueta ya están en texto a su lado.

#### Gasto por acción

Cada botón imprime su gasto en hambre y energía, calculado contra la escalada vigente, no un número fijo.

- Hambre y energía se gastan por turno, no por acción: el gasto es el número de turnos por el gasto unitario.
- La ayuda no gasta nada: `(sin coste)`.
- Las acciones de un turno imprimen su cifra exacta, que cambia con la escalada.
- Reparar imprime su coste exacto, y sube con el nivel porque cada turno cuesta más.
- Pescar imprime su **peor caso**, porque su coste es azar: un rango fijo mentiría en la mitad de las partidas.

La razón está en `src/game/action-cost.ts`. La regla vive en el motor y no en la vista, porque es conocimiento de reglas y la interfaz no puede inventárselo.

#### Aviso de estado

Un recurso en estado de aviso late en rojo: la fila entera pulsa entre el 50 % y el 100 % de opacidad, en 1,8 s por ciclo, que son 0,55 Hz y muy por debajo del umbral de 3 destellos de WCAG 2.3.1. Con `prefers-reduced-motion` la fila se queda en rojo fijo, que ya comunica lo mismo sin parpadear.

El aviso crítico no es lo mismo que `tone === 'warning'`: estar sin refugio es una advertencia, no una muerte, y una fila que latiera desde el primer turno sería ruido. Los tres recursos numéricos tienen punto crítico; el refugio no.

El estado en texto aparece **solo cuando hay algo que avisar**. En el resto de la partida la fila es etiqueta, cifra y barra. Así el aviso no depende del color ni del parpadeo, porque está escrito, y así la pantalla no arrastra cuatro líneas de texto que no aportan nada.

La salud no se mostrará como recurso, igual que en la interfaz C. El meteorito y la muerte por salud se comunicarán mediante el resultado de la acción y la pantalla final.

### 4. Fin de partida

- Título claro de derrota.
- Texto correspondiente a `end.reportedCause`, respetando la precedencia fiel del C.
- Total de turnos aguantados: `end.turnsSurvived`.
- Botón “Volver a jugar” que vuelve a la selección de dificultad y descarta la partida anterior.

No habrá pantalla de victoria en esta migración.

## Contratos de componentes

La interfaz consumirá view models, no el estado interno del motor:

```ts
export type ResourceId = 'hunger' | 'energy' | 'food' | 'shelter';
export type Tone = 'neutral' | 'warning' | 'positive';

export interface ResourceViewModel {
  readonly id: ResourceId;
  readonly label: string;
  readonly value: string;
  readonly stateLabel: string;
  readonly tone: Tone;
  /** Unidades actuales. La barra dibuja un bloque por unidad. */
  readonly units: number;
  /** Bloques que caben en la barra. */
  readonly capacity: number;
  /** Punto sin retorno. Distinto de `tone === 'warning'` a propósito. */
  readonly critical: boolean;
}

export interface ResolutionViewModel {
  readonly actionId: GameAction;
  readonly headline: string;
  readonly details: readonly string[];
  readonly deltas: ReadonlyArray<ResourceDeltaViewModel>;
  readonly events: readonly EventViewModel[];
}

export interface ActionViewModel {
  readonly id: GameAction;
  readonly label: string;
  /** Gasto en hambre y energía contra la escalada vigente. */
  readonly cost: string;
}

export interface GameViewModel {
  readonly difficulty: Difficulty;
  readonly turn: number;
  /** Nivel de escalada vigente. */
  readonly threat: number;
  readonly resources: ReadonlyArray<ResourceViewModel>;
  readonly resolution: ResolutionViewModel | null;
  readonly actions: ReadonlyArray<ActionViewModel>;
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

export interface SkullProps {
  readonly difficulty: Difficulty;
}
```

`ResolutionViewModel.events` es una lista, no un evento único, porque la escalada añade tiradas extra y el mismo evento puede salir repetido en un turno. La Fase 2 eliminó `milestone`: la escalada progresiva absorbe lo que los hitos hacían.

La capa de aplicación construirá estos view models. Los componentes solo representarán los datos o emitirán callbacks; no calcularán resultados ni mutarán `GameState`.

## Comportamiento de una acción

1. El usuario activa un botón o atajo.
2. La aplicación resuelve la acción mediante el motor.
3. Se muestra la resolución completa en este orden: resultado de acción, detalles, cambios de recurso y eventos opcionales.
4. Se actualizan el turno, el nivel de escalada y los recursos sin recargar la página.
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
- Los bordes que identifican controles interactivos deben alcanzar 3:1; los separadores puramente decorativos pueden ser sutiles cuando el texto y la estructura ya identifican el contenido.
- Objetivos táctiles de al menos 44 × 44 CSS pixels.
- `aria-live="polite"` y `aria-atomic="true"` para la resolución de una acción.
- El estado de cada recurso se escribe en texto cuando hay algo que avisar. El color y el parpadeo son refuerzo, nunca el canal único.
- Las barras de recursos van `aria-hidden`: son redundancia visual sobre una cifra y una etiqueta que ya están en texto.
- Ninguna etiqueta visible se genera con `content: attr()`. El texto de CSS no entra en el árbol de accesibilidad, y el lector anunciaría las cifras sin decir qué es cada una.
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
    EscalationOverlay.tsx
    Skull.tsx
  view-models/
    ui-types.ts
  styles/
    tokens.css
    screens.css
    components.css

src/styles/
  app.css
```

`Skull.tsx` no se posiciona a sí mismo: solo lleva el color y los trazos, y quien la coloca es el contenedor. Así la misma calavera sirve de fondo en la terminal y de marca en la tarjeta de Agonía sin reglas de posición duplicadas.

`src/styles/app.css` será la entrada global. No se usarán Tailwind, Bootstrap ni una librería de componentes.

## Estrategia de pruebas

Con Vitest, jsdom y React Testing Library:

- Cada pantalla representa su estado principal.
- Los botones llaman callbacks con la acción o dificultad correcta.
- La selección de dificultad funciona con teclado y puntero.
- Los recursos tienen etiquetas textuales además de color, y encienden un bloque por unidad.
- El aviso de estado aparece en texto solo cuando el recurso está en peligro.
- El gasto impreso en cada botón se compara con el cálculo del motor para los siete niveles de amenaza.
- La calavera lleva cuernos solo en Agonía, tanto en la terminal como en la tarjeta de dificultad.
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

- El jugador identifica en un vistazo ronda, nivel, recursos y último resultado.
- Todas las acciones son accesibles con puntero y teclado.
- La interfaz es usable a 360 px y 1440 px sin desbordamiento horizontal.
- Los estados peligrosos son identificables sin depender del color.
- El gasto de cada botón es el real: el que cobra el motor con la escalada vigente.
- No hay errores de consola ni peticiones externas al cargar o jugar.
- Las pruebas semánticas cubren todos los flujos principales.

## Preguntas abiertas

Ninguna. La dirección visual, el alcance de web estática sin instalación y la migración fiel fueron confirmados.
