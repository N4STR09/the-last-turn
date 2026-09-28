# Fidelidad de reglas

## Propósito

Este documento separa dos capas de reglas:

1. la **línea base histórica** que reprodujo el prototipo C en la primera
   entrega;
2. la **Fase 1 de supervivencia infinita**, aprobada para hacer que una
   estrategia viable pueda continuar indefinidamente;
3. la **Fase 2 de escalada progresiva**, que sustituye la presión de una sola
   vez de la Fase 1 por una rampa que sube sola con el avance de la partida;
4. el **rediseño de acciones**, que quita la pesca y la búsqueda de comida, mete
   la curación como acción propia, hace visible la salud y arregla dos
   fracturas aritméticas del diseño anterior.

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
| `F-09` | Ayuda no consume turno, pero sí puede producir un evento en Agonía. | Retirado por `U-12`: Ayuda ya no existe en el motor. Se conserva como línea base histórica. |
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
| `I-01` | **Comer:** si hay comida, consume exactamente 1 y reduce el hambre en 4 antes del coste normal (resultado neto de hasta 3, mínimo 0). Sin comida, cobra el turno cruel habitual. | Sustituido por `A-02` y `A-03`: comer ya no cura, y el alivio se escaló. |
| `I-02` | **Pesca acotada:** busca un 1 con un máximo de 6 intentos. El éxito añade 3 comidas; el sexto fallo termina en `fish-failed` sin comida. Todos los intentos cobran turno, hambre y energía. | Retirada por `A-01`: la acción desaparece entera. |
| `I-03` | **Meteorito recuperable:** reduce la salud en 1, con suelo 0. La salud llega a 0 y termina la partida, pero comer puede recuperarla mientras haya comida. | Se conserva, salvo la última cláusula: ahora la recupera `cure`, no comer. |
| `I-04` | **Hitos de una sola vez:** al cruzar 15 y 30 se emite el hito y se aplica una penalización de +1 hambre y -1 energía. Ya no se repite una penalización en cada turno posterior; una acción multiturno cruza cada umbral como máximo una vez. | Retirado por `T-01`. |
| `I-05` | **Núcleo renovable:** una ruta determinística de reparar + buscar + comer + descansar supera el turno 100 en Normal y Agonía sin victoria, persistencia ni recursos externos. | **Cumplido**, y con la ruta nueva el techo medido es 153. Antes el techo con la ruta anterior era 97, es decir que no había ruta. |
| `I-06` | **Comunicación:** la UI distingue comer, comer sin comida, pesca fallida, meteorito no mortal e hitos de presión única. La salud continúa oculta como recurso. | Sustituido por `A-05`: la salud se ve. |

## Fase 2 aprobada: escalada progresiva de dificultad

La Fase 2 reemplaza los hitos 15 y 30 por un **nivel de amenaza** que sube solo
con el avance de la partida. Con carga 0 el comportamiento es idéntico a la
Fase 1, así que la línea base queda intacta hasta el turno 10.

