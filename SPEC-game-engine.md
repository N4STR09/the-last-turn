# Especificación vigente: `game-engine`

## Estado

Esta es la especificación del motor después del **rediseño de acciones**. El juego
sigue siendo una SPA estática, sin victoria y sin persistencia, pero ahora la
salud es una estadística que se ve y se administra, la pesca ha desaparecido y
cada acción tiene una sola función. Medido con el piloto competente de
`engine.test.ts` sobre 400 semillas, la partida normal llega a la mediana del
turno 118, al percentil 90 del turno 147 y a un máximo de 172; y con el mejor
azar posible en cada dado el techo absoluto es el turno 153. El juego es
renewable por construcción, no por suerte.

Las decisiones de fidelidad y las desviaciones respecto del C están registradas
en [`docs/fidelity.md`](docs/fidelity.md).

## Objetivo

Portar de forma determinista y testeable las reglas de *The Last Turn* a
TypeScript, sin React, CSS, DOM ni APIs del navegador. El motor resuelve una
transición completa y devuelve datos estructurados; no imprime texto ni decide
animaciones.

Las reglas del C que se conservan intencionalmente incluyen la ausencia de
victoria, la precedencia entre `end.condition` y `end.reportedCause` y la fuente
de azar inyectable con extremos inclusivos. Los cambios del rediseño están
relacionados abajo y no son correcciones silenciosas. Uno de ellos —la salud
visible— **invierte** un requisito del C, y por eso está anotado en el ledger
como desviación y no como corrección.

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
- Representar dificultad, estadísticas, refugio, turno, escalada y finalización.
- Resolver las cinco acciones.
- Aplicar costes de uno o dos turnos.
- Ejecutar las tiradas de evento en Agonía cuando correspondan.
- Determinar la condición de fin y la causa comunicada.
- Terminar la partida por rendición, que no es un turno.
- Devolver resultados estructurados para la interfaz.

No es responsable de renderizar, navegar, esperar confirmaciones, guardar
estado, hacer sonar efectos ni decidir animaciones.

## Contrato público

```ts
export const MAX_HEALTH = 10;

export type Difficulty = 'normal' | 'agony';
export type GameStatus = 'playing' | 'dead';
export type EndCondition = 'hunger' | 'energy' | 'health' | 'surrender';
export type DeathCause = 'hunger' | 'energy' | 'health' | 'surrender';

export type GameAction = 'explore' | 'eat' | 'cure' | 'rest' | 'repair';

export type RandomInt = (min: number, max: number) => number;

export interface GameCoreState {
  readonly difficulty: Difficulty;
  readonly turn: number;
  readonly hunger: number;
  readonly energy: number;
  readonly food: number;
  readonly health: number;
  readonly hasShelter: boolean;
  readonly threat: number;
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

export interface ThreatNotice {
  readonly threat: number;
  readonly load: number;
}

export type ActionOutcome =
  | { readonly type: 'explore-rich'; readonly foodGained: 4; readonly healthLost: number }
  | { readonly type: 'explore-find'; readonly foodGained: 2; readonly healthLost: 1 }
  | { readonly type: 'explore-empty' }
  | { readonly type: 'cure-done'; readonly foodSpent: number; readonly healthRecovered: number }
  | { readonly type: 'cure-no-food' }
  | { readonly type: 'eat-consumed'; readonly foodConsumed: 1; readonly hungerReduced: number }
  | { readonly type: 'eat-no-food' }
  | { readonly type: 'rest-without-shelter'; readonly energyRecovered: number }
  | { readonly type: 'rest-shelter-success'; readonly energyRecovered: number }
  | { readonly type: 'repair-failed' }
  | { readonly type: 'repair-succeeded' };

export type GameEvent =
  | { readonly type: 'storm' }
  | { readonly type: 'raccoon' }
  | { readonly type: 'meteorite' };

export interface GameResolution {
  readonly state: GameState;
  readonly actionOutcome: ActionOutcome;
  readonly randomEvents: readonly GameEvent[];
  readonly threatNotice: ThreatNotice | null;
}
```

Las uniones discriminadas impiden representar una partida terminada sin `end` o
una partida activa que declare `end`. `RandomInt` siempre recibe extremos
inclusivos y el motor valida que el valor devuelto sea entero y esté dentro del
intervalo.

`MAX_HEALTH` vive en `types.ts` y no en `threat.ts` porque no escala con la
escalada: es el tope físico del cuerpo, no un modificador.

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

```ts
export function surrenderGame(state: GameState): FinishedGameState;
```

