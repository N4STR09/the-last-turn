# Especificación: escalada progresiva de dificultad

## Estado

Aprobada el 25 de septiembre de 2026 como **Fase 2** y revisada después del
rediseño de acciones. Sigue siendo la espina dorsal de la dificultad: la escalada
se anuncia siempre con una pantalla a negro que congela la partida, y el
incremento se aplica en el motor, no en la interfaz. Lo que cambió en la revisión
son las fórmulas —la válvula de escape—, el conjunto de modificadores y las
mediciones.

El juego sigue siendo una SPA estática, sin victoria, sin persistencia y sin
recursos de terceros.

## Objetivo

Una partida debe volverse progresivamente más difícil de sobrevivir sin que
deje de ser jugable. La escalada se anuncia siempre con una pantalla a negro
que congela la partida, y el incremento se aplica en el motor, no en la
interfaz.

## Nivel de amenaza

El estado lleva un entero `threat`, que empieza en `0` y solo sube. La
interfaz nunca lo edita: se deriva del turno.

El nivel `n` se alcanza en el turno

```text
threshold(n) = n² + 9n
```

Es decir, en los turnos 10, 22, 36, 52, 70, 90, 112, 136, 162, 190, … El primer
salto es de 10 turnos y después cada hueco crece 2 turnos más. Una acción
multiturno puede cruzar varios umbrales de una vez: el nivel pasa al más alto
alcanzado y se emite un único aviso.

Que la acción más larga sea de dos turnos —reparar— tiene una consecuencia que
conviene dejar escrita: **ninguna acción puede saltarse un umbral entero**, porque
entre umbrales hay al menos 10 turnos y la más larga dura 2. El salto de varios
niveles de una vez sigue siendo código vivo, y está probado en
`threat.test.ts` sobre `applyThreat` directamente, pero ya no lo alcanza ninguna
jugada.

## Carga mecánica

Los modificadores no usan `threat` directamente sino la **carga**, que satura:

```text
load = min(threat, 10)
```

`threat` sigue contando para siempre y sigue generando avisos; la carga
mecánica se estabiliza. Sin ese tope, hacia el turno 200 ninguna estrategia
sería viable y el juego dejaría de ser difícil para ser una ejecución.

| Modificador | Fórmula | Carga 0 → 10 |
|---|---|---|
| Hambre extra por turno | `min(4, ⌊load/3⌋)` | 0,0,0,1,1,1,2,2,2,3,3 |
| **Alivio de la ración** | `4 + 2·min(4, ⌊load/3⌋)` | 4,4,4,6,6,6,8,8,8,10,10 |
| Tope de energía al descansar | `max(3, 5 − ⌊load/4⌋)` | 5,5,5,5,4,4,4,4,3,3,3 |
| Herida y cura de explorar | `2 + ⌊load/3⌋` | 2,2,2,3,3,3,4,4,4,5,5 |
| Hallazgo grande al explorar (`valor ≤`) | `max(2, 6 − ⌊load/2⌋)` | 6,6,5,5,4,4,3,3,2,2,2 |
| Hallazgo normal al explorar (`valor ≤`) | `max(10, 16 − ⌊load/2⌋)` | 16,16,15,15,14,14,13,13,12,12,11 |
| Raciones que roba el mapache | `max(2, 3 + ⌊load/3⌋)` | 3,3,3,4,4,4,5,5,5,6,6 |
| Radio de fallo al reparar | `min(4, ⌊load/2⌋)` | 0,0,1,1,2,2,3,3,4,4,4 |
| Tiradas de evento extra (Agonía) | `min(2, ⌊load/4⌋)` | 0,0,0,0,1,1,1,1,2,2,2 |

Con `load = 0` todos los modificadores reproducen exactamente la Fase 1.

Las tres palancas que dejaron de existir no se sustituyeron, se eliminaron junto
con las acciones que las usaban: el éxito de **buscar comida** (`max(1, 3 − ⌊load/3⌋)`)
y los **turnos al reparar** (`min(5, 2 + ⌊load/5⌋)`) desaparecieron con la acción de
buscar y al fijar la reparación en dos turnos. La **pesca** desapareció entera,
con su límite de intentos y con su coste por turno variable.

### La válvula de escape

