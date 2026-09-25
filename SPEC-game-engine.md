# Especificación: `game-engine`

## Objetivo

Portar de forma determinista y testeable las reglas del prototipo C a TypeScript, sin React ni dependencias del navegador. La fidelidad cubre el comportamiento observable de las reglas, no una reproducción bit a bit del generador `rand()` de una implementación C concreta.

## Fuentes de referencia

La fuente de reglas para esta migración es el conjunto:

- `C:\Proyectos_C\the_last_turn_v2\the_last_turn_v2.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.h`

El ejecutable existente solo puede servir como referencia visual; no es una fuente autorizada de reglas. No existe historial Git que permita demostrar que el binario y los fuentes actuales son idénticos.

## Alcance

El motor será responsable de:

- Crear el estado inicial de una partida.
- Representar dificultad, estadísticas, refugio, turno y finalización.
- Resolver las siete acciones del prototipo.
- Aplicar costes de uno o varios turnos.
- Ejecutar una tirada de evento en Agonía cuando corresponda.
- Aplicar los mensajes y penalizaciones asociados a los turnos 15 y 30.
- Determinar tanto la condición que terminó la partida como la causa que el C habría mostrado.
- Devolver resultados estructurados para la interfaz.

No será responsable de renderizar, navegar, esperar confirmaciones, guardar estado ni decidir animaciones.

## Contrato público

```ts
export type Difficulty = 'normal' | 'agony';
export type GameStatus = 'playing' | 'dead';
export type EndCondition = 'hunger' | 'energy' | 'health';
export type DeathCause = 'hunger' | 'energy' | 'health';

export type GameAction =
  | 'help'
  | 'forage'
  | 'rest'
  | 'explore'
  | 'repair'
  | 'fish'
  | 'eat';

export type RandomInt = (min: number, max: number) => number;

interface GameCoreState {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly hunger: number;
  readonly energy: number;
  readonly food: number;
  readonly health: number;
  readonly hasShelter: boolean;
}

export interface GameEnd {
  readonly condition: EndCondition;
  readonly reportedCause: DeathCause;
  readonly turnsSurvived: number;
}

export interface PlayingGameState extends GameCoreState {
  readonly status: 'playing';
}

export interface FinishedGameState extends GameCoreState {
  readonly status: 'dead';
  readonly end: GameEnd;
}

export type GameState = PlayingGameState | FinishedGameState;

export interface GameResolution {
  readonly state: GameState;
  readonly actionOutcome: ActionOutcome;
  readonly randomEvent: GameEvent | null;
  readonly milestone: Milestone | null;
}
```

La unión de `GameState` hace imposible representar una partida terminada sin `end`, o una partida activa que declare `end`. Las variantes de `ActionOutcome`, `GameEvent` y `Milestone` serán uniones discriminadas con identificadores estables. El motor no devolverá HTML, CSS ni componentes React.

### Superficie API mínima

```ts
export function createGame(difficulty: Difficulty): PlayingGameState;

export function resolveTurn(
  state: GameState,
  action: GameAction,
  randomInt: RandomInt,
): GameResolution;
```

No se exportarán mutadores independientes por estadística. Toda transición válida pasará por `resolveTurn`.

`resolveTurn` lanza un error de contrato si recibe una partida terminada o un resultado de `RandomInt` fuera del intervalo inclusivo solicitado. No sustituye silenciosamente una entrada inválida.

## Estado inicial

| Campo | Valor |
|---|---:|
| `turn` | `1` |
| `hunger` | `0` |
| `energy` | `10` |
| `food` | `0` |
| `health` | `10` |
| `hasShelter` | `false` |
| `status` | `playing` |

La dificultad solo controla los eventos aleatorios:

- `normal`: no consume tiradas de evento.
- `agony`: realiza una tirada de evento después de cada acción.

Los hitos y penalizaciones de los turnos 15 y 30 se aplican en **ambas** dificultades, igual que en el C.

## Orden de resolución

Cada acción válida sigue este orden:

1. Resolver la acción y todos sus costes.
2. Resolver una única tirada de evento si la dificultad es Agonía.
3. Mostrar el hito exacto del turno 15, si el turno es exactamente 15.
4. Aplicar una penalización si `turn > 15`.
5. Mostrar el hito exacto del turno 30, si el turno es exactamente 30.
6. Aplicar una segunda penalización si `turn > 30`.
7. Evaluar la condición de finalización.

Esta secuencia conserva el orden de `eventos()` seguido de `niveles_dificultad()` en el C. Aunque una acción deje la partida fuera de los límites, el evento y las penalizaciones de dificultad se resuelven antes de comprobar la muerte.

## Semántica de acciones