| ID | Regla actual y efecto |
|---|---|
| `T-01` | **Nivel de amenaza:** un entero `threat` que se deriva del turno, nunca de la interfaz. El nivel `n` se alcanza en el turno `n² + 9n`, es decir 10, 22, 36, 52, 70, 90… Una acción multiturno salta al nivel más alto cruzado y emite un único aviso. Con el rediseño, ninguna acción puede cruzar más de un umbral: la más larga dura 2 turnos y entre umbrales hay al menos 10. |
| `T-02` | **Carga saturada:** los modificadores usan `load = min(threat, 10)`. `threat` sigue contando y sigue avisando para siempre, pero la carga mecánica se estabiliza para que la partida no se vuelva imposible por aritmética. |
| `T-03` | **Hambre:** cada turno cuesta `1 + min(4, ⌊load/3⌋)` de hambre. Es la palanca que rompió la economía renewable. |
| `T-11` | **Alivio de la ración escalado:** comer quita `4 + 2·min(4, ⌊load/3⌋)` en lugar de 4 fijos. Es el reequilibrio aprobado de `D-01`, endurecido por la válvula de escape `A-04`. Sin él la partida es insuperable por construcción a partir de la carga 4, porque cada ración cuesta más hambre de la que devuelve. Con carga 0, 1 y 2 no cambia nada, así que la Fase 1 queda intacta. |
| `T-04` | **Descanso:** el tope de energía recuperada baja a `max(3, 5 − ⌊load/4⌋)`. La tirada sigue decidiendo entre 2 y 4, pero la amenaza recorta el resultado. El suelo 3 garantiza que descansar con refugio siempre devuelva más de lo que cuesta el turno. |
| `T-05` | **Eventos:** Agonía hace `1 + min(2, ⌊load/4⌋)` tiradas en vez de una. Cada tirada se aplica sobre el estado que dejó la anterior y `GameResolution.randomEvents` es una lista, no un valor único. |
| `T-06` | **Severidad:** con carga ≥ 1 la tormenta y el mapache cuestan además 1 de energía, **una sola vez por turno**; con carga ≥ 3 el mapache quita además 1 de salud. La tabla de sorteos 1..100 no cambia. |
| `T-07` | **Reparar:** falla cuando `|tirada − 5| ≤ min(4, ⌊load/2⌋)`, un radio centrado en 5 que con carga 0 reproduce el fallo único heredado. Cuesta dos turnos fijos. El éxito al buscar comida y los turnos variables de reparar se retiran con sus acciones (`A-01`). |
| `T-08` | **Sin decaimiento pasivo de la salud:** un desgaste silencioso sería ilegible del mismo modo que lo era cuando la salud estaba oculta, así que la regla no cambió con la visibilidad. El único daño por salud sigue siendo un evento que se anuncia o el resultado de explorar, que dice cuánto costó. |
| `T-09` | **Hitos absorbidos:** los mensajes y la penalización de los hitos 15 y 30 desaparecen. Esto retira el compromiso de fidelidad de `SPEC-infinite-survival.md` y es una decisión de Fase 2, no una corrección silenciosa. |
| `T-10` | **Aviso bloqueante:** el incremento se aplica en el motor al resolver el turno. La interfaz congela la partida, muestra un diálogo modal con el nivel y un mensaje jocoso en rojo sangre, y solo el click, `Enter` o `Espacio` lo descartan. Si ese mismo turno mata, el aviso se suprime y gana la pantalla de muerte. |

### Defectos detectados y resueltos

| ID | Defecto |
|---|---|
| `D-01` | **Resuelto por `T-11`.** La escalada de hambre de `T-03` hacía la partida insuperable a partir del nivel 4: una búsqueda exhaustiva sobre las siete acciones con el mejor azar posible agotaba el espacio alcanzable en el **turno 50**, así que ese era un máximo absoluto y no un promedio, y como el nivel 4 empieza en el turno 52 los niveles 4 a 10 eran inalcanzables por construcción. Las cifras de entonces eran sobre el conjunto de acciones anterior; con el rediseño la medición vive en `SPEC-threat.md` y el techo actual es 153. Análisis completo y las dos opciones descartadas, también en `SPEC-threat.md`. |

### Invariantes que no cambian

- No hay victoria, ni backend, cuentas, Web Storage, telemetría, persistencia ni
  recursos de terceros en runtime.
- El motor sigue siendo puro, independiente de React y del navegador, con azar
  inyectado mediante `RandomInt` inclusivo.
- La precedencia entre `end.condition` y `end.reportedCause` se conserva,
  incluida la diferencia histórica entre hambre y energía.
- Energía y comida no tienen techo; la salud sí tiene el máximo jugable 10, que
  vive en `MAX_HEALTH`.
