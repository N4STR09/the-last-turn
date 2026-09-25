# Fidelidad de reglas

## Propósito

Este documento separa dos capas de reglas:

1. la **línea base histórica** que reprodujo el prototipo C en la primera
   entrega;
2. la **Fase 1 de supervivencia infinita**, aprobada para hacer que una
   estrategia viable pueda continuar indefinidamente;
3. la **Fase 2 de escalada progresiva**, que sustituye la presión de una sola
   vez de la Fase 1 por una rampa que sube sola con el avance de la partida.

Las reglas actuales viven en `SPEC-game-engine.md`. Este archivo explica qué
se conservó, qué se cambió deliberadamente y qué restricciones siguen vigentes.

## Fuentes autorizadas

- `C:\Proyectos_C\the_last_turn_v2\the_last_turn_v2.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.h`

El ejecutable existente solo sirve como referencia visual. No demuestra que su
lógica sea idéntica a la de los fuentes actuales.

## Línea base histórica del C

La migración base trasladó los siguientes comportamientos antes de iniciar la
Fase 1. Se conservan aquí como referencia de contraste; no deben confundirse
con las reglas actuales cuando una entrada esté marcada como sustituida.

| ID | Comportamiento de la línea base | Estado actual |
|---|---|---|
| `F-01` | Comer no reduce el hambre ni consume comida en estados alcanzables. | Sustituido por `I-01`. |
| `F-02` | La salud solo puede pasar de 10 a 0 mediante un meteorito; no hay recuperación. | Sustituido por `I-03`. |
| `F-03` | No existe victoria. | Se conserva. |
| `F-04` | El bucle permite hambre 10, pero el mensaje de muerte empieza en 10. | Se conserva. |
| `F-05` | La terminación por energía puede quedar eclipsada por el mensaje de hambre. | Se conserva. |
| `F-06` | La pesca puede consumir un número ilimitado de turnos y quedar bloqueada. | Sustituido por `I-02`. |
| `F-07` | Los hitos usan igualdad exacta y pueden omitirse al saltar turnos. | Sustituido por `I-04`, y `I-04` a su vez por `T-01`. |
| `F-08` | Una acción multiturno aplica la dificultad una sola vez al finalizar. | Se conserva como parte de `T-01`, que salta al umbral más alto cruzado. |
| `F-09` | Ayuda no consume turno, pero sí puede producir un evento en Agonía. | Se conserva. |
| `F-10` | Energía y comida no tienen límite superior. | Se conserva. |
| `F-11` | Los hitos y penalizaciones se aplican también en Normal. | Se conserva: `T-01` escala en ambas dificultades. |

### Diferencias inevitables de la web

| ID | Diferencia y motivo |
|---|---|
| `W-01` | No existe acción `invalid`: los controles React solo despachan valores de `GameAction`. |
| `W-02` | La dificultad se selecciona mediante una unión de dos valores; no se reproducen entradas inválidas de `scanf`. |
| `W-03` | `browserRandomInt` produce enteros nominalmente uniformes; no se reproduce el sesgo de `rand() % n` de MinGW. |
| `W-04` | El motor devuelve datos y claves de mensaje; no imprime texto directamente. |
| `W-05` | La pantalla de escalada usa rojo sangre `#8b0000` sobre negro puro, con **2.10:1** de contraste. No cumple WCAG AA para texto. Es una desviación consciente: el tono pedido y un fondo negro puro son incompatibles con 4.5:1, y se eligió la estética. La pista de continuación usa `#7a7a7a` (4.89:1) y sí cumple, porque ahí no había conflicto estético. |

## Fase 1 aprobada: supervivencia infinita

La Fase 1 no introduce una condición de victoria. Hace posible que una persona
mantenga una estrategia y supere los turnos 15, 30 y 100 sin convertir el
hambre, la salud o la pesca en una prisión inevitable de estados irrecuperables.
Las decisiones se implementan mediante pruebas deterministas y no se ocultan
en la interfaz.

