# Fidelidad de reglas

## Propósito

Este documento separa dos capas de reglas:

1. la **línea base histórica** que reprodujo el prototipo C en la primera
   entrega;
2. la **Fase 1 de supervivencia infinita**, aprobada para hacer que una
   estrategia viable pueda continuar indefinidamente.

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
| `F-07` | Los hitos usan igualdad exacta y pueden omitirse al saltar turnos. | Sustituido por `I-04`. |
| `F-08` | Una acción multiturno aplica la dificultad una sola vez al finalizar. | Se conserva como parte de `I-04`, con cruce de umbral. |
| `F-09` | Ayuda no consume turno, pero sí puede producir un evento en Agonía. | Se conserva. |
| `F-10` | Energía y comida no tienen límite superior. | Se conserva. |
| `F-11` | Los hitos y penalizaciones se aplican también en Normal. | Se conserva en `I-04`. |

### Diferencias inevitables de la web

| ID | Diferencia y motivo |
|---|---|
| `W-01` | No existe acción `invalid`: los controles React solo despachan valores de `GameAction`. |
| `W-02` | La dificultad se selecciona mediante una unión de dos valores; no se reproducen entradas inválidas de `scanf`. |
| `W-03` | `browserRandomInt` produce enteros nominalmente uniformes; no se reproduce el sesgo de `rand() % n` de MinGW. |
| `W-04` | El motor devuelve datos y claves de mensaje; no imprime texto directamente. |

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
| `I-04` | **Hitos de una sola vez:** al cruzar 15 y 30 se emite el hito y se aplica una penalización de +1 hambre y -1 energía. Ya no se repite una penalización en cada turno posterior; una acción multiturno cruza cada umbral como máximo una vez. |
| `I-05` | **Núcleo renovable:** una ruta determinística de reparar + buscar + comer + descansar supera el turno 100 en Normal y Agonía sin victoria, persistencia ni recursos externos. |
| `I-06` | **Comunicación:** la UI distingue comer, comer sin comida, pesca fallida, meteorito no mortal e hitos de presión única. La salud continúa oculta como recurso. |

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

- `SPEC-infinite-survival.md` define el alcance, las reglas y los criterios de
  aceptación de esta fase.
- `SPEC-game-engine.md` contiene el contrato vigente del motor.
- `src/game/__tests__/actions.test.ts` cubre comer, el máximo de pesca y sus
  costes.
- `src/game/__tests__/pipeline.test.ts` cubre meteoritos y el cruce de hitos.
- `src/game/__tests__/engine.test.ts` demuestra la ruta renovable hasta más de
  100 turnos en ambas dificultades.
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