`extra = min(4, ⌊load/3⌋)` es el número del que cuelgan el hambre por turno, el
alivio de la ración y la herida de explorar. Antes de la válvula valía
`min(6, ⌊load/2⌋)`, y ese `/2` era el problema: **el hambre por turno y el alivio
de la ración crecían exactamente al mismo ritmo**, así que la holgura por ración no
se movía nunca con la carga. Con el `/2` la holgura era 3 puntos en toda la
rampa; con el `/3` es 3,3,3,4,4,4,5,5,5,6,6.

Tres modificadores cambian con la válvula, y los tres por la misma razón:

- `hungerPerTurn = 1 + extra`. El turno sale más barato: a carga 10 cuesta 4 en
  lugar de 7.
- `foodRelief = 4 + 2·extra`. La ración sube al **doble** que el hambre por turno.
  Esa asimetría es deliberada: con el mismo multiplicador en los dos, comer solo
  tapaba el gasto del turno más un margen fijo, la fracción de turnos que había
  que dedicar a comer no bajaba nunca con la carga y el presupuesto se cerraba
  solo. Al doblarlo, comer cubre más turnos conforme sube la amenaza y explorar
  conserva su parte.
- `restEnergyCap = max(3, 5 − ⌊load/4⌋)`. El suelo sube de 2 a 3, así que
  descansar con refugio **siempre** devuelve más de lo que cuesta el turno. Con
  suelo 2 el descanso se convertía en un impuesto en carga alta —neto +1— y la
  energía se iba de rositas en silencio.
- `cureAmount = max(2, exploreWound)`. Ver abajo, es una corrección de paridad y no
  parte de la válvula.

### La holgura de la ración

La ración quita `foodRelief`. **No es un modificador decorativo: es lo que hace el
juego superable.** Sin él, la escalada de hambre es aritméticamente letal a
partir de la carga 4, porque cada ración costaría más hambre de la que devuelve.
Está en la tabla por eso, y no como ajuste de equilibrio posterior.

La consecuencia de diseño es que la ración se vuelve más potente conforme sube la
amenaza mientras el resto de ingresos se empobrece. El juego no se abarata: se
estrecha. Hay un invariante comprobable en
`src/game/__tests__/threat.test.ts`:

```text
foodRelief(threat) > hungerPerTurn(threat)   para todo threat >= 0
```

Con la diferencia creciente de 3 a 6 puntos según la carga, que es la holgura que
compra turnos de comer. Ese margen es lo que hace falta para que la partida siga
siendo renewable en la carga alta, y por eso `SPEC-threat.md` fija el techo
medido por encima de 150.

### La paridad entre herida y cura

`cureAmount(threat) = max(2, exploreWound(threat))`. Curar devuelve exactamente lo
que abre el hallazgo grande, así que los dos tiers de explorar se pagan al mismo
precio por punto de salud.

Con escaleras separadas pasaba esto: a carga 6 el hallazgo grande costaba 4 de
salud y cerrar las heridas devolvía 3, de modo que el hallazgo grande salía a
1 comida por punto de salud y el pequeño —2 comidas por 1 de salud— era el doble
de rentable. **El premio grande se convertía en la peor jugada de la tabla.**
Explorar tenía una opción mala, y esa es la razón de que la partida se cerrara
antes de tiempo sin que nadie hubiera cometido un error evidente. La igualdad se
comprueba como test, no como comentario.

### La banda de fallo al reparar

La reparación **no** usa un límite inferior sino un **radio centrado en 5**:
falla cuando `|valor − 5| ≤ radio`. Con radio 0 falla únicamente la tirada 5,
que es el comportamiento heredado de C. Un límite del tipo `valor ≤ r` habría
hecho que la reparación nunca fallara con carga 0, rompiendo la línea base.

Con radio 4 fallan las tiradas 1 a 9 y la única salida segura es el 10.

## Severidad de eventos

| Carga | Efecto adicional |
|---|---|
| `≥ 1` | Tormenta y mapache cuestan además 1 de energía, **una sola vez por turno**. |
| `≥ 3` | El mapache quita además 1 de salud. |