- La UI muestra hambre, energía, comida, salud y refugio. Lo que cambió en la
  Fase 4 fue la **forma** del refugio —pasa a línea propia y se dice entero—, no
  el hecho de mostrarlo. Lo que cambió con el rediseño de acciones fue que la
  salud dejó de estar oculta (`A-05`). `F-09`, la regla de que Ayuda no consume
  turno, queda retirada por `U-12` y se conserva aquí solo como línea base
  histórica.

## Fase 3 aprobada: rediseño de interfaz

El rediseño no toca ninguna regla. Su riesgo no era aritmético sino de
representación: una interfaz puede mentir sin tocar el motor. Las tres
desviaciones de este bloque son de ese tipo, y por eso se declaran aquí.

| ID | Regla actual y efecto |
|---|---|
| `U-01` | **El gasto impreso no es un coste por acción, es un coste por turno.** Hambre y energía se gastan por turno, así que la etiqueta de cada botón se calcula en `src/game/action-cost.ts` a partir de la amenaza vigente. Cuatro de las cinco acciones cuestan un turno y reparar cuesta dos. Un número fijo en los botones habría mentido en cuanto la escalada cambiara el hambre por turno, y lo hace en todas. La regla vive en el motor, no en la vista, porque es conocimiento de reglas. |
| `U-02` | **Ningún botón anuncia un peor caso, porque ya no hay coste azar.** Con la pesca, el botón solo podía ser honesto diciendo «hasta +6 hambre, −6 energía». Quitada la pesca, las cinco acciones gastan un número fijo y conocido, así que la etiqueta es el gasto exacto y `actionTurns` devuelve un número y no un intervalo. El jugador decide con el precio real, que es lo único que convierte una acción en una decisión y no en una trampa. |
| `U-03` | **El nivel del banner es el de escalada, no el modo de dificultad.** `Nivel 3` significa amenaza 3, que es lo que cambia la partida. El modo lo comunica la calavera, con cuernos y ojos rojos en Agonía, y no se repite en texto. Repetirlo en el banner lo diría dos veces de dos maneras, y la segunda sería solo texto. |
| `U-04` | **El aviso y el parpadeo son la misma señal.** Basta con que `tone` sea `'warning'`: avisa en texto y late a la vez. Antes había un campo `critical` aparte, que existía para que «estar sin refugio» latiera menos que «quedarse sin energía». Con el refugio fuera de la lista de cifras ya no hay ningún caso que separe las dos cosas, así que el campo desaparece en vez de quedarse como adorno. |
| `U-05` | **La barra de recursos no es el dato.** Un bloque por unidad hasta doce y, por encima, satura. La cifra numérica sigue siendo la verdad y la barra va `aria-hidden`, porque es redundancia visual sobre un texto que ya está al lado. Un recurso con 30 de comida llenaría la pantalla de bloques si cada bloque fuera una unidad sin tope. La salud es la excepción: su barra va hasta `MAX_HEALTH`, diez bloques, porque no comparte escala con las otras tres. |
| `U-06` | **`#8b0000` del aviso de escalada sigue sin cumplir contraste.** 2.10:1 sobre negro puro. Es `W-05`, una desviación ya documentada que el rediseño no amplía ni reduce: el aviso conserva su lenguaje porque es el que fija el tono. Todo el texto nuevo cumple AA o mejor. |

### Desviaciones de la interfaz anterior

Estas no son reglas de juego, pero cambian lo que el jugador ve y por eso se
registran:

| ID | Antes | Ahora |
|---|---|---|
| `U-07` | El turno y la dificultad aparecían como un `dl` etiquetado «Turno» y «Dificultad». | La ronda y el nivel de escalada van en el banner como cifra grande y brillante. La dificultad sale del texto y pasa a la calavera. |
| `U-08` | Los botones llevaban icono, título y descripción de una línea. | Icono y título, con el gasto en una línea de tres o cuatro palabras. La descripción larga se sustituyó por un dato calculado. |
| `U-09` | Los recursos eran tarjetas con etiqueta, valor grande y frase de estado siempre visible. | Una fila por recurso con barra de bloques, y la frase de estado solo cuando hay algo que avisar. |
| `U-10` | El panel narrativo mostraba «Lo que acaba de ocurrir / Última resolución». | Es la terminal, con la ronda en el prompt y la calavera detrás. |
| `U-11` | La pantalla de dificultad describía los hitos 15 y 30, que la Fase 2 había eliminado. | Describe la escalada progresiva. El copy obsoleto sobrevivió a la Fase 2 porque la comprobación del bundle buscaba «quince turnos» en palabras y el texto usaba cifras. |