| Acción | Regla portable |
|---|---|
| Ayuda | No aplica costes de turno. En Agonía todavía puede producir un evento. Después se ejecutan los hitos/penalizaciones del turno actual. |
| Buscar comida | Un turno. 40% añade una comida; 60% no cambia la comida. |
| Descansar | Un turno. Sin refugio no recupera energía. Con refugio, 20% suma 3 de energía antes del coste y 80% suma 5; el coste final resta 1. |
| Explorar | Un turno. 20% establece refugio, 25% añade una comida y 55% no encuentra nada. |
| Reparar | Dos turnos. 10% falla; 90% establece `hasShelter = true`. |
| Pescar | Obtiene enteros de 1 a 3 hasta sacar un 1. Suma los intentos al turno, al hambre y al coste de energía, y añade 3 comidas. |
| Comer | Para todo estado alcanzable se cumple `food >= 0`: muestra que no hay comida, consume un turno y no modifica comida ni hambre. Si se construye artificialmente un estado con `food < 0`, el C aplica primero `hunger -= 4` y después el coste de un turno (`hunger += 1`), limita el resultado a 0 y tampoco modifica la comida. Esta rama es inalcanzable desde `createGame`. |

La pesca no tendrá un límite artificial en esta migración. La ausencia de límite es una deficiencia conocida que se preservará y documentará para una mejora posterior.

## Tiradas de azar

`RandomInt(min, max)` debe devolver un entero dentro de ambos extremos, inclusivos. El motor validará ese contrato en cada llamada.

El orden y número de tiradas será estable:

- Buscar comida: una tirada de 1 a 5.
- Descansar: una tirada de 1 a 10 únicamente si existe refugio.
- Explorar: una tirada de 1 a 20.
- Reparar: una tirada de 1 a 10.
- Pescar: tantas tiradas de 1 a 3 como sean necesarias para obtener un 1.
- Ayuda y Comer: ninguna tirada de acción.
- Después de la acción, Agonía consume una tirada de 1 a 100. Normal no consume ninguna.

Las pruebas usarán secuencias de valores inyectadas; nunca usarán azar real.

## Eventos de Agonía

Se genera un entero de 1 a 100 por resolución:

| Resultado | Rango | Probabilidad nominal | Efecto |
|---|---:|---:|---|
| Tormenta | 1–10 | 10% | Establece `hasShelter = false`, incluso si ya era falso. |
| Mapache | 51–59 | 9% | Establece `food = 0`. |
| Meteorito | 99 | 1% | Establece `health = 0`. |
| Sin evento | Resto | 80% | No cambia el estado. |

Los rangos son disjuntos, por lo que una resolución produce como máximo un evento. Las banderas locales del C no se modelarán porque no alteran el resultado.

## Hitos y penalizaciones

En cada resolución, y tanto en Normal como en Agonía:

- Si `turn === 15`, se emite el hito exacto del turno 15.
- Si `turn > 15`, `hunger` aumenta 1 y `energy` disminuye 1 una sola vez.
- Si `turn === 30`, se emite el hito exacto del turno 30.
- Si `turn > 30`, `hunger` aumenta 1 y `energy` disminuye 1 una sola vez más.

Las penalizaciones no se multiplican por los turnos omitidos. Por ejemplo, una acción que salte del turno 10 al 20 recibe una sola penalización por superar 15, no cinco. Si una acción salta por encima de ambos hitos, no se emite ningún mensaje de hito exacto, pero sí se aplican ambas penalizaciones una vez.

Esta lógica se conserva aunque el nombre `niveles_dificultad` sugiera lo contrario.

## Fin de partida

La condición del bucle C se conserva exactamente:

```text
 Continuar mientras hunger <= 10
 AND energy > 0
 AND health != 0
```

`end.condition` registra la primera condición violada evaluada en ese orden: hambre, energía o salud.

`end.reportedCause` reproduce la precedencia de `mensaje_muerte`:

1. Hambre cuando `hunger >= 10`.
2. Energía cuando `energy <= 0`.
3. Salud cuando `health <= 0`.

Estas dos causas pueden diferir. Por ejemplo, con hambre 10, energía 0 y salud 10, la energía termina el bucle, pero el C muestra el mensaje de hambre. La interfaz debe mostrar `reportedCause`, no una causa corregida.

Al finalizar:

- `status` pasa a `dead`.
- `end.turnsSurvived` es `turn - 1`.
- No existe condición de victoria.

## Fidelidad y desviaciones

### Comportamiento que se conserva

