# Especificación: escalada progresiva de dificultad

## Estado

Aprobada el 25 de septiembre de 2026. Es la **Fase 2** y sustituye a la presión
de una sola vez de la Fase 1 (`I-04`). El juego sigue siendo una SPA estática,
sin victoria, sin persistencia y sin recursos de terceros.

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
| Hambre extra por turno | `min(6, ⌊load/2⌋)` | 0,0,1,1,2,2,3,3,4,4,5 |
| **Alivio de la ración** | `4 + min(6, ⌊load/2⌋)` | 4,4,5,5,6,6,7,7,8,8,9 |
| Tope de energía al descansar | `max(1, 5 − ⌊load/3⌋)` | 5,5,5,4,4,4,3,3,3,2,2 |
| Tiradas de evento extra (Agonía) | `min(2, ⌊load/4⌋)` | 0,0,0,0,1,1,1,1,2,2,2 |
| Éxito al buscar comida (`valor ≤`) | `max(1, 3 − ⌊load/3⌋)` | 3,3,3,2,2,2,1,1,1,1,1 |
| Radio de fallo al reparar | `min(4, ⌊load/2⌋)` | 0,0,1,1,2,2,3,3,4,4,4 |
| Turnos al reparar | `min(5, 2 + ⌊load/5⌋)` | 2,2,2,2,2,3,3,3,3,3,4 |

Con `load = 0` todos los modificadores reproducen exactamente la Fase 1.

### El alivio de la ración

La ración quita `4 + hambreExtraPorTurno`. **No es un modificador decorativo: es
lo que hace el juego superable.** Sin él, la escalada de hambre es
aritméticamente letal a partir de la carga 4, porque cada ración cuesta más hambre
de la que devuelve. Está en la tabla por eso, y no como ajuste de equilibrio
posterior.

La consecuencia de diseño es que la ración se vuelve más potente conforme sube
la amenaza mientras el resto de ingresos se empobrece. El juego no se abarata:
se estrecha. La holgura total del bucle baja hacia cero y cualquier evento o
fallo de búsqueda te hunde. Hay un invariante comprobable en
`src/game/__tests__/threat.test.ts`:

```text
foodRelief(threat) > 1 + extraHungerPerTurn(threat)   para todo threat >= 0
```

con la diferencia constante de 3 puntos en toda la rampa. Ese margen es lo que
hace falta para que dos turnos de pesca más tres comidas tapen el gasto, y por
eso `SPEC-threat.md` fija el techo por encima de 190.

### La banda de fallo al reparar

La reparación **no** usa un límite inferior sino un **radio centrado en 5**:
falla cuando `|valor − 5| ≤ radio`. Con radio 0 falla únicamente la tirada 5,
que es el comportamiento heredado de C. Un límite del tipo `valor ≤ r` habría
hecho que la reparación nunca fallara con carga 0, rompiendo la línea base.

Con radio 4 fallan las tiradas 1 a 9 y la única salida segura es el 10.

## Severidad de eventos

| Carga | Efecto adicional |
|---|---|
| `≥ 1` | Tormenta y mapache cuestan además 1 de energía. |
| `≥ 3` | El mapache quita además 1 de salud. |

La tabla de sorteos 1..100 **no cambia**: tormenta 1–10, mapache 51–59,
meteorito 99. Con tiradas extra, cada tirada se aplica en orden sobre el
estado resultante de la anterior, y `GameResolution` expone `randomEvents` como
lista, no como valor único.

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
- Mientras está abierta, los atajos `B D E R P C ?` están desactivados.
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

- **No hay decaimiento pasivo de la salud.** La salud está oculta por diseño, así
  que un desgaste silencioso sería ilegible. El único daño por salud sigue
  siendo un evento que se anuncia.
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
a ser negativo para siempre. Con 3 de hambre por turno, un ciclo completo de
pesca más las tres comidas consumía 5 turnos y 5 de energía y dejaba +3 de
hambre; reponer la energía exigía 2 descansos, que sumaban 2 turnos y +4 de
hambre. Siete turnos y +7 de hambre, y ninguna cantidad extra de comida cerraba
el círculo.

### Consecuencia que se evitó