| ID | Regla actual y efecto |
|---|---|
| `I-01` | **Comer:** si hay comida, consume exactamente 1, reduce el hambre en 4 antes del coste normal (resultado neto de hasta 3, mínimo 0) y recupera 1 de salud hasta 10. Sin comida, cobra el turno cruel habitual. |
| `I-02` | **Pesca acotada:** busca un 1 con un máximo de 6 intentos. El éxito añade 3 comidas; el sexto fallo termina en `fish-failed` sin comida. Todos los intentos cobran turno, hambre y energía. |
| `I-03` | **Meteorito recuperable:** reduce la salud en 1, con suelo 0. La salud llega a 0 y termina la partida, pero comer puede recuperarla mientras haya comida. |
| `I-04` | **Hitos de una sola vez:** al cruzar 15 y 30 se emite el hito y se aplica una penalización de +1 hambre y -1 energía. Ya no se repite una penalización en cada turno posterior; una acción multiturno cruza cada umbral como máximo una vez. | Retirado por `T-01`. |
| `I-05` | **Núcleo renovable:** una ruta determinística de reparar + buscar + comer + descansar supera el turno 100 en Normal y Agonía sin victoria, persistencia ni recursos externos. | **Cumplido** desde el turno 103 tras el reequilibrio `T-11`. Antes fallaba: con la escalada de `T-01` la ruta ingenua moría en el turno 37 y el techo absoluto era el 50. |
| `I-06` | **Comunicación:** la UI distingue comer, comer sin comida, pesca fallida, meteorito no mortal e hitos de presión única. La salud continúa oculta como recurso. | Se conserva, salvo los hitos, que absorbe `T-01`. |

## Fase 2 aprobada: escalada progresiva de dificultad

La Fase 2 reemplaza los hitos 15 y 30 por un **nivel de amenaza** que sube solo
con el avance de la partida. Con carga 0 el comportamiento es idéntico a la
Fase 1, así que la línea base queda intacta hasta el turno 10.

| ID | Regla actual y efecto |
|---|---|
| `T-01` | **Nivel de amenaza:** un entero `threat` que se deriva del turno, nunca de la interfaz. El nivel `n` se alcanza en el turno `n² + 9n`, es decir 10, 22, 36, 52, 70, 90… Una acción multiturno salta al nivel más alto cruzado y emite un único aviso. |
| `T-02` | **Carga saturada:** los modificadores usan `load = min(threat, 10)`. `threat` sigue contando y sigue avisando para siempre, pero la carga mecánica se estabiliza para que la partida no se vuelva imposible por aritmética. |
| `T-03` | **Hambre:** cada turno cuesta `1 + min(6, ⌊load/2⌋)` de hambre. Es la palanca que rompió la economía renewable y obligó al reequilibrio `T-11`. |
| `T-11` | **Alivio de la ración escalado:** comer quita `4 + min(6, ⌊load/2⌋)` en lugar de 4 fijos. Es el reequilibrio aprobado de `D-01`. Sin él la partida es insuperable por construcción a partir de la carga 4, porque cada ración cuesta más hambre de la que devuelve. Con carga 0 y 1 no cambia nada, así que la Fase 1 queda intacta. |
| `T-04` | **Descanso:** el tope de energía recuperada baja a `max(1, 5 − ⌊load/3⌋)`. La tirada sigue decidiendo entre 3 y 5, pero la amenaza recorta el resultado. |
| `T-05` | **Eventos:** Agonía hace `1 + min(2, ⌊load/4⌋)` tiradas en vez de una. Cada tirada se aplica sobre el estado que dejó la anterior y `GameResolution.randomEvents` es una lista, no un valor único. |
| `T-06` | **Severidad:** con carga ≥ 1 la tormenta y el mapache cuestan además 1 de energía; con carga ≥ 3 el mapache quita además 1 de salud. La tabla de sorteos 1..100 no cambia. |
| `T-07` | **Buscar y reparar:** el éxito al buscar se estrecha a `max(1, 3 − ⌊load/3⌋)` y la reparación falla cuando `|tirada − 5| ≤ min(4, ⌊load/2⌋)`, un radio centrado en 5 que con carga 0 reproduce el fallo único heredado. Reparar cuesta `min(5, 2 + ⌊load/5⌋)` turnos. |
| `T-08` | **Sin decaimiento pasivo de la salud:** la salud sigue oculta, así que un desgaste silencioso sería ilegible. El único daño por salud continúa siendo un evento que se anuncia. |
| `T-09` | **Hitos absorbidos:** los mensajes y la penalización de los hitos 15 y 30 desaparecen. Esto retira el compromiso de fidelidad de `SPEC-infinite-survival.md` y es una decisión de Fase 2, no una corrección silenciosa. |
| `T-10` | **Aviso bloqueante:** el incremento se aplica en el motor al resolver el turno. La interfaz congela la partida, muestra un diálogo modal con el nivel y un mensaje jocoso en rojo sangre, y solo el click, `Enter` o `Espacio` lo descartan. Si ese mismo turno mata, el aviso se suprime y gana la pantalla de muerte. |