## Fase 4: rendirse y limpieza de copy

Ninguna de estas cuatro piezas cambia una regla del motor. Dos las quitan
(`U-12`, `U-13`), una reorganiza la lectura (`U-14`) y una es una errata (`U-15`).
Se registran igual porque el jugador las nota, y porque borrar algo del motor
merece la misma constancia que añadirlo.

| ID | Regla actual y efecto |
|---|---|
| `U-12` | **Ayuda desaparece del motor, no de la interfaz.** Sale de `GameAction`, de `ActionOutcome`, de `action-cost.ts` y del mapa de atajos, y con ella desaparece su fila de la rejilla. Se elimina igual que se eliminaron los hitos: una acción que no hace nada en el motor es ruido que además obliga a cada prueba a gastar un turno de datos en algo que no existe. Sustituto declarado: `Descansar`, la única acción de un turno que no tira azar **ni necesita comida previa**, que es justo lo que exigían los fixtures. |
| `U-13` | **Rendirse no es una acción.** No es un `GameAction`, no gasta turnos, no tira dados, no dispara eventos y no sube la escalada. Es un comando del reducer (`ask-surrender`, `cancel-surrender`, `surrender`) que llama a `surrenderGame` en `src/game/end-state.ts`, con su propia `EndCondition` y su propia `DeathCause`, las dos `'surrender'`. Si fuera una acción, la partida inventaría un `ActionOutcome` para algo que no resuelve un turno, y ese `ActionOutcome` obligaría a una rama muerta en `actionIdForOutcome` y en `outcomeCopy`. También por eso no hay atajo de teclado: una decisión que borra la partida no debería salir de una pulsación suelta. |
| `U-14` | **El refugio sale de la lista de cifras y pasa a línea propia.** Antes compartía fila con hambre, energía y comida, con la etiqueta «Refugio», la cifra «Presente»/«Ausente» y un bloque. Ahora es un interruptor y se dice entero: `Construido` o `Destruido`, en su propia línea debajo de las cifras, con su bloque encendido o apagado. La palabra vive en un único sitio, el helper `shelterStatus`, que también usa el delta de la terminal. |
| `U-15` | **La entradilla de inicio decía «Overvive».** Era una errata, no una decisión: la palabra no es esa. Dice «Sobrevive todo lo que puedas» y hay una prueba literal que falla si vuelve a colarse el anglicismo. |

Además, las tarjetas de dificultad perdieron la palabra «modo de supervivencia»,
porque no distinguía una de la otra: las dos son supervivencia. Y la pantalla de
dificultad centra ahora su cabecera como bloque, no solo sus líneas, porque los
elementos de rejilla se estiran a su columna.

## Fase 5 aprobada: rediseño de acciones

El rediseño de la Fase 3 y la 4 no tocó ninguna regla. Este sí, y por eso se
registra con el mismo detalle que las fases de motor. Su diagnóstico fue
medido, no intuitivo, y lo que encontró fue que dos de los tres problemas
—que Agonía fuera un impuesto y que la partida no fuera renewable— no se
arreglaban moviendo números sino cambiando estructura. El análisis completo, con
las mediciones antes y después, está en `SPEC-threat.md`; aquí queda la regla.