La tabla de sorteos 1..100 **no cambia**: tormenta 1–10, mapache 51–59,
meteorito 99. Con tiradas extra, cada tirada se aplica en orden sobre el
estado resultante de la anterior, y `GameResolution` expone `randomEvents` como
lista, no como valor único.

El recargo único de energía es lo que separa «dificultad» de «fractura», y está
en `events.ts` con la marca propagada entre tiradas en lugar de reiniciarse. Ver
`D-02`.

## Orden de resolución

1. Resolver la acción con los modificadores de amenaza que le correspondan.
2. Resolver `1 + min(2, ⌊load/4⌋)` tiradas de evento en Agonía. Normal no tira.
3. Subir `threat` al nivel que corresponde al turno y emitir el aviso.
4. Evaluar la condición de finalización.

Si el mismo turno mata a la persona, el aviso **se suprime**: la pantalla de
muerte gana. El nivel de amenaza sí queda aplicado en el estado.

## Pantalla de escalada

Se muestra sobre la partida, a negro, con el foco atrapado dentro.

- `role="dialog"` y `aria-modal="true"`, etiquetada por el mensaje principal.
- El foco se mueve al diálogo al abrirse y no puede salir mientras esté abierto.
- Cierra con click en cualquier sitio, `Enter` o `Espacio`.
- Mientras está abierta, los atajos `E C S D R` están desactivados.
- El mensaje principal nombra el nivel y usa un texto jocoso cuyo tono empeora
  con el nivel. Debajo, `Haz click para continuar...` en gris apagado.
- El incremento ya está aplicado en el estado: el click solo despeja el aviso.

### Color y desviación de accesibilidad

| Elemento | Color | Contraste sobre `#000000` |
|---|---|---|
| Mensaje principal | `#8b0000` | 2.10:1 — **no cumple WCAG AA** |
| Pista de continuación | `#7a7a7a` | 4.89:1 — cumple AA |

`W-05` documenta esta desviación. Es una decisión consciente: el tono rojo
sangre sobre negro puro es incompatible con 4.5:1, y se eligió la estética
sobre la conformidad. La pista de continuación mantiene contraste porque no
tiene conflicto estético.

## Decisiones de alcance

- **No hay decaimiento pasivo de la salud.** La salud es una cifra visible, y un
  desgaste silencioso seguiría siendo ilegible igual que antes: la única forma
  de que el jugador administre la salud es que cada punto que pierde se anuncie
  con un evento o con el resultado de una acción. Por eso explorar dice en la
  terminal cuánto ha costado.
- **No se añaden tipos de evento nuevos.** «Más severos» se resuelve con la
  tabla de severidad; ampliar la tabla 1..100 con bandas condicionales
  complicaría el motor sin aportar.
- **Los hitos 15 y 30 se absorben.** Sus mensajes y su penalización desaparecen
  y quedan reemplazados por la escalada. Esto retira el compromiso de
  fidelidad de `SPEC-infinite-survival.md` y se registra como decisión de
  Fase 2, no como corrección silenciosa.

## Defecto D-01: la escalada de hambre hacía la partida insuperable

**Estado: resuelto. Se aplicó la opción 1 el 25 de septiembre de 2026.**

### Qué pasaba

Con las fórmulas aprobadas sin alivio escalado, la partida tenía un techo de
supervivencia de **50 turnos**, y el nivel de amenaza 4 no se alcanzaba nunca.

| Medición | Resultado antes del arreglo |
|---|---|
| Ruta renewable ingenua (reparar, luego buscar, comer, descansar en bucle, con azar determinista favorable) | Muere por hambre en el **turno 37**, en el nivel 3. Idéntico en Normal y Agonía. |
| Búsqueda exhaustiva sobre las 7 acciones con **el mejor azar posible** en cada tirada, deduplicando 8016 estados distintos hasta agotar el espacio alcanzable | Techo absoluto: **turno 50**, en el nivel 3, con hambre 9, energía 3, comida 0 y refugio. |

La segunda cifra es la que importa: **50 es un máximo**, no un promedio. No es
que la estrategia fuera mala, es que no existía ninguna.

### Por qué pasaba

El bucle depende de ingresos que no escalan igual:

