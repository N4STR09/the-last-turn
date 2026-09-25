# Especificación vigente: `game-engine`

## Estado

Esta es la especificación del motor después de la **Fase 1 de supervivencia
infinita**. El juego sigue siendo una SPA estática, sin victoria y sin
persistencia, pero una estrategia viable puede superar los turnos 15, 30 y
100. Las decisiones de fidelidad y las desviaciones respecto del C están
registradas en [`docs/fidelity.md`](docs/fidelity.md).

## Objetivo

Portar de forma determinista y testeable las reglas de *The Last Turn* a
TypeScript, sin React, CSS, DOM ni APIs del navegador. El motor resuelve una
transión completa y devuelve datos estructurados; no imprime texto ni decide
animaciones.

Las reglas del C que se conservan intencionalmente incluyen la salud oculta,
la ausencia de victoria, la precedencia entre `end.condition` y
`end.reportedCause`, el hecho de que Ayuda no consume turno y la fuente de
azar inyectable con extremos inclusivos. Los cambios de la Fase 1 están
relacionados abajo y no son correcciones silenciosas.

## Fuentes de referencia

Las fuentes autorizadas para la línea base son:

- `C:\Proyectos_C\the_last_turn_v2\the_last_turn_v2.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.h`

El ejecutable existente solo puede servir como referencia visual; no prueba
identidad binaria con esos fuentes.

## Alcance

El motor es responsable de:

- Crear el estado inicial de una partida.
- Representar dificultad, estadísticas, refugio, turno y finalización.
- Resolver las siete acciones.
- Aplicar costes de uno o varios turnos.
- Ejecutar una tirada de evento en Agonía cuando corresponda.
- Aplicar los hitos de los turnos 15 y 30 como presión de una sola vez.
- Determinar la condición de fin y la causa comunicada.
- Devolver resultados estructurados para la interfaz.

No es responsable de renderizar, navegar, esperar confirmaciones, guardar
estado, hacer sonar efectos ni decidir animaciones.

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