| ID | Regla actual y efecto |
|---|---|
| `A-01` | **Cinco acciones, una función cada una:** `explore`, `eat`, `cure`, `rest`, `repair`. La búsqueda de comida y la pesca se retiran del motor, y con ellas desaparece la palanca de escalada que las sostenía. La suma de las cinco cubre los cinco recursos sin que dos compitan por el mismo. |
| `A-02` | **La comida tiene tres sumideros que compiten:** calorías (`eat`), medicina (`cure`) y reserva. Es el cambio de fondo del rediseño. Con la pesca, guardar comida era gratis; ahora guardar tiene coste, porque la comida que no se gasta es la que paga la cura. |
| `A-03` | **Comer no cura. Curar es la única vía de curación:** dos comidas, sin tirada, y devuelve `max(2, exploreWound)`. Si comer curara, curar sería siempre la opción dominante y la barra de salud dejaría de ser un presupuesto. La paridad con `exploreWound` no es decorativa: sin ella, a carga 6 el hallazgo grande salía peor por punto de salud que el pequeño y explorar tenía una opción mala. |
| `A-04` | **Válvula de escape:** `extraHungerPerTurn` pasa a `min(4, ⌊load/3⌋)`, el alivio de la ración a `4 + 2·extra` y el tope del descanso a `max(3, 5 − ⌊load/4⌋)`. Con `/2` en el hambre por turno, el hambre y el alivio crecían al mismo ritmo y la holgura por ración no se movía nunca: la partida no era renewable por construcción y su techo absoluto era el turno 97. Con la válvula, 153. |
| `A-05` | **La salud se ve. Es una inversión consciente de un requisito del C**, no una corrección. Pasa a ser la cuarta cifra, con barra propia de `MAX_HEALTH` bloques y su propio color, y su estado se anuncia en texto a partir de 3 (`A un paso de la muerte` a 2 o menos, `Sangrando` a 5 o menos). El motivo es que la salud se administra —explorar la gasta, curar la devuelve— y un presupuesto que no se ve no se puede administrar. La desviación se declara aquí para que no se lea como una omisión en el ledger. |
| `A-06` | **Reparar dura dos turnos fijos y no hiere.** Que el botón pueda decir el gasto entero es la razón: con un rango de 2 a 5 turnos el motor no garantizaba el resto y solo podía anunciar el peor caso. Es la única acción de dos turnos y la única que no toca la salud, así que paga solo con tiempo. |
| `A-07` | **El recargo de energía de los eventos se cobra una vez por turno**, propagando la marca entre tiradas en lugar de reiniciarla, y el meteorito no la consume porque no la cobra. Antes el peor turno de Agonía costaba 3 de energía contra un descanso que devolvía 1, lo que encadenaba la caída sin dejar turno en el que decidir. Es la fractura `D-02`. |
| `A-08` | **El mapache saquea `foodRaid` en vez de vaciar el depósito.** Vaciarlo mataba a todos por igual y en el mismo turno, así que decidía la partida antes de que la estrategia tuviera nada que decir. Robar una cantidad fija golpea a quien tiene el depósito lleno, que es una decisión y no una sentencia. |
| `A-09` | **Descansar sin refugio devuelve 1**, que es exactamente lo que cuesta el turno: el refugio multiplica, no habilita. Antes devolvía 0, y ese 0 era el segundo tramo de la fractura `D-02`. Descansar tampoco cura: si lo hiciera, curar sería inútil en cuanto tuvieras techo y el refugio sería una segunda vía de curación. |
| `A-10` | **El cierre de salud es `<= 0`, no `=== 0`.** El daño no siempre cae de uno en uno —explorar quita de 2 a 5 según la carga—, así que la salud se salta el cero con facilidad. Con igualdad exacta, a partir de carga 8 un jugador con salud 3 podía explorar hasta quedar en negativo y seguir jugando. |
| `A-11` | **Atajos:** `E` explorar, `C` comer, `S` curar, `D` descansar, `R` reparar. La tecla es la inicial del verbo. Se retiran `B` y `P` y quedan sin mapeo, y hay una prueba que lo fija: una tecla que sobró no puede seguir significando una acción que ya no existe. |