| Recurso | Ingreso | Cómo escala con la carga |
|---|---|---|
| Comida | Pescar da **3 raciones en 2 turnos** si acierta a la primera, es decir 1,5 por turno, la mejor tasa del juego. Buscar da 1 por turno. | La probabilidad de acierto **baja**. |
| Energía | Descansar da como mucho `restEnergyCap` y cuesta 1 turno. | **Baja**, hasta 2. |
| Hambre por turno | Sube con la carga, hasta 6. | Sube. |
| Alivio de la ración | **4, fijo.** | No escalaba. |

La única razón por la que el bucle aguantaba hasta el turno 50 era que la pesca
rinde 1,5 raciones por turno, casi el doble que buscar. En cuanto el hambre por
turno llegaba a 3 (carga 4, turno 52) esa ventaja se consumía y el balance pasaba
a ser negativo para siempre.

### El arreglo aplicado

Opción 1, aprobada por la persona usuaria: **escalar también el alivio de la
ración**. Con carga 0, 1 y 2 no cambia nada, así que la Fase 1 queda intacta; a
partir de ahí la ración vuelve a tapar el gasto.

Se descartaron las otras dos opciones por razones que siguen vigentes:

- **Que la comida no empeorara con la carga** contradecía la palanca elegida de
  que buscar se vuelva más difícil, y hacía el juego más indulgente antes.
- **Bajar el tope de hambre extra a 1** dejaba el eje de hambre casi plano y
  obligaba a justificar los avisos de nivel 4 en adelante por las otras cinco
  palancas.

### Cobertura de la regresión

`src/game/__tests__/threat.test.ts` fija la rampa entera de cada modificador, con
tablas medidas con aritmética antes de escribir los asserts, más el invariante
aritmético que estaba detrás del defecto:

```text
foodRelief(threat) > hungerPerTurn(threat)   para todo threat >= 0
```

## Defecto D-02: la fractura de Agonía

**Estado: resuelto.**

### Qué pasaba

Agonía es un impuesto, no un juego. Antes del rediseño, con el piloto competente,
la mediana de supervivencia en Agonía era el turno 27 y el máximo absoluto 58,
frente a los 103 de Normal. Ese hueco no lo causaba ningún reequilibrio de
recursos: se probaron las tres palancas de la Fase 2 sobre el mismo piloto y la
mediana de Agonía se movió como mucho un turno. La partida no moría de hambre ni
de salud. Moría de **energía**, y por una razón concreta:

1. Con carga alta, Agonía hace tres tiradas de evento por turno.
2. Cada tormenta y cada mapache cobraban 1 de energía, **uno por evento**, así
   que el peor turno costaba 3.
3. Descansar con refugio devolvía como mucho 2, y con el suelo antiguo 1.
4. La tormenta ponía `hasShelter` en `false`, y sin refugio descansar devolvía 0,
   o sea que el descanso **dejaba de funcionar** en el mismo turno en que la
   tormenta lo rompía.

Los cuatro puntos encadenan: la energía caía sola, sin que hubiera un turno en el
que el jugador pudiera decidir. Eso no es dificultad, es una fractura, y por eso
no se arregla con números sino con estructura.

### Qué se cambió

- **El recargo de energía se cobra una vez por turno**, no uno por evento. La
  marca se propaga entre las tiradas del mismo turno en lugar de reiniciarse, y
  el meteorito no la consume porque no la cobra. El peor turno de Agonía pasa a
  costar 1 de energía en lugar de 3.
- **Descansar sin refugio devuelve 1**, que es exactamente lo que cuesta el
  turno. El refugio multiplica, no habilita: perderlo duele —el descanso se
  queda neutro— pero ya no es una sentencia. Antes devolvía 0, y ese 0 era el
  segundo tramo de la fractura.
- **El mapache saquea una cantidad fija** en vez de vaciar el depósito. Vaciarlo
  era una ruina económica: mataba a todos por igual y en el mismo turno, así que
  decidía la partida antes de que la estrategia tuviera nada que decir. Robar
  `foodRaid` golpea a quien tiene el depósito lleno, que es una decisión —¿guardo
  o gasto?— y no una sentencia.
- **Reparar no hiere y dura dos turnos fijos.** Antes costaba 6 unidades de
  hambre en una sola acción a carga 7, sin importar si salía bien.

## Defecto D-03: la partida no era renewable por construcción

**Estado: resuelto con la válvula de escape.**