`surrenderGame` termina la partida sin matar a nadie. No es un turno: no tira
dados, no dispara eventos y no sube la escalada. Pasa por el mismo estado que
`finishGame` devuelve pero declara su propio motivo (`condition` y
`reportedCause`, los dos `'surrender'`), y `turnsSurvived` es el mismo porque son
los mismos turnos que el jugador llegó a completar.

Su firma acepta `GameState` y no solo `GameCoreState` a propósito: quien la llama
tiene una partida viva, y el motor deja constancia en el resultado en lugar de
validar. **No recibe `RandomInt`**, y esa firma es la prueba de que no tira azar.

La interfaz necesita además el gasto de cada acción antes de que el jugador
elija, y por eso `actionCost` y `actionTurns` son parte de la superficie pública:

```ts
export function actionTurns(action: GameAction): number;
export function actionCost(action: GameAction, threat: number): ActionCost;
```

Vivir en el motor y no en la vista es lo que garantiza que el botón y la
resolución cobren lo mismo: dos copias de la misma regla discreparían en
cuanto una cambiara.

## Estado inicial

| Campo | Valor |
|---|---:|
| `turn` | `1` |
| `hunger` | `0` |
| `energy` | `10` |
| `food` | `0` |
| `health` | `10` |
| `hasShelter` | `false` |
| `threat` | `0` |
| `status` | `playing` |

Normal no consume tiradas de evento. Agonía consume al menos una después de
cada acción, y hasta tres con la carga al alza. Rendirse no es una acción y por
eso no consume ninguna: termina la partida por una vía que no pasa por el orden
de resolución.

## Orden de resolución

Cada acción válida sigue este orden:

1. Resolver la acción y todos sus costes.
2. Resolver las tiradas de evento si la dificultad es Agonía.
3. Subir la escalada al nivel que corresponde al turno alcanzado.
4. Evaluar la condición de finalización.

El motor conserva la precedencia del C entre acción, evento, dificultad y fin.
Para una acción multiturno se entrega a la escalada el turno ya avanzado, de
modo que cruzar un umbral no lo omite ni lo multiplica. Si el turno mata, la
pantalla de muerte gana y `threatNotice` se devuelve `null`, aunque el nivel ya
esté aplicado en el estado.

## Semántica de acciones

Cinco acciones, una función cada una. La suma de las cinco cubre los cinco
recursos sin que dos compitan por el mismo, y la comida es el único recurso con
tres sumideros que compiten entre sí: **calorías, medicina y reserva**.

| Acción | Turnos | Regla vigente |
|---|---:|---|
| Explorar | 1 | Una tirada 1..20. Por debajo de `exploreRichLimit` añade 4 comidas y quita `exploreWound` de salud; por debajo de `exploreFindLimit` añade 2 comidas y quita 1; en el resto no pasa nada y no hiere. |
| Comer | 1 | Con comida, consume 1 y quita `foodRelief` de hambre, con suelo 0, antes del coste del turno. **No cura.** Sin comida, cobra el turno normal y no consume nada. |
| Curar | 1 | Consume 2 comidas y devuelve `cureAmount` de salud, hasta `MAX_HEALTH`. Sin 2 comidas cobra el turno normal y no cura. Sin tirada. |
| Descansar | 1 | Sin refugio devuelve 1 de energía, o sea exactamente lo que cuesta el turno. Con refugio, una tirada 1..10 da 2 o 4 antes del coste, recortada por `restEnergyCap`. **No cura.** |
| Reparar | 2 | Una tirada 1..10. Falla si cae dentro de la banda `repairFailureRadius` alrededor del 5 y conserva el estado anterior del refugio. No hiere. |

Tres decisiones de diseño que sostienen la tabla:

- **Comer no cura y curar no tira dados.** Si comer curara, curar sería siempre
  la opción dominante y la barra de salud dejaría de ser un presupuesto. Son dos
  decisiones que pagan con la misma comida, y esa competencia es el juego.
- **Descansar no cura.** Un descanso que cerrara heridas haría que curar fuese
  inútil en cuanto tuvieras techo, y el refugio se convertiría en la segunda vía
  de curación en lugar de ser lo que multiplica el descanso.
- **Reparar es la única acción de dos turnos y la única que no toca la salud.**
  Paga solo con tiempo, y por eso su precio se puede anunciar entero en el botón.

La ruta `repair → explore → eat → cure → rest` con resultados de azar favorables
es una estrategia renovable: el techo medido es el turno 153. No existe una
condición de victoria.