### Defectos detectados y resueltos

| ID | Defecto |
|---|---|
| `D-01` | **Resuelto por `T-11`.** La escalada de hambre de `T-03` hacía la partida insuperable a partir del nivel 4: una búsqueda exhaustiva sobre las siete acciones con el mejor azar posible agotaba el espacio alcanzable en el **turno 50**, así que ese era un máximo absoluto y no un promedio, y como el nivel 4 empieza en el turno 52 los niveles 4 a 10 eran inalcanzables por construcción. Con el alivio de la ración escalado, el techo absoluto sube a **191** y la rampa de niveles 1 a 10 queda entera dentro del alcance. El techo práctico con juego ordenado es 103, de modo que el tramo sigue siendo duro de verdad. Análisis completo, medidas y las dos opciones descartadas en `SPEC-threat.md`. |

### Invariantes que no cambian

- No hay victoria, ni backend, cuentas, Web Storage, telemetría, persistencia ni
  recursos de terceros en runtime.
- El motor sigue siendo puro, independiente de React y del navegador, con azar
  inyectado mediante `RandomInt` inclusivo.
- La precedencia entre `end.condition` y `end.reportedCause` se conserva,
  incluida la diferencia histórica entre hambre y energía.
- Ayuda no consume turno, pero Agonía todavía puede resolver un evento.
- Energía y comida no tienen techo; la salud sí tiene el máximo jugable 10.
- La UI continúa mostrando hambre, energía, comida y refugio, pero no la salud.

## Evidencia y trazabilidad

- `SPEC-threat.md` define el alcance, las fórmulas, el orden de resolución, el
  defecto `D-01` y su resolución mediante `T-11`.
- `SPEC-infinite-survival.md` define el alcance y las reglas de la Fase 1; su
  línea sobre los hitos 15 y 30 queda retirada por `T-09`.
- `SPEC-game-engine.md` contiene el contrato vigente del motor.
- `src/game/__tests__/threat.test.ts` cubre el calendario, la saturación de la
  carga y los siete modificadores con sus tablas completas, más el invariante
  `foodRelief > hambrePorTurno` que impedía volver a introducir `D-01`.
- `src/game/__tests__/actions.test.ts` cubre comer con alivio escalado, la pesca
  acotada, el radio de fallo al reparar y los costes con escalada.
- `src/game/__tests__/pipeline.test.ts` cubre la severidad, las tiradas extra y
  el orden acción → evento → escalada → fin.
- `src/game/__tests__/engine.test.ts` cubre los avisos, la supresión por muerte y
  **revierte el test que afirmaba `D-01`**: ahora exige superar el turno 100 en
  las dos dificultades y alcanzar el nivel 6 con juego ordenado.
- `src/ui/__tests__/escalation-overlay.test.tsx` cubre el diálogo modal, el foco,
  el click en cualquier sitio y las teclas de continuación.
- `src/app/__tests__/use-game-session.test.tsx` demuestra que la partida queda
  congelada y sin atajos mientras el aviso está abierto.
- `src/app/__tests__/game-view-model.test.ts` demuestra que la UI no presenta
  el meteorito como muerte inmediata y que traduce las nuevas resoluciones.

## Regla para cambios futuros

No se corrigirá ni eliminará una regla sin registrar una decisión explícita.
Una mejora posterior debe:

1. identificarse con un nuevo elemento `I-*` o una decisión de diseño
   equivalente;
2. añadir una prueba RED que demuestre el comportamiento anterior;
3. explicar la regla nueva y sus efectos sobre supervivencia, azar y fin;
4. actualizar este documento y `SPEC-game-engine.md` antes de cambiar el motor;
5. mantener la ausencia de victoria y las restricciones de frontend estático,
   salvo autorización explícita.

No se añadirá una diferencia `W-*` sin documentar su motivo y su impacto
observable. No se añadirá una regla sin una prueba que documente su efecto.