### Qué pasaba

Con `extra = min(6, ⌊load/2⌋)`, el hambre por turno y el alivio de la ración
crecían al mismo ritmo, así que la holgura por ración era una constante de 3
puntos. Sumado a que a carga 6 el hallazgo grande (4 comidas por 4 de salud) salía
peor por punto de salud que el pequeño (2 comidas por 1 de salud), la partida
tenía una opción mala y su techo absoluto se quedaba en el **turno 97**, muy por
debajo del umbral 6 que empieza en el turno 90. Ninguna combinación de los otros
tres modificadores lo subía.

La partida no era renewable, y no por suerte del piloto: no había ninguna ruta.

### Qué se cambió

Los cuatro modificadores de la válvula de escape, descritos más arriba. El efecto
medido, con el mismo piloto competente:

| Medición | Antes | Después |
|---|---|---|
| Techo absoluto, mejor azar posible, Normal | 97 (turno) | **153** (turno, carga 8, muerte por hambre) |
| Normal, mediana | 80 | **118** |
| Normal, percentil 90 | 92 | **147** |
| Normal, máximo sobre 400 semillas | 105 | **172** |
| Agonía, mediana | 27 | **31** |
| Agonía, percentil 90 | — | **44** |
| Agonía, máximo | 58 | **57** |
| Causa de muerte en Normal | — | 57 % hambre / 43 % salud |
| Causa de muerte en Agonía | — | 57 % energía / 32 % hambre / 11 % salud |

### Un dato que conviene no perder

El máximo sobre 400 semillas es **172** y el techo con el mejor azar posible es
**153**, y no es una contradicción: el «mejor azar posible» fuerza el hallazgo
grande en cada exploración, y el hallazgo grande cuesta entre 2 y 5 de salud. Una
partida que juega de forma normal y tiene suerte de vez en cuando sobrevive más
que una que acierta el premio grande todas las veces. Es exactamente lo que
persigue la paridad entre `cureAmount` y `exploreWound`: el hallazgo grande tiene
que valer la pena, y vale la pena porque curarlo es proporcional, no porque
perjudique menos.

### Cobertura de la regresión

`src/game/__tests__/engine.test.ts` lleva el piloto `competentAction` con el
`bestLuck` de cada dado, y exige superar el turno 100 en las dos dificultades.
Las dos guardas del piloto no son decoración: sin reparar cuando la tormenta se
lleva el refugio, `rest` pasa a ser neto 0 y la partida se cuelga dormida; sin
explorar cuando no hay comida, los turnos se van en `eat` sin raciones. Con
cualquiera de las dos faltas, la ruta muere en el 16 por mucho que el motor esté
bien: mide al piloto, no al juego.

## Criterios de aceptación

- `threat` llega a 1 exactamente en el turno 10 y a 2 exactamente en el 22.
- `applyThreat` sobre un salto de varios umbrales entrega el nivel más alto y un
  solo aviso. Ninguna acción lo puede provocar, porque la más larga dura 2
  turnos y entre umbrales hay al menos 10.
- Con `load = 0` el comportamiento es idéntico a la Fase 1, incluida la
  reparación que solo falla con la tirada 5.
- Con carga 10, el hambre por turno es 4 y el tope de energía al descansar es 3.
- `foodRelief` supera al hambre que cuesta el turno en toda la rampa, con
  diferencia creciente.
- `cureAmount(threat) === exploreWound(threat)` en toda la rampa, para que
  explorar no tenga una opción mala.
- La partida sigue muriéndose solo por hambre, energía o salud.
- El aviso aparece con la partida congelada y desaparece al continuar.
- Los atajos de teclado no actúan mientras el aviso está abierto.
- El motor mantiene 100 % de cobertura.
- **Se puede sobrevivir más de 100 turnos** con juego ordenado, en Normal y en
  Agonía. Cumplido tras la válvula de escape: techo medido 153.
- **El techo absoluto con el mejor azar posible alcanza el turno 153**, de modo
  que los niveles 1 a 8 de la rampa quedan dentro del alcance alcanzable. Los
  niveles 9 y 10, que empiezan en los turnos 162 y 190, quedan por encima de
  cualquier ruta medible: es donde el juego pasa de difícil a histórico.