export interface GameCoreState {
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

export type ActionOutcome =
  | { readonly type: 'help' }
  | { readonly type: 'forage-found' }
  | { readonly type: 'forage-empty' }
  | { readonly type: 'rest-without-shelter' }
  | { readonly type: 'rest-shelter-miss' }
  | {
      readonly type: 'rest-shelter-success';
      readonly energyRecovered: 3 | 5;
    }
  | { readonly type: 'explore-shelter' }
  | { readonly type: 'explore-food' }
  | { readonly type: 'explore-empty' }
  | { readonly type: 'repair-failed' }
  | { readonly type: 'repair-succeeded' }
  | { readonly type: 'fish-catch'; readonly attempts: number }
  | { readonly type: 'fish-failed'; readonly attempts: number }
  | {
      readonly type: 'eat-consumed';
      readonly foodConsumed: 1;
      readonly hungerReduced: number;
      readonly healthRecovered: 0 | 1;
    }
  | { readonly type: 'eat-no-food' };

export interface GameResolution {
  readonly state: GameState;
  readonly actionOutcome: ActionOutcome;
  readonly randomEvent: GameEvent | null;
  readonly milestone: Milestone | null;
}
```

Las uniones discriminadas impiden representar una partida terminada sin `end`
o una partida activa que declare `end`. `RandomInt` siempre recibe extremos
inclusivos y el motor valida que el valor devuelto sea entero y esté dentro del
intervalo.

### Superficie API mínima

```ts
export function createGame(difficulty: Difficulty): PlayingGameState;

export function resolveTurn(
  state: GameState,
  action: GameAction,
  randomInt: RandomInt,
): GameResolution;
```

`resolveTurn` lanza un error si recibe una partida terminada o un resultado de
azar fuera de contrato. No expone mutadores independientes por estadística.

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

Normal no consume tiradas de evento. Agonía consume una tirada de evento después
de cada acción, incluso después de Ayuda.

## Orden de resolución

Cada acción válida sigue este orden:

1. Resolver la acción y todos sus costes.
2. Resolver una única tirada de evento si la dificultad es Agonía.
3. Determinar el hito alcanzado o cruzado en los umbrales 15 y 30.
4. Aplicar como máximo una penalización por cada umbral cruzado.
5. Evaluar la condición de finalización.

El motor conserva la precedencia del C entre acción, evento, dificultad y
fin. Para una acción multiturno se entrega a la dificultad el turno anterior,
de modo que cruzar 15 o 30 no omite el hito ni lo multiplica.

## Semántica de acciones

| Acción | Regla vigente |
|---|---|
| Ayuda | No consume turnos. En Agonía todavía puede producir un evento. |
| Buscar comida | Un turno. 60% añade una comida; 40% no cambia la comida. |
| Descansar | Un turno. Sin refugio no recupera energía. Con refugio, 20% suma 3 de energía antes del coste y 80% suma 5; el coste final resta 1. |
| Explorar | Un turno. 20% establece refugio, 25% añade una comida y 55% no encuentra nada. |
| Reparar | Dos turnos. 10% falla; 90% establece `hasShelter = true`. |
| Pescar | Tira 1..3 hasta un máximo de seis intentos. Un 1 termina con `fish-catch`, suma los intentos a turno/hambre/energía y añade 3 comidas. Seis fallos terminan con `fish-failed` y no añaden comida. |
| Comer | Con comida, consume 1, reduce el hambre en 4 antes del coste normal, limita el resultado a 0 y recupera 1 de salud hasta 10. Sin comida, no consume comida y cobra un turno normal. |

La ruta `repair → forage → eat → rest` con resultados de azar favorables es una
estrategia renovable probada hasta más de 100 turnos. No existe una condición
de victoria.

## Tiradas de azar

`RandomInt(min, max)` devuelve un entero dentro de ambos extremos. El orden y
número de tiradas es estable:

- Buscar comida: una tirada 1..5.
- Descansar: una tirada 1..10 únicamente si existe refugio.
- Explorar: una tirada 1..20.
- Reparar: una tirada 1..10.
- Pescar: entre una y seis tiradas 1..3; se detiene en el primer 1 o al
  agotar el máximo.
- Ayuda y Comer: ninguna tirada de acción.
- Después de la acción, Agonía consume una tirada 1..100. Normal no consume
  ninguna.

Las pruebas inyectan secuencias finitas; ninguna prueba depende de azar real.

## Eventos de Agonía

Se genera un entero 1..100 por resolución:

| Resultado | Rango | Probabilidad nominal | Efecto |
|---|---:|---:|---|
| Tormenta | 1–10 | 10% | Establece `hasShelter = false`. |
| Mapache | 51–59 | 9% | Establece `food = 0`. |
| Meteorito | 99 | 1% | Reduce `health` en 1, con suelo 0. |
| Sin evento | Resto | 80% | No cambia el estado. |

Los rangos son disjuntos. El meteorito no mata automáticamente a una partida
con salud 10; sí termina la partida si la salud llega a 0. Comer puede
recuperar salud mientras exista comida.

## Hitos y presión de dificultad

En cada resolución, en ambas dificultades:

- Al alcanzar exactamente 15, se emite `turn-15`.
- Al cruzar 15 desde un turno anterior, se emite `turn-15` y se aplica una
  penalización de +1 hambre y -1 energía.
- Al alcanzar exactamente 30, se emite `turn-30`.
- Al cruzar 30 desde un turno anterior, se emite `turn-30` y se aplica una
  penalización de +1 hambre y -1 energía.

La penalización se aplica únicamente al cruzar cada umbral. No se repite en
turnos 16..29 ni en turnos posteriores a 30. Una acción que salte del turno 14
al 16 recibe una sola presión del hito 15; una que salte del 29 al 31 recibe
una sola presión del hito 30. La emisión del hito y la presión conservan el
orden del pipeline.

## Fin de partida

La condición interna vigente es:

```text
Continuar mientras hunger <= 10
AND energy > 0
AND health != 0
```

`end.condition` registra la primera condición violada en el orden hambre,
energía y salud. `end.reportedCause` conserva la precedencia histórica del C:

1. Hambre cuando `hunger >= 10`.
2. Energía cuando `energy <= 0`.
3. Salud en los demás casos de terminación.

Estas dos causas pueden diferir. La interfaz debe mostrar `reportedCause`, no
una causa corregida. Al finalizar, `status` pasa a `dead` y
`end.turnsSurvived` es `turn - 1`.

No hay victoria, reinicio automático ni persistencia.

## Fidelidad y desviaciones

La línea base F-01..F-11 y las diferencias W-01..W-04 están en
[`docs/fidelity.md`](docs/fidelity.md). La Fase 1 sustituye o modifica
explícitamente estas reglas:

- `I-01`: comer consume y recupera.
- `I-02`: la pesca tiene seis intentos máximos.
- `I-03`: el meteorito quita uno de salud en lugar de matar directamente.
- `I-04`: los hitos aplican presión solo al cruzarse.
- `I-05`: existe una ruta de supervivencia renovable.
- `I-06`: la interfaz refleja las nuevas resoluciones sin revelar la salud.

Los defectos de la Fase 0 no se conservan como reglas actuales; permanecen
únicamente como línea base histórica para poder contrastarlos.

## Estructura

```text
src/game/
  types.ts             → contratos y uniones discriminadas
  initial-state.ts     → estado inicial
  actions.ts           → acciones, comer y pesca acotada
  events.ts            → eventos de Agonía
  difficulty.ts        → hitos y presión única
  end-state.ts         → fin y causas
  engine.ts            → pipeline completo
  index.ts             → API pública
  __tests__/           → pruebas unitarias y de supervivencia
```

## Estilo de código

- TypeScript estricto, sin `any` ni casts para silenciar el compilador.
- Sin imports de React, CSS o APIs del navegador en `src/game/`.
- Estado y resultados inmutables.
- Uniones discriminadas para estados, resultados, eventos e hitos.
- Errores de contrato lanzados inmediatamente.
- Funciones pequeñas orientadas a transiciones comprobables.

## Estrategia de pruebas

- 100% de statements, branches, functions y lines en `src/game/`.
- Una prueba por cada resultado, límite y orden de tiradas.
- Pruebas de que comer no baja el hambre de 0 ni la salud de 10.
- Pruebas de pesca con uno, seis y agotamiento de intentos.
- Pruebas de meteorito con salud inicial, salud crítica y recuperación por
  comer.
- Pruebas de hitos exactos, cruzados y de no repetición.
- Una prueba determinista que supere el turno 100 en Normal y Agonía.
- Pruebas de inmutabilidad y rechazo de partidas terminadas.
- Pruebas de la precedencia `condition`/`reportedCause`.

Comandos previstos:

```text
npm test
npm run test:coverage -- src/game
npm run typecheck
npm run lint
npm run build
```

## Límites

- Siempre: conservar la resolución antes del dispatch y el azar inyectable.
- Siempre: actualizar el ledger y esta especificación antes de cambiar una
  regla.
- Preguntar antes: añadir recursos, backend, persistencia, telemetría,
  recursos nuevos, victoria o cambios de probabilidad.
- Nunca: importar `window`, Web Storage, React o `Math.random` directamente
  desde `src/game/`.
- Nunca: dejar un bucle de pesca sin límite.
- Nunca: convertir una partida en victoriosa o corregir silenciosamente la
  precedencia de causas.

## Criterios de éxito

- Las siete acciones tienen una transición determinista y prueba.
- Una estrategia renovable supera 100 turnos en ambas dificultades.
- El meteorito no es una muerte automática desde salud inicial.
- No existe una ruta de pesca que pueda bloquear el bucle.
- Los resultados son reproducibles mediante `RandomInt`.
- El motor conserva 100% de cobertura.
- Las reglas y desviaciones están documentadas.
- No hay lógica de reglas fuera de `src/game/`.