El calendario sube en los turnos 10, 22, 36, 52, 70, 90, 112, 136, 162 y 190. Con
techo en 50, **los niveles 4 a 10 eran inalcanzables por construcción**: el aviso
a negro se habría visto en los turnos 10, 22 y 36 y después nunca más. Quedaban
sin usar el tramo de la rampa a partir del 40 %, cuatro de los seis
modificadores en su rango alto y la mayor parte del copy de escalada.

### El arreglo aplicado

Opción 1, aprobada por la persona usuaria: **escalar también el alivio de la
ración** a `4 + hambreExtraPorTurno`. Con carga 0 y 1 no cambia nada, así que la
Fase 1 queda intacta; a partir de ahí la ración vuelve a tapar el gasto.

Se descartaron las otras dos opciones por razones que siguen vigentes:

- **Que la comida no empeorara con la carga** contradecía la palanca elegida de
  que buscar se vuelva más difícil, y hacía el juego más indulgente antes.
- **Bajar el tope de hambre extra a 1** dejaba el eje de hambre casi plano y
  obligaba a justificar los avisos de nivel 4 en adelante por las otras cinco
  palancas.

### Medidas después del arreglo

| Medición | Resultado |
|---|---|
| Partida con juego ordenado (recuperar energía hasta pasar el tope del nivel, mantener 2 raciones, gastarlas comiendo) | **Turno 103** en Normal y en Agonía, muriendo de hambre en el nivel 6 con el hambre en 0 justo en cada cambio de nivel. |
| Búsqueda exhaustiva sobre las 7 acciones con el mejor azar posible | Techo absoluto: **turno 191**, con amenaza 10, 400 962 estados alcanzables y el espacio agotado en la iteración 190. |

El techo absoluto pasa de 50 a **191**, y el nivel 10 arranca en el turno 190, así
que **la rampa completa queda dentro del alcance**. El margen sobre el último
umbral es de un turno, lo que significa que en el tramo final la partida se
sostiene con las reservas iniciales y no con un ciclo infinito: a partir de ahí
no hay estrategia sostenible, hay un final.

Un dato que conviene no perder: con juego ordenado el techo práctico es 103, no
191. Llegar a 191 exige acumular energía y comida a la vez durante muchos turnos y
gastarlas después en ráfaga, algo que ninguna regla de umbral fijo reproduce. El
juego, por tanto, sigue siendo duro de verdad: lo que arregló el reequilibrio es
que el tramo escalonado sea **alcanzable**, no que sea **fácil**.

### Cobertura de la regresión

Los tests de `src/game/__tests__/engine.test.ts` que afirmaban el defecto se
invirtieron: ahora exigen que la partida supere el turno 100 en las dos
dificultades, y que el nivel 6 sea alcanzable con juego ordenado. El invariante
aritmético que estaba detrás del defecto está en
`src/game/__tests__/threat.test.ts`:

```text
foodRelief(threat) > 1 + extraHungerPerTurn(threat)   para todo threat >= 0
```

Si alguien vuelve a tapar el alivio de la ración, ese test falla antes de que
alguien diese en el 37.

## Criterios de aceptación

- `threat` llega a 1 exactamente en el turno 10 y a 2 exactamente en el 22.
- Una acción que salta de 9 a 23 entrega nivel 2 y un solo aviso.
- Con `load = 0` el comportamiento es idéntico a la Fase 1, incluida la
  reparación que solo falla con la tirada 5.
- Con carga 10, el hambre por turno es 6 y el tope de energía al descansar es 2.
- `foodRelief` supera al hambre que cuesta el turno en toda la rampa.
- La partida sigue muriéndose solo por hambre, energía o salud.
- El aviso aparece con la partida congelada y desaparece al continuar.
- Los atajos de teclado no actúan mientras el aviso está abierto.
- El motor mantiene 100 % de cobertura.
- **Se puede sobrevivir más de 100 turnos** con juego ordenado, en Normal y en
  Agonía. Cumplido tras el reequilibrio de `D-01`.
- **El techo absoluto con el mejor azar posible alcanza el turno 190**, de modo
  que la rampa de niveles 1 a 10 es alcanzable entera. Medido: 191.