## Evidencia y trazabilidad

- `SPEC-threat.md` define el alcance, las fórmulas, el orden de resolución, la
  válvula de escape y los tres defectos medidos: `D-01`, `D-02` y `D-03`.
- `SPEC-infinite-survival.md` define el alcance y las reglas de la Fase 1; su
  línea sobre los hitos 15 y 30 queda retirada por `T-09`, y su peso en la
  estrategia renewable queda sustituido por la ruta de `A-01`.
- `SPEC-game-engine.md` contiene el contrato vigente del motor.
- `src/game/__tests__/threat.test.ts` cubre el calendario, la saturación de la
  carga y los nueve modificadores con sus tablas completas, más el invariante
  `foodRelief > hungerPerTurn` que impedía volver a introducir `D-01` ni `D-03`,
  y la paridad `cureAmount === exploreWound` que impedía reintroducir la opción
  mala de explorar.
- `src/game/__tests__/actions.test.ts` cubre las cinco acciones: los tres
  resultados de explorar, el alivio escalado de comer, la cura con y sin comida,
  el descanso con y sin techo, y el radio de fallo al reparar.
- `src/game/__tests__/action-cost.test.ts` fija los turnos de cada acción y el
  gasto por turno, y comprueba que ninguna etiqueta necesita un intervalo.
- `src/game/__tests__/pipeline.test.ts` cubre la severidad, el recargo único de
  energía, el saqueo parcial, las tiradas extra, el cierre con `health <= 0` y el
  orden acción → evento → escalada → fin.
- `src/game/__tests__/engine.test.ts` cubre los avisos, la supresión por muerte y
  **revierte el test que afirmaba `D-01`**: ahora exige superar el turno 100 en
  las dos dificultades con el piloto `competentAction` y el `bestLuck` de cada
  dado, y que el nivel 6 sea alcanzable.
- `src/ui/__tests__/escalation-overlay.test.tsx` cubre el diálogo modal, el foco,
  el click en cualquier sitio y las teclas de continuación.
- `src/app/__tests__/use-game-session.test.tsx` demuestra que la partida queda
  congelada y sin atajos mientras el aviso está abierto.
- `src/app/__tests__/game-view-model.test.ts` demuestra que la UI expone las
  cuatro cifras, que la salud usa su propio techo de barra, que la terminal
  traduce las nuevas resoluciones y que ninguna etiqueta dice «hasta».
- `src/ui/__tests__/game-screen.test.tsx` fija la geometría de la fila del
  refugio, las cuatro filas de cifras, la barra de diez bloques de la salud y el
  texto del aviso cuando cae a un paso de la muerte.
- `src/game/__tests__/pipeline.test.ts` cubre `surrenderGame`: termina la
  partida, declara `'surrender'` en las dos causas, conserva el recuento de
  turnos y **no tira azar** en una partida de Agonía con tirada fija.
- `src/app/__tests__/app-state.test.ts` cubre los tres comandos de rendirse y
  sus guardas: con el aviso de escalada abierto, fuera de la partida viva, o sin
  confirmación puesta, el reducer devuelve el estado **idéntico**.
- `src/app/__tests__/keyboard-focus.test.tsx` fija el mapa de los cinco atajos y
  que `B` y `P` quedan sin mapeo.
- `src/ui/__tests__/surrender-control.test.tsx` cubre el diálogo entero: apertura,
  foco dentro, trampa de tabulador en los dos sentidos, Escape, click fuera que
  no hace nada, y devolución del foco al botón al cancelar.
- `src/ui/__tests__/screens.test.tsx` fija el copy del inicio («Sobrevive», nunca
  «Overvive») y la ausencia de la etiqueta «modo de supervivencia».
- `src/ui/__tests__/game-over.test.tsx` distingue `Fin voluntario` de
  `El último aliento` y traduce la causa `surrender`.

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