| ID | Comportamiento fiel |
|---|---|
| `F-01` | Comer nunca reduce hambre ni modifica comida en estados alcanzables. |
| `F-02` | La salud solo puede pasar de 10 a 0 mediante un meteorito; no hay recuperación. |
| `F-03` | No existe victoria. |
| `F-04` | El bucle permite hambre 10, pero el mensaje de muerte empieza en 10. |
| `F-05` | La terminación por energía suele quedar eclipsada por el mensaje de hambre. |
| `F-06` | La pesca puede consumir un número ilimitado de turnos y queda bloqueada si la fuente de azar nunca devuelve 1. |
| `F-07` | Los hitos usan igualdad exacta y pueden omitirse al saltar turnos. |
| `F-08` | Una acción multiturno aplica evento y penalizaciones una sola vez al finalizar. |
| `F-09` | Ayuda no consume turno, pero sí puede producir un evento en Agonía. |
| `F-10` | Energía y comida no tienen límite superior. |
| `F-11` | Los hitos y penalizaciones se aplican también en Normal. |

### Diferencias inevitables de la web

| ID | Diferencia y motivo |
|---|---|
| `W-01` | No existe acción `invalid`: los controles React solo pueden despachar valores de `GameAction`. Se elimina una entrada textual imposible, no una regla. |
| `W-02` | La dificultad se selecciona mediante una unión de dos valores. No se conservan entradas inválidas de `scanf`, incluidos valores distintos de 1. |
| `W-03` | El adaptador web genera enteros nominalmente uniformes. No se reproduce el sesgo específico de `rand() % n` de MinGW. |
| `W-04` | El motor devuelve datos y claves de mensaje; no imprime texto directamente. |

Estas entradas se copiarán a `docs/fidelity.md` durante la implementación. Cada cambio posterior deberá registrar si corrige un elemento `F-*` o si añade una diferencia `W-*`.

## Estructura prevista

```text
src/game/
  types.ts             → Contratos y uniones discriminadas
  initial-state.ts     → Estado inicial
  actions.ts           → Resolución de acciones
  events.ts            → Eventos de Agonía
  difficulty.ts        → Hitos y penalizaciones
  end-state.ts         → Finición y causas observables
  engine.ts            → createGame y resolveTurn
  index.ts             → API pública
  __tests__/           → Pruebas unitarias
```

## Estilo de código

- TypeScript estricto, sin `any` ni casts para silenciar el compilador.
- Sin imports de React, CSS o APIs del navegador.
- Estado y resultados inmutables.
- Uniones discriminadas para estados, resultados, eventos e hitos.
- Nombres de dominio en inglés; textos visibles en español únicamente en la interfaz.
- Errores de contrato lanzados inmediatamente.
- Funciones pequeñas orientadas a transiciones comprobables.

```ts
export function createGame(difficulty: Difficulty): GameState {
  return {
    difficulty,
    status: 'playing',
    turn: 1,
    hunger: 0,
    energy: 10,
    food: 0,
    health: 10,
    hasShelter: false,
  };
}
```

## Estrategia de pruebas

- 100% de statements, branches, functions y lines en `src/game/`.
- Una prueba por cada resultado y límite de acción.
- Secuencias de RNG predefinidas para cada rama y orden de llamadas.
- Pruebas de inmutabilidad del estado de entrada.
- Pruebas del orden acción → evento → hito/penalización → fin.
- Pruebas de pesca con secuencias finitas; no se simulará una secuencia infinita porque bloquearía la suite.
- Pruebas de todos los comportamientos `F-01` a `F-11`.
- Pruebas de las diferencias `W-01` a `W-04` en sus límites aplicables.
- Pruebas del contrato de `RandomInt`.

Comandos previstos:

```text
npm run test -- src/game
npm run test:coverage -- src/game
npm run typecheck
npm run lint
```

## Límites

- Siempre: una transición conservará el estado de entrada sin mutarlo.
- Siempre: las probabilidades se probarán con RNG inyectado.
- Siempre: los cambios de reglas actualizarán `docs/fidelity.md`.
- Preguntar antes: cambiar una regla, corregir un comportamiento `F-*` o añadir aleatoriedad criptográfica.
- Nunca: importar React, CSS, `window`, Web Storage o `Math.random` directamente en `src/game/`.
- Nunca: limitar estadísticas durante la migración fiel.
- Nunca: corregir silenciosamente una discrepancia entre terminación y mensaje de muerte.

## Criterios de éxito

- Toda acción del C tiene una transición equivalente y una prueba.
- Los resultados son reproducibles mediante `RandomInt`.
- Los estados activo y finalizado son internamente consistentes.
- La cobertura del motor es 100%.
- Las fidelidades y diferencias están documentadas.
- No hay lógica de reglas fuera de `src/game/`.

## Preguntas abiertas

Ninguna. La preservación de los comportamientos actuales y el alcance de la migración fueron confirmados.