## Tiradas de azar

`RandomInt(min, max)` devuelve un entero dentro de ambos extremos. El orden y
número de tiradas es estable:

- Explorar: una tirada 1..20.
- Descansar: una tirada 1..10 únicamente si existe refugio.
- Reparar: una tirada 1..10.
- Comer: ninguna.
- Curar: ninguna.
- Después de la acción, Agonía consume `1 + extraEventRolls` tiradas 1..100, cada
  una aplicada sobre el estado que dejó la anterior. Normal no consume ninguna.

Las pruebas inyectan secuencias finitas; ninguna prueba depende de azar real.

## Eventos de Agonía

Se genera un entero 1..100 por tirada:

| Resultado | Rango | Probabilidad nominal | Efecto |
|---|---:|---:|---|
| Tormenta | 1–10 | 10% | Establece `hasShelter = false`. A partir de carga 1 cobra 1 de energía. |
| Mapache | 51–59 | 9% | Roba `foodRaid` comidas, con suelo 0. A partir de carga 1 cobra 1 de energía y a partir de carga 3 quita 1 de salud. |
| Meteorito | 99 | 1% | Reduce `health` en 1, con suelo 0. No cuesta energía. |
| Sin evento | Resto | 80% | No cambia el estado. |

Los rangos son disjuntos. El recargo de energía de tormenta y mapache se cobra
**una sola vez por turno**, no uno por evento, y la marca se propaga entre
tiradas en vez de reiniciarse. Con tres tiradas y un recargo por evento, el peor
turno de Agonía costaba 3 de energía contra un descanso que devolvía 1: una resta
que no era dificultad sino una fractura, porque encadenaba sola —la tormenta
tiraba el refugio, sin refugio descansar ya no rendía— y la partida se caía sin
que hubiera turno en el que decidir.

El mapache saquea una cantidad fija en vez de vaciar el depósito. Vaciarlo era una
ruina económica: mataba a todos por igual y en el mismo turno, así que decidía la
partida antes de que la estrategia tuviera nada que decir. Robar una cantidad
fija golpea a quien tiene el depósito lleno, que es una decisión —¿guardo o
gasto?— y no una sentencia.

## Fin de partida

La condición interna vigente es:

```text
Continuar mientras hunger <= 10
AND energy > 0
AND health > 0
```

`end.condition` registra la primera condición violada en el orden hambre,
energía y salud. `end.reportedCause` conserva la precedencia histórica del C:

1. Hambre cuando `hunger >= 10`.
2. Energía cuando `energy <= 0`.
3. Salud en los demás casos de terminación.

Estas dos causas pueden diferir. La interfaz debe mostrar `reportedCause`, no una
causa corregida. Al finalizar, `status` pasa a `dead` y `end.turnsSurvived` es
`turn - 1`.

La salud se cierra con `<= 0` y no con `=== 0`. El daño no siempre cae de uno en
uno —explorar quita de 2 a 5 según la carga—, así que la salud se salta el cero
con facilidad; con igualdad exacta, a partir de carga 8 un jugador con salud 3
podía explorar hasta quedar en negativo y seguir jugando, y la barra dejaba de
ser un presupuesto.

Hay una cuarta salida que no es una muerte: rendirse fija `condition` y
`reportedCause` a `'surrender'`, sin evaluar las tres condiciones anteriores. La
interfaz la distingue porque el rótulo y el mensaje tienen que describir una
decisión del jugador, no un cadáver.

No hay victoria, reinicio automático ni persistencia.

## Fidelidad y desviaciones

La línea base F-01..F-11 y las diferencias están en
[`docs/fidelity.md`](docs/fidelity.md). El rediseño de acciones sustituye o
modifica explícitamente estas reglas:

- `I-01`: comer consume y baja el hambre. Ya **no** cura.
- `I-02`: la pesca desaparece. Deja de existir un bucle de intentos, un coste
  azar y una acción cuyo botón solo podía anunciar el peor caso.
- `I-03`: el meteorito quita uno de salud en lugar de matar directamente.
- `I-04`: los hitos de turnos 15 y 30 quedan sustituidos por la escalada continua
  de `threat.ts`; ver `SPEC-threat.md`.
- `I-05`: existe una ruta de supervivencia renewable por construcción, con techo
  medido en el turno 153.
- `I-06`: la salud deja de estar oculta y pasa a ser la primera cifra, con barra
  propia de `MAX_HEALTH` bloques. **Es una inversión consciente del requisito del
  C**, y está anotada como desviación en `docs/fidelity.md`: la salud se
  administra, y un presupuesto que no se ve no se puede administrar.
- `I-07`: Ayuda desaparece del motor. No es que la interfaz la esconda: sale de
  `GameAction`, de `ActionOutcome` y de `action-cost.ts`. Se elimina igual que se
  eliminaron los hitos, porque una acción que no hace nada en el motor es ruido
  que además costaraba un turno de datos en cada prueba.
- `I-08`: rendirse no es una acción. Es `surrenderGame` en `end-state.ts`, con su
  propia `EndCondition` y su propia `DeathCause`, y su comando en el reducer.
- `I-09`: curar entra como acción propia, con comida como único recurso, y es el
  único camino de curación.
- `I-10`: el recargo de energía de los eventos se cobra una vez por turno.
- `I-11`: el mapache saquea `foodRaid` en vez de vaciar el depósito.
- `I-12`: reparar dura dos turnos fijos y no hiere.
- `I-13`: la válvula de escape de `hungerPerTurn`, `foodRelief`, `restEnergyCap`
  y `cureAmount`; la aritmética y el techo medido están en `SPEC-threat.md`.

Los defectos de la Fase 0 no se conservan como reglas actuales; permanecen
únicamente como línea base histórica para poder contrastarlos.

## Estructura

```text
src/game/
  types.ts             → contratos y uniones discriminadas
  initial-state.ts     → estado inicial
  actions.ts           → las cinco acciones
  events.ts            → eventos de Agonía
  threat.ts            → umbrales, carga y modificadores por escalada
  action-cost.ts       → turnos y gasto de hambre y energía por acción
  end-state.ts         → fin, causas y rendición
  engine.ts            → pipeline completo
  index.ts             → API pública
  __tests__/           → pruebas unitarias y de supervivencia
```

## Estilo de código

- TypeScript estricto, sin `any` ni casts para silenciar el compilador.
- Sin imports de React, CSS o APIs del navegador en `src/game/`.
- Estado y resultados inmutables.
- Uniones discriminadas para estados, resultados y eventos.
- Errores de contrato lanzados inmediatamente.
- Funciones pequeñas orientadas a transiciones comprobables.
- Sin `@ts-ignore` ni `eslint-disable`.

## Estrategia de pruebas

- 100% de statements, branches, functions y lines en `src/game/`.
- Una prueba por cada resultado, límite y orden de tiradas.
- Pruebas de que comer no baja el hambre de 0 y de que curar no sube la salud de
  `MAX_HEALTH`.
- Pruebas de las tres tiradas de evento de Agonía con la carga al alza: recargo
  único, saqueo parcial y tiradas repetidas.
- Pruebas de umbrales de escalada exactos y cruzados, y de no repetición.
- Pruebas de que `surrenderGame` no tira azar, no dispara eventos y no sube la
  escalada. La ausencia de `RandomInt` en su firma es la mitad de la prueba; la
  otra mitad es que no lo llame.
- Pruebas deterministas de que la partida es renewable en Normal y Agonía, con el
  techo absoluto por encima del turno 100.
- Pruebas de inmutabilidad y rechazo de partidas terminadas.
- Pruebas de la precedencia `condition`/`reportedCause`.
- Paridad entre `cureAmount` y `exploreWound`, para que el hallazgo grande nunca
  salga peor por punto de salud que el pequeño.

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
- Siempre: actualizar el ledger y esta especificación antes de cambiar una regla.
- Preguntar antes: añadir recursos, backend, persistencia, telemetría,
  recursos nuevos, victoria o cambios de probabilidad.
- Nunca: importar `window`, Web Storage, React o `Math.random` directamente
  desde `src/game/`.
- Nunca: dejar una acción con coste dependent de azar sin anunciarlo como
  intervalo.
- Nunca: convertir una partida en victoriosa o corregir silenciosamente la
  precedencia de causas.

## Criterios de éxito

- Las cinco acciones tienen una transición determinista y prueba.
- Ninguna acción tiene coste azar, y el botón lo anuncia exacto.
- Rendirse termina la partida sin tirar azar y sin matar a nadie.
- Una estrategia renovable supera 100 turnos en ambas dificultades.
- El meteorito no es una muerte automática desde salud inicial.
- El recargo de energía de los eventos no puede repetirse en un mismo turno.
- Los resultados son reproducibles mediante `RandomInt`.
- El motor conserva 100% de cobertura.
- Las reglas y desviaciones están documentadas.
- No hay lógica de reglas fuera de `src/game/`.
