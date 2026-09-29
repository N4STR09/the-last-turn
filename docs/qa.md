# Registro de QA final

**Fecha:** 25 de septiembre de 2026, revisado el 28 tras el rediseño de acciones, el arreglo de colores y pantalla de muerte, y de nuevo con la tanda de semilla, enlace, parte y rival fantasma, ya en 29 con la autopsia, el «desde el turno» de cada fila, la línea de persecución y el tamaño de la insignia fuera de la pantalla de muerte
**Alcance:** entrega web estática de *The Last Turn Web* con las reglas de la Fase 1 de supervivencia, la Fase 2 de escalada progresiva, el rediseño completo de la interfaz, el rediseño de acciones de la Fase 5 y la tanda de memoria y determinismo

## Estado de este registro

Las tablas de la sección «Comandos automáticos» reflejan el árbol con la tanda de semilla y enlace, y con la limpieza de la pantalla de muerte. Las secciones de navegador real y de aceptación pública se realizaron sobre el build `0.1.0`, publicado antes de la Fase 1, y están etiquetadas como tales; la repetición en navegador con el build actual queda registrada como pendiente porque no hay navegador de escritorio conectado a esta sesión. El rediseño agrava esa limitación: su objeto de entrega es visual, así que ninguna prueba automática dice si la interfaz queda bien. La Fase 5 agrava la limitación en el otro sentido: cambió el motor, y ninguna prueba automática dice si el endless se siente endless. La tanda de semilla la agrava en un tercer sentido: añadió una superficie que solo se puede probar abriendo la página con un enlace en la barra de direcciones, y no hay barra de direcciones que probar. La limpieza de la pantalla de muerte la agrava en un cuarto, y es el más fino: quitar texto de una pantalla es fácil de comprobar en el árbol y difícil de comprobar en la vista, porque lo que hay que ver es que no falta.

## Comandos automáticos

| Comprobación | Resultado |
|---|---|
| `npm ci` | Pasa; instalación reproducible sin vulnerabilidades reportadas |
| `npm run typecheck` | Pasa |
| `npm run lint` | Pasa sin warnings |
| `npm run test:coverage` | Pasa; 27 archivos y 449 pruebas; cobertura global 98.37% statements, 96.9% branches, 100% functions, 98.34% lines |
| `npm run test:coverage:scoped` | Pasa; aplica los umbrales de `src/app`, `src/ui` y `src/game` dentro de `verify` |
| `npm run test:coverage -- src\app` | Pasa; cobertura de `src/app` 97.31% statements, 95.25% branches, 100% functions, 97.25% lines (163 pruebas) |
| `npm run test:coverage -- src\game` | Pasa; cobertura de `src/game` 100% en las cuatro métricas (183 pruebas) |
| `npm run test:coverage -- src\ui` | Pasa; cobertura de `src/ui` 100% en las cuatro métricas (87 pruebas) |
| `npm run verify` | Pasa; typecheck, lint, cobertura global, cobertura por capacidad, build, presupuestos y barrido de residuos |
| `npm run build` | Pasa; bundle estático dentro de presupuesto |
| `npm run check:budget` | Pasa; 78.48 KiB JS gzip (39,2 % de 200 KiB) y 4.29 KiB CSS gzip (8,6 % de 50 KiB) |
| `node scripts/residue-sweep.mjs` | Pasa; sin CJK, sin cirílico y sin `U+FFFD` en `src/`, `scripts/`, `docs/` y `dist/` |
| `npm audit` | 0 vulnerabilidades |

La puerta mide con gzip nivel 9 sobre `dist/assets/` e informa de 78.48 KiB de JavaScript y 4.29 KiB de CSS, mientras que Vite imprime otros valores para los mismos archivos. La diferencia es esperable y está explicada en `scripts/check-budget.mjs`: ambos ajustan gzip de forma distinta y la puerta aplica siempre su propia medición.

Las puertas se comprobaron además en su sentido de fallo, porque una comprobación que solo pasa no demuestra que bloquee:

| Puerta | Escenario provocado | Resultado |
|---|---|---|
| `test:coverage:scoped` | Una función sin cubrir en `src/game` | Falla con `exit=1`; la cobertura de funciones baja del umbral de 100 % |
| `test:coverage:scoped` | Ámbito mal escrito `src/ap` | Falla con `exit=1` y lista los ámbitos admitidos, en vez de degradar a los umbrales globales |
| `check:budget` | JavaScript de 250 KiB | Falla con `exit=1` nombrando el recurso y el límite superado |
| `check:budget` | `dist/` ausente | Falla con `exit=1` con un mensaje accionable |
| `check:budget` | `dist/assets/` sin `.js` ni `.css` | Falla con `exit=1` en vez de aprobar un presupuesto de 0 bytes |
| `check:residues` | Un `.md` de prueba con un ideograma | Falla con `exit=1` y señala `docs/…md:2 [CJK] U+540C — …` |

En todos los casos se restauró el estado y se volvió a comprobar que la puerta pasa con el árbol real.

## Defecto detectado en QA: `D-01`, ya resuelto

**Todas las cifras de esta sección son de la Fase 2 y están superadas.** Se
conservan enteras porque el diagnóstico sigue siendo válido —el de Fase 5
confirmó que el problema de fondo era aritmético, no de recursos— y porque
alteró el criterio de aceptación de supervivencia indefinida. La verificación
de la Fase 2 encontró un defecto de diseño, no de implementación.

### Lo que se encontró

| Medición | Resultado antes del arreglo |
|---|---|
| Ruta renewable ingenua (reparar, luego `buscar`, `comer`, `descansar` en bucle, con azar determinista favorable) | Muere por hambre en el **turno 37**, en el nivel 3. Idéntico en Normal y Agonía. |
| Búsqueda exhaustiva sobre las 7 acciones con el **mejor azar posible** en cada tirada, deduplicando estados hasta agotar el espacio alcanzable | **8016 estados distintos**, espacio agotado en la iteración 49. Techo absoluto: **turno 50**, en el nivel 3, con hambre 9, energía 3, comida 0 y refugio. |

La segunda cifra es un **máximo**, no un promedio: no es que la estrategia fuera mala, es que no existía ninguna. La medición se hizo con el mejor resultado posible en cada tirada (buscar y explorar acertan, la pesca acierta al primer intento, el descanso devuelve el tope, los eventos sacan meteorito). Un jugador real moría mucho antes.

### Causa

Pescar da 3 raciones en 2 turnos si acierta a la primera, es decir 1,5 por turno, la mejor tasa del juego; buscar da 1 por turno. Esa ventaja es lo único que sostenía el bucle. En cuanto el hambre por turno llegaba a 3 (carga 4, turno 52) se consumía y el balance pasaba a ser negativo para siempre. Con 3 de hambre por turno, un ciclo completo de pesca más las tres comidas consumía 5 turnos y 5 de energía y dejaba +3 de hambre; reponer la energía exigía 2 descansos, que suman 2 turnos y +4 de hambre. Siete turnos y +7 de hambre, y ninguna cantidad extra de comida cerraba el círculo.

El agravante era que la ración quitaba **4 fijos** mientras el hambre del turno subía hasta 6. Cada ración era cada vez una peor inversión.

### Consecuencia que se habría publicado

El calendario sube en los turnos 10, 22, 36, 52, 70, 90, 112, 136, 162 y 190. Con techo en 50, **los niveles 4 a 10 eran inalcanzables por construcción**: el aviso a negro se habría visto en los turnos 10, 22 y 36 y después nunca más. Quedaban sin usar el tramo de la rampa a partir del 40 %, cuatro de los seis modificadores en su rango alto y la mayor parte del copy de escalada.

### Decisión tomada

Se preguntó a la persona usuaria y se aplicó la **opción 1**, la recomendada: escalar también el alivio de la ración a `4 + hambreExtraPorTurno`. Con carga 0 y 1 no cambia nada, así que la Fase 1 queda intacta.

Se descartaron las otras dos: que la comida no empeorara con la carga contradecía la palanca elegida de que buscar se vuelva más difícil, y bajar el tope de hambre extra a 1 dejaba el eje de hambre casi plano.

### Mediciones después del arreglo

| Medición | Resultado |
|---|---|
| Partida con juego ordenado (recuperar energía hasta pasar el tope del nivel, mantener 2 raciones, gastarlas comiendo) | **Turno 103** en Normal y en Agonía, muriendo de hambre en el nivel 6 con el hambre en 0 justo en cada cambio de nivel. |
| Búsqueda exhaustiva sobre las 7 acciones con el mejor azar posible | Techo absoluto: **turno 191**, con amenaza 10, **400 962 estados** alcanzables y el espacio agotado en la iteración 190. |

El techo absoluto pasa de 50 a 191 y el nivel 10 arranca en el turno 190, así que la rampa completa queda dentro del alcance. El techo práctico con juego ordenado es 103, no 191: llegar hasta 191 exige acumular energía y comida a la vez durante muchos turnos y gastarlas después en ráfaga, algo que ninguna regla de umbral fijo reproduce. El reequilibrio hizo que el tramo escalonado sea alcanzable, no fácil.

Las dos búsquedas dicen «7 acciones» porque se midieron cuando Ayuda todavía existía. En la Fase 4 el espacio se reduce a 6 acciones, así que los 400 962 estados y el techo de 191 son **cotas superiores**, no las cifras de hoy. No se han vuelto a medir: quitar Ayuda no cambia ninguna regla de gasto, y la escalated no depende de cuántas acciones haya.

### Cobertura de la regresión

Los dos tests que afirmaban el defecto se invirtieron. Ahora `src/game/__tests__/engine.test.ts` exige superar el turno 100 en las dos dificultades y alcanzar el nivel 6, y `src/game/__tests__/threat.test.ts` fija el invariante aritmético que estaba detrás del defecto:

```text
foodRelief(threat) > 1 + extraHungerPerTurn(threat)   para todo threat >= 0
```

Volver a tapar el alivio de la ración rompe ese test antes de que alguien vuelva a morir en el 37.

### Pendiente tras el arreglo

Ninguno en diseño: el defecto está cerrado y medido. Queda pendiente la verificación en navegador real y la autorización de publicación, ambas en la sección final de este registro.

## Diagnóstico de la Fase 5: dos fracturas, medidas antes de tocar nada

La revisión de las acciones se hizo al revés que la Fase 2. Antes de cambiar
una fórmula se construyó un modelo mutable del motor y se midió sobre 400
semillas, en vez de razonar sobre el diseño. Salieron tres hallazgos, y solo
uno era el que se sospechaba.

| Hallazgo | Medición | Qué era en realidad |
|---|---|---|
| Agonía es insensible a todo reequilibrio | Mediana 27 con las tres palancas de la Fase 2 probadas sobre el mismo piloto; se movió **un turno como mucho**. Causa de muerte: **energía** | Una fractura estructural, no un desequilibrio de recursos |
| La partida no es renewable | Techo absoluto **97** con el mejor azar posible, por debajo del nivel 6 que empieza en el turno 90 | Aritmética: el hambre por turno y el alivio de la ración crecían al mismo ritmo |
| Explorar tenía una opción mala | A carga 6, el hallazgo grande daba 4 comidas por 4 de salud y el pequeño 2 por 1 | El premio grande salía peor por punto de salud que el premio pequeño |

El tercero es el que mejor resume por qué conviene medir. Nadie lo habría
detectado leyendo la tabla: los dos resultados son «buenos» en valor absoluto.
Lo que no lo era era la comparación, y comparar es lo que hace el jugador.

## Defecto `D-02`: la fractura de Agonía

**Estado: resuelto.** Cuatro cosas encadenaban, y por eso no se arreglaba con
números.

1. Con carga alta, Agonía hace tres tiradas de evento por turno.
2. Tormenta y mapache cobraban 1 de energía **uno por evento**, así que el peor
   turno costaba 3.
3. Descansar con refugio devolvía como mucho 2, y con el suelo antiguo 1.
4. La tormenta tiraba el refugio, y sin refugio descansar devolvía 0: el
   descanso **dejaba de funcionar** en el mismo turno en que la tormenta lo
   rompía.

La energía caía sola, sin que hubiera turno en el que el jugador pudiera
decidir. Qué se cambió: el recargo se cobra una vez por turno propagando la
marca entre tiradas, descansar sin refugio devuelve 1 (lo que cuesta el turno),
el mapache saquea una cantidad fija en vez de vaciar el depósito, y reparar no
hiere. El peor turno de Agonía pasa a costar 1 de energía en lugar de 3.

## Defecto `D-03`: la partida no era renewable por construcción

**Estado: resuelto con la válvula de escape.** Con
`extra = min(6, ⌊load/2⌋)`, el hambre por turno y el alivio de la ración
crecían al mismo ritmo, así que la holgura por ración era una constante de 3
puntos. Sumado a la opción mala de explorar, el techo absoluto se quedaba en el
turno 97, muy por debajo del nivel 6 que empieza en el 90. **Ninguna combinación
de los otros tres modificadores lo subía.**

Los cuatro cambios de la válvula: `extraHungerPerTurn` a `min(4, ⌊load/3⌋)`,
`foodRelief` a `4 + 2·extra`, `restEnergyCap` a `max(3, 5 − ⌊load/4⌋)` y
`cureAmount` a `max(2, exploreWound)`.

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

**Estas cifras son de su fecha.** Se midieron con las siete acciones anteriores al
rediseño y con la tormenta al 10 %. El techo vigente del juego de hoy es 152, con
mediana 119 en Normal y 38 en Agonía, y se mide en el bloque siguiente. Cuando las
dos cifras conviven en el documento, la que describe el juego de hoy es 152.

El máximo (172) por encima del techo con mejor azar (153) no es una
contradicción y conviene no perderlo: el «mejor azar posible» fuerza el hallazgo
grande en cada exploración, y el hallazgo grande cuesta entre 2 y 5 de salud. Una
partida que juega normal y tiene suerte de vez en cuando vive más que una que
acierta el premio grande todas las veces. Es exactamente lo que persigue la
paridad entre `cureAmount` y `exploreWound`.

Un dato incómodo queda cerrado, y el cierre cambia el diagnóstico. **Agonía ya
no es cuatro veces más corta que Normal**: la tormenta bajó del 10 % al 4 % y la
mediana de Agonía pasó de 29 a 38, con reparto L1 11.5 % / L2 27.0 % / L3 49.8 % /
L4 11.8 % y 1.24 tormentas por partida en vez de 2.42. La mediana de Normal no se
mueve: 119, con techo 152.
Lo que la medición dejó claro es que Agonía no es «más corta» sino **más
variable**. El techo de las dos dificultades es el mismo, 152. Apagando los
eventos, Agonía da 121 y Normal 119: el hueco entero son los eventos, no la
aritmética de la escalada. Y el motivo está medido en el orden de resolución: el
52 % de las partidas de Agonía morían en los tres turnos siguientes a una tormenta,
y 181 de 201 muertes por energía tenían una tormenta en los seis turnos previos. El
evento caía sobre un turno que el jugador ya había decidido y ya había pagado.
Por eso el arreglo es de orden y no de números: el azar se adelanta una tirada, se
guarda en `GameCoreState.pendingEvents` y se aplica al turno siguiente, de modo que
el pronóstico avisa antes de que la persona elija.
Queda un problema abierto y declarado: **L9 y L10 no son alcanzables**, y no por
falta de suerte. El mejor azar posible muere en el turno 152, el umbral de L9 está
en el 162 y el de L10 en el 190. L1, L5 y L7 no cambian ningún modificador, y
rellenarlos se midió entero —desgaste del refugio y comida estropeada en las cargas
5 a 8, con periodos de 6 a 30 turnos, más acaparamiento, curar más caro, reparar
más caro y hallazgos secos— y se descartó: toda regla que aguanta la partida baja
el techo, y el techo es justamente lo que dejaría L9 dentro de alcance. La
explicación de las mesetas es aritmética, no una omisión: la carga es el propio
nivel y todos los modificadores son `⌊load / k⌋`, así que dividir enteros las
produce. Está en `SPEC-threat.md` como `D-05`, con la tabla completa de lo medido.
Atacar L9 exigiría bajar `threshold(n)`, que es una decisión de alcance.

### Cobertura de la regresión

- `src/game/__tests__/threat.test.ts` fija las nueve rampas completas con tablas
  calculadas con aritmética antes de escribir los asserts, el invariante
  `foodRelief > hungerPerTurn` y la paridad `cureAmount === exploreWound`.
- `src/game/__tests__/engine.test.ts` lleva el piloto `competentAction` con el
  `bestLuck` de cada dado y exige superar el turno 100 en las dos dificultades.
- `src/game/__tests__/pipeline.test.ts` fija el recargo único de energía y el
  saqueo parcial: con carga 10, tres tiradas de evento y una sola marca.
- `src/game/__tests__/actions.test.ts` cubre que comer no cura y que curar no
  tira dados, que es la paridad de recursos que hace que valgan la pena.

## Navegador real (build 0.1.0, anterior a la Fase 1)

Se comprobó el build servido por `vite preview` en `127.0.0.1` con un perfil aislado de Edge y CDP. El flujo recorrido fue:

`Inicio → Dificultad → Normal → Descansar → Ayuda → recarga → Agonía → muerte → reinicio`.

Resultados observados:

- Pantallas y encabezados correctos; el foco programático queda en el `h1` enfocable al cambiar de pantalla.
- El atajo `?` ejecutó Ayuda; `Tab` alcanzó el botón de Inicio sin perder el orden de foco.
- Anchos comprobados: 320, 360, 768 y 1440 px. No hubo elementos fuera del viewport ni scroll horizontal estable.
- Todos los botones midieron al menos 44 × 44 px.
- `prefers-reduced-motion: reduce` coincidió y la hoja de estilos elimina transiciones y animaciones no esenciales.
- La salud no apareció en el texto de la partida. **Esta línea describe el build 0.1.0 y ya no es un requisito:** la Fase 5 invirtió esa regla a propósito, y la salud es ahora la primera cifra. Se conserva como registro del árbol anterior.
- Consola: 0 mensajes y 0 errores.
- Red en este recorrido completo: 28 peticiones, todas al origen local; 0 peticiones a terceros.
- El favicon se carga como recurso local, por lo que no se produce la solicitud 404 implícita de `favicon.ico`.

## Comprobación adicional del artefacto web (build 0.1.0)

Se volvió a servir el build de producción con `vite preview` en `127.0.0.1:4175` y se inspeccionó con Edge/CDP:

- `dist/index.html` referencia `./assets/...` y `./favicon.svg`; los cuatro recursos cargaron con estado 200.
- El borde computado de `.button--quiet` fue `rgb(98, 117, 104)` y obtuvo una relación de contraste calculada de 3.49:1 frente a la superficie base.
- Los tamaños de ventana 320, 360, 768 y 1440 px no produjeron elementos fuera del viewport; el botón más pequeño medió al menos 134.25 × 76 px.
- Consola y excepciones: 0; en esta carga inicial fueron 4 peticiones (documento, CSS, JS y favicon), todas al mismo origen y ninguna a terceros.
- Los bordes de las tarjetas informativas que no son controles permanecen sutiles; la legibilidad y la estructura los identifican sin depender del color, mientras que los bordes de controles mantienen el contraste de 3:1.

## Auditoría de contraste WCAG 1.4.3 (build 0.1.0)

Se recorrieron las cuatro pantallas en `1440 × 1000` y se midió cada nodo de texto contra el fondo efectivo, compositando la cadena de ancestros hasta el primer fondo opaco. El umbral aplicado fue 4.5:1 para texto normal y 3:1 para texto grande (>= 24 px, o >= 18.66 px en negrita).

| Pantalla | Nodos de texto | Fallos |
|---|---:|---:|
| Inicio | 5 | 0 |
| Dificultad | 12 | 0 |
| Partida | 39 | 0 |
| Fin de partida | 8 | 0 |
| **Total** | **64** | **0** |

La muerte se alcanzó de forma real en Agonía por inanición tras 10 turnos: la pantalla final mostró `h1` «La partida ha terminado», el aviso de causa, «Dificultad Agonía / Supervivencia 10 turnos aguantados», el foco en `game-over-title` y un único botón «Volver a jugar», que devolvió a `screen--difficulty` sin conservar la partida. Consola y excepciones: 0.

## Comprobación en subdirectorio (build 0.1.0)

El build se copió a un host estático estricto, sin fallback de SPA, y se sirvió en `http://127.0.0.1:4180/juego/`:

- `./favicon.svg` y `./assets/...` resolvieron a `/juego/favicon.svg` y `/juego/assets/...`, con estado 200.
- La aplicación montó, mostró `h1` «The Last Turn» y el botón «Comenzar»; al pulsarlo pasó a «Elige dificultad», lo que confirma que React es interactivo bajo subdirectorio.
- 0 peticiones a terceros, 0 errores de consola, 0 excepciones.

Esto confirma que `base: './'` funciona tanto en la raíz de un dominio como en un subdirectorio, que es el motivo de esa configuración.

## Rediseño de interfaz

Un rediseño visual no se puede cerrar con pruebas. Lo que sí se ha hecho es
sustituir cada suposición por una medición, y dejar por escrito lo que queda sin
comprobar.

### Contraste

Medido con la fórmula de WCAG 2.x, no estimado. Fondo de página `#050706`, panel
de terminal `#0a0e0d`, aviso de escalada sobre negro puro.

| Uso | Color | Sobre | Ratio | Resultado |
|---|---|---|---|---|
| Texto normal | `#b9c4bd` | `#050706` | 11.25:1 | AAA |
| Texto apagado | `#93a09a` | `#050706` | 7.44:1 | AAA |
| Pista y etiquetas | `#7a7a7a` | `#050706` | 4.71:1 | AA |
| Pista y etiquetas | `#7a7a7a` | `#0a0e0d` | 4.52:1 | AA |
| Luz del banner | `#ffffff` | `#050706` | 20.20:1 | AAA |
| Luz del banner | `#ffffff` | `#0a0e0d` | 19.42:1 | AAA |
| Hambre | `#ff5f4d` | `#050706` | 6.73:1 | AA |
| Energía | `#ffd166` | `#050706` | 14.01:1 | AAA |
| Comida | `#7ee08a` | `#050706` | 12.43:1 | AAA |
| Refugio | `#5ec8f5` | `#050706` | 10.64:1 | AAA |
| Aviso de escalada | `#8b0000` | `#000000` | 2.10:1 | **No cumple**, `W-05` ya documentado |

`#7a7a7a` queda por debajo de AAA en las dos superficies. Se acepta porque son
pistas y etiquetas, no el texto que sostiene la partida, y porque subirlas a
`#93a09a` haría que el minimalismo se convirtiera en ruido. El valor va
deliberadamente justo para no perder margen con el realce de la calavera detrás.

### Geometría de la calavera

El modelo no puede mirar una imagen, así que la calavera se rasterizó con `sharp`
y se comprobó de forma numérica sobre los píxeles. Eso no dice si queda guapa, y
por eso se registra como lo que es.

| Medida | Normal | Agonía |
|---|---|---|
| Asimetría horizontal | 0.00 % | 0.00 % |
| Dentro del lienzo | Sí | Sí |
| Caja (ancho × alto) | 283 × 297 px | 283 × 306 px |

La asimetría a cero descarta trazados invertidos y desajustes entre la mitad
izquierda y la derecha. Los 9 px de diferencia en Agonía son los cuernos, que
asoman por encima del cráneo. La silueta mide algo más de alto que de ancho, que
es la proporción de una calavera vista de frente.

### Lo que no se ha comprobado

- **El aspecto visual.** Nadie ha visto la pantalla. Las medidas confirman que
  las formas son correctas, no que la interfaz sea fea.
- El brillo por `text-shadow` sobre cada combinación de fondo real, con la
  calavera detrás del texto.
- Que la calavera se lea como «inquietante pero sin dar mucho miedo» y que los
  cuernos en Agonía se entiendan sin scary.
- La legibilidad de las barras con 12 bloques a 320 px.
- El ritmo del parpadeo crítico en pantalla real, y que no moleste al jugar.
- Anchos 320, 360, 768 y 1440 px, y `prefers-reduced-motion`.

Todo eso necesita navegador de escritorio, que sigue sin estar conectado.

### Defectos detectados en este rediseño

Tres cosas que aparecieron al implementar y que se corrigieron:

1. **Las etiquetas del banner salían de CSS.** `Ronda` y `Nivel` se generaban con
   `content: attr(data-label)`, que no entra en el árbol de accesibilidad. Un
   lector de pantalla habría anunciado «3 1» sin decir qué es cada número. Ahora
   son elementos de verdad.
2. **El copy de dificultad sobrevivió a la Fase 2.** Seguía describiendo «los
   hitos de los turnos 15 y 30», que la escalada progresiva había eliminado. La
   comprobación del bundle no la pilló porque buscaba «quince turnos» en palabras
   y el texto usaba cifras.
3. **El CHANGELOG declaraba 23 mensajes de escalada y hay 12.** La prueba
   existente comprobaba que los primeros doce fueran distintos, lo que no ata la
   cifra al código. Se añadió una prueba del periodo del ciclo.

Ninguno era visible desde las pruebas, y los tres eran del tipo que se acumula
en silencio.

## Rendirse, refugio y copy (Fase 4)

Cinco correcciones sobre el rediseño. Dos borran algo del motor, una reorganiza
la lectura del refugio y una es una errata. Ninguna cambia una regla de juego, y
eso no significa que no fueran verificables: se comprueban igual.

### Qué cubren las pruebas

| Pieza | Qué demuestra |
|---|---|
| `src/game/__tests__/pipeline.test.ts` | `surrenderGame` termina la partida, declara `'surrender'` en `condition` y en `reportedCause`, conserva `turnsSurvived` y no toca ningún recurso ni el nivel. Que no tire azar no se comprueba con una fuente que falle: `surrenderGame` no recibe `RandomInt`, así que la firma es la prueba. |
| `src/app/__tests__/app-state.test.ts` | Los tres comandos de rendirse y sus tres guardas. Con el aviso abierto, fuera de la partida viva o sin confirmación puesta, el reducer devuelve el estado **idéntico** (`toBe`), no una copia. |
| `src/ui/__tests__/surrender-control.test.tsx` | Apertura, foco en el diálogo, trampa de tabulador en los cuatro sentidos incluido el foco en el propio diálogo, Escape, click fuera que no hace nada, foco devuelto al botón al cancelar, y Enter ignorado. |
| `src/app/__tests__/use-game-session.test.tsx` | La partida queda congelada y sin atajos con la confirmación puesta, y los atajos vuelven a funcionar al cancelar en cuanto el foco sale del botón. |
| `src/App.test.tsx` | El flujo entero: pedir, arrepentirse, volver a pedir, confirmar, y que la pantalla final enfoque su encabezado. |
| `src/ui/__tests__/game-screen.test.tsx` | Cuatro filas de cifras con la salud entre ellas, la barra de salud con diez bloques y no con doce, el refugio fuera de la lista, su bloque encendido solo cuando hay techo, y las cinco acciones más la salida. La geometría de la fila del refugio se fija aquí: comparte rejilla con las cifras y se cuadra con ellas. |
| `src/ui/__tests__/game-over.test.tsx` | El mensaje de la rendición, y que sobre el `Game Over` no quede rótulo ni en una muerte ni en una rendición. |
| `src/ui/__tests__/screens.test.tsx` | «Sobrevive» y no «Overvive», y que las tarjetas no rotulen un modo que no distingue nada. |

### Dos ramas muertas que las pruebas encontraron

Escribir las pruebas del 100 % no es trámite: salió código que no se podía probar.

1. **La guarda de lista vacía de la trampa de foco** (`if (first === undefined
   || last === undefined) return;`) no puede ser falsa mientras el diálogo lleve
   sus dos botones, así que era código muerto. Se quitó. Y con ella se cayó el
   `?? []` que la sostenía, que v8 sí cuenta como rama. Ahora el manejador busca
   los botones con `event.currentTarget` en lugar de un ref, y enfoca con `?.`.
   Si la lista viniera vacía, el foco no sería ningún extremo, el tabulador
   saldría del diálogo y Escape seguiría funcionando: perder el foco es un fallo
   recuperable, atraparlo en un diálogo sin salida no.
2. **`actionLabels` era un array de tuplas** con una rama `label === undefined ?
   action : label[1]` que quedaba muerta desde que las etiquetas se movieron a
   la aplicación. Pasó a ser `Record<GameAction, string>` con `gridActions`
   ordenado, y la rama desapareció.

### Un cambio de muerte que las pruebas obligaron a corregir

Al sustituir Ayuda por `Descansar` en los fixtures, dos pruebas de muerte
empezaron a fallar, y no por un error del código: la causa comunicada había
cambiado. Antes, Ayuda no costaba hambre ni energía, así que diez turnos de
meteorito dejaban salud en 0 con el hambre intacta y la causa era `health`. Ahora
Descansar gasta un punto de cada cosa por turno, así que al décimo turno el
hambre llega a 10 y a la vez, y el motor dice `hunger` porque es el número que el
jugador llevaba viendo subir toda la partida. El umbral 1 de escalada cae
también en el turno 10, así que el noveno descanso es el último antes del aviso.

Ambas pruebas se actualizaron al hecho y lo dicen en un comentario. Merece la
pena dejarlo escrito porque «la prueba estaba mal» y «la prueba-documenta-el-cambio»
son cosas distintas, y aquí era lo segundo.

### Lo que sigue sin comprobarse

- **El título gótico.** Que la pila `--font-title` caiga en «Old English Text MT»
  o en Blackadder ITC está verificado en la máquina del usuario (261 familias
  instaladas, ambas presentes), pero que el resultado se vea bien en pantalla no.
- **El centrado de la pantalla de dificultad.** Que la cabecera mida lo mismo en
  los cuatro breakpoints y que la nota de reglas se lea como párrafo, no como
  banda.
- **La línea de refugio.** Que «Destruido» en su sitio sea más legible que
  «Ausente» dentro de la lista.
- **El diálogo de rendirse.** Que el overlay oscurezca como debe, que el texto de
  la derrota jocosa aterrice y que la fila completa en color sangre no compita
  con las cinco acciones.
- El aspecto visual en general, que sigue necesitando navegador de escritorio.

## Rediseño de acciones (Fase 5)

La sección más larga de este registro, porque esta fase sí cambió reglas y
todas se obtuvieron midiendo. El análisis completo está en la sección de
diagnóstico de más arriba y en `SPEC-threat.md`; aquí queda lo que la QA añade.

### Cómo se midió, y por qué importa

El modelo de medición fue un duplicado mutable del motor real en TypeScript, no
una simulación aparte. Se validó contra el motor de producción reproducciendo
partidas turno a turno con las mismas semillas antes de usar un solo número: si
el modelo y el motor no coinciden, cualquier cifra que salga de él es ficción.
Una vez validado, se pudieron probar miles de partidas en minutos, lo que hizo
posible la pregunta que decide el diseño: *¿con el mejor azar posible, cuál es el
turno más alto al que se puede llegar?*

Esa pregunta es la que separa «difícil» de «imposible». Una estrategia que llega
al turno 97 con el mejor azar posible no es una estrategia buena: es la mejor, y
si no pasa de 97 el diseño no tiene ruta.

### Cuatro errores que se colaron al escribir los asserts

Todos del mismo tipo, y todos se habrían evitado con una operación antes del
`expect`. Se dejan escritos porque el patrón es lo que hay que evitar:

1. El hallazgo grande a carga 10 sale solo con la tirada 1, no con la tirada 2.
2. La reparación a carga 7 suma 6 de hambre —dos turnos por 3 de hambre por
   turno— y el test asumía otra cifra.
3. `rest` con techo deja la energía final en 1, no en 2: el tope se recorta
   *después* de la tirada, no antes.
4. El umbral del nivel 2 es el turno 22, no el 20.

El cuarto es el más representativo: escribir un test de memoria sobre una tabla
que ya se había calculado. La tabla de umbrales es `n² + 9n`, así que el nivel 2
cae en `4 + 18 = 22`.

### Lo que ya no existe y hay que decir en voz alta

| Antes | Ahora |
|---|---|
| Siete acciones, incluidas Ayuda, buscar comida y pescar | Cinco acciones |
| `B D E R P C` y `?` como atajos | `E C S D R`; `B` y `P` sin mapeo |
| El botón de pescar decía «hasta +6 hambre, −6 energía» | Ningún botón dice «hasta» |
| La salud no se mostraba | Cuarta cifra, con barra propia de diez bloques |
| Comer curaba 1 de salud | Comer no cura; `cure` es la única vía |
| Reparar duraba de 2 a 5 turnos según la carga | Dos turnos fijos |
| Sin acción de curación | `Curarse`: 2 comidas, sin tirada |

La comprobación automática que ata el bundle a estas cifras es más débil que
quien las lee. `grep` sobre el artefacto encuentra las cadenas, pero no verifica
que no queden restos: los restos de la Fase 2 se detectaron porque la
comprobación buscaba «quince turnos» en palabras y el texto usaba cifras. La
búsqueda de residuos sobre `dist/` es manual y queda pendiente de hacerla tras
el despliegue.

### Lo que sigue sin comprobarse tras la Fase 5

- **En navegador de escritorio**, todo lo visual: la nueva fila de salud, el
  cuarto bloque de la rejilla, el nuevo copy de la terminal, y que la fila del
  refugio siga cuadrada con cuatro filas en lugar de tres.
- **La sensación de endless.** Que 118 de mediana y 172 de máximo produzcan la
  tensión buscada no lo dice ninguna prueba. Un número alto puede sentirse como
  una lista larga de lo mismo.
- **Que Agonía siga siendo un modo y no un muro.** El techo medido ya no la
  distingue: 152 en las dos dificultades, con medianas de 119 y 38. Lo que queda
  por ver en navegador es si la telegrafía convierte la tormenta en una decisión en
  vez de en una lotería, que es justo lo que se cambió para lograrlo.
- **Que el pronóstico se lea bien con lector de pantalla.** Vive fuera de
  `.terminal__screen` y lleva su propio `role="status"`, precisamente para no
  releer el parte. Eso está pensado y probado, pero no está verificado en un
  lector real.
- **La inspección de residuos en `dist/`** tras el despliegue, sobre todo que no
  queden cadenas de `forage`, `fish` ni los textos de los hitos.

## Colores y pantalla de muerte

Dos arreglos de interfaz sobre el mismo defecto de fondo: la interfaz tomaba el
color de un recurso para cosas que no son un recurso.

### El violeta que se comió media interfaz

Cuando el hambre pasó de rojo a violeta en `93d4176`, tres elementos que
referenciaban `var(--stat-hunger)` se volvieron violetas sin que nadie lo pidiera.
Los tres lo hacían por la misma razón equivocada: era el único rojo de la paleta
que no era `--color-alarm`, y eso bastaba para tomarlo.

| Elemento | Toma el color de | Por qué |
|---|---|---|
| `.action-button--surrender` | `--color-alarm` | Tiraba la partida, y su propio comentario decía que por eso iba en rojo y no en blanco. |
| `.terminal__deltas li[data-tone='warning']` | `--color-alarm` | Un cambio de recurso que avisa es peligro, y el peligro en esta interfaz es un color solo. |
| `.terminal__forecast-head` y su marca | `--color-alarm` | Avisa de una tormenta sobre el refugio. En violeta se leía como un aviso del hambre, que no es lo que va a caer. |

También `.stat` —la fila base, sin modificador— tomaba `--stat-hunger`. No se ve
nunca, porque cada fila lleva su `stat--*`, pero quedaba como un `--stat-hunger`
sin dueño. Ahora es `--color-text`.

**Cómo se evita que vuelva.** Los cinco `--stat-*` quedan declarados en
`tokens.css` y en `SPEC-web-interface.md` como de un recurso y solo de un recurso,
con el ejemplo concreto de estos tres. La fila base de un recurso no puede llevar
el tono de otro.

Verificado sobre el CSS compilado de `dist/`: `.stat--hunger` conserva
`var(--stat-hunger)` y es la única declaración del fichero que lo usa; las tres
anteriores emiten `var(--color-alarm)`.

### La pantalla de muerte

Rehecha a negro de punta a punta, sin la tarjeta con borde y fondo, y centrada
como la del inicio. Encima el rótulo de siempre, `Game Over` en rojo de alarma
con el halo en rojo sangre, debajo el mensaje jocoso de la causa en blanco puro y
sin recuadro, y debajo los datos de la partida en monoespaciada y centrados. Se
conservan el `role="alert"` de la causa, el `tabIndex={-1}` del `h1` y los
mensajes de `causeMessages`, que las pruebas ya fijaban.

El título va en `--color-alarm` y no en `--color-blood` por contraste y no por
gusto: sobre negro puro el rojo de alarma da 7.0:1 y el de sangre 2.02:1, y un
título grande necesita 3:1. En sangre el texto se leería por el halo y no por las
letras. El halo sí es sangre, porque el halo es luz y no forma.

Cambian cuatro `expect` de nombre de encabezado: dos en `src/App.test.tsx`, uno en
`src/ui/__tests__/game-over.test.tsx` y uno en
`src/app/__tests__/use-game-session.test.tsx`. 351 pruebas en verde, `src/game` y
`src/ui` al 100 %.

### Lo que sigue sin comprobarse

- **En navegador, los dos arreglos.** Que el negro cubra la pantalla entera y no
  deje los bordes del fondo de página, que la composición centrada no se descentre
  en móvil, y sobre todo que el `Game Over` rojo se lea como una lápida y no como
  un error de estilo. Ninguna prueba automática dice nada de eso: los cuatro
  `expect` que han cambiado comprueban el nombre accesible del encabezado, y el
  color no entra en el árbol de accesibilidad.
- **Que el violeta no se haya colado en ningún otro sitio.** El barrido fue sobre
  `src/`, y sobre `dist/` solo se miraron las tres reglas concretas. Un barrido de
  color sobre el bundle completo, no solo de `--stat-hunger`, sigue pendiente.

## Semilla, enlace, parte y rival fantasma

La tanda que da memoria a la partida y expone el determinismo del motor. Cinco de
los seis puntos pedidos; el sexto, el mapa acumulativo, sigue sin empezar y se
declara abajo con el motivo.

### Lo que se añadió, y por qué cada cosa existe

| Pieza | Por qué existe, en una línea |
|---|---|
| `?seed=X` | Abre una partida con ese azar concreto, para volver a una situación determinada sin escribir un historial. |
| `?seed=X&d=n&a=ece` | Reconstruye la partida entera turno a turno y enseña su pantalla de muerte tal cual. |
| Estado final en cifras | Los cinco recursos tal cual quedaron, con la misma lectura que en partida. Es lo que explica la muerte. |
| Parte de acciones | Lo que se hizo y lo que no se hizo. Lo segundo es lo que no se ve jugando. |
| Turno del último estreno | El punto desde el que dejó de enseñar algo nuevo. Se rotula con esas palabras y no como «cambio de estrategia», que el dato no sostiene. |
| Rival fantasma | Da una escala a «llegar lejos» sin persistir nada. |
| Compartir la muerte | Convierte una partida en algo que se puede pasar. |
| Nuevo récord | Dice que esa partida fue tu mejor, que es lo único que se puede superar aquí. Va en la pantalla de muerte y no durante la partida, porque el rival fantasma ya lo dice en vivo. |

### Decisiones que se tomaron midiendo o por criterio, no por gusto

- **El turno de muerte y los turnos aguantados son el mismo número.** El motor
  avanza el contador al consumir el turno, así que el último turno jugado es
  exactamente el que acabó con la partida. Un segundo campo habría sido un número
  que dice lo mismo con otro nombre.
- **La reproducción ocurre al arrancar, no en un efecto.** La primera versión
  repetía en un `useEffect` y ESLint lo marcó: `Calling setState synchronously
  within an effect can trigger cascading renders`. No era un aviso de estilo sino
  el síntoma de tres cambios de estado seguidos para llegar a la pantalla de
  muerte. Movido al inicializador perezoso, el error desaparece y con él el
  parpadeo de la pantalla de inicio, que era el defecto visible.
- **La barra de direcciones no se toca al morir.** Escribir el enlace de la
  partida muerta en la URL haría que recargar la reventara en vez de empezar
  otra. `buildShareUrl` es puro y no llama a `history`.
- **Una partida reproducida no se convierte en tu marca.** El rival fantasma mide
  al visitante contra sí mismo; una muerte que no es suya no compite con él. Se
  limpia en `selectDifficulty`, que es donde empieza toda partida propia.
- **El «nuevo récord» compara contra la marca de antes de empezar, no contra la
  de ahora.** Al morir, la marca de la sesión ya se ha actualizado con esa misma
  partida, así que preguntarle por la marca actual daría siempre un empate y la
  insignia nunca aparecería. Por eso `createGameOverViewModel` recibe un quinto
  argumento, `previousBest`, que la sesión fija en `selectDifficulty` y no toca
  al morir. Y hay tres condiciones, no una: no sale en la primera partida de la
  sesión, el empate no cuenta, y una partida reproducida nunca lo es. La segunda
  importa por una razón que no es del récord: el rival fantasma usa la misma
  regla, y si uno dijera «récord» en un empate y el otro no, los dos se
  contradirían en la misma partida. Por eso el banner del rival fantasma también
  mide turnos aguantados y no número de ronda.
- **Las cinco acciones se listan siempre, usadas o no.** Un parte que solo
  listara lo hecho escondería la acción que el jugador tenía delante y no usó.
- **Los recursos finales van en cifra, no en barra.** Las barras sirven mientras
  se decide; en una lápida serían adorno, y el panel es estrecho.

### Bugs y trampas que aparecieron al escribirlo

- **El enlace se parsesó sin dificultad y colaba.** `?seed=X&a=ece` no puede
  reconstruir una partida, así que la dificultad es obligatoria y un enlace sin
  ella no es un enlace. Escrito al revés, el enlace se aceptaba y reproducía con
  Normal una partida que se había jugado en Agonía.
- **El banner y el parte medían el récord de dos maneras y se contradecían.** El
  banner comparaba `model.turn` contra la marca y la insignia comparaba
  `turnsSurvived`, que es esa misma cifra menos uno. En la partida que igualaba la
  marca, el juego decía «Récord» en el banner y al morir no llevaba «Nuevo récord»:
  dos veredictos opuestos sobre la misma partida, y solo uno cierto. El arreglo no
  es elegir una de las dos medidas, es reconocer que la del parte es la buena —
  es la que se imprime en el informe— y que el banner tenía que adaptarse. Ese
  arreglo tuvo después un segundo paso: la línea de persecución que quedaba se
  quitó entera. Aunque midiera lo correcto, repetía en una frase la cifra que ya
  estaba al lado, y encima obligaba a decidir si esa frase era una pista o un
  reproche según lo lejos que fuera el jugador. El marcador se queda en la cifra
  del banner y la frase desaparece.
- **Un test de la insignia pasó sin probarla.** El primer esbozo del test de
  sesión pedía la insignia en un caso en el que no podía aparecer, y como
  `queryByText` sobre algo ausente también «pasa», el test no miraba nada. Se
  reescribió para recorrer cuatro muertes seguidas —primera partida, una peor, una
  mejor y otra que ya no mejora— y comprobar la insignia en cada punto. Ese
  recorrido es el que además importa por la cuarta muerte: es la que demuestra que
  la insignia se apaga cuando dejas de mejorar, y no solo que aparece una vez.
- **La mejor partida se guardaba un turno por encima de la partida que la
  produjo.** La marca usaba `state.turn` y el motor anuncia `turn - 1`. Rendirse en
  el turno 1 se anunciaba como «1 turno aguantado» y se guardaba como rival de 2.
  Lo encontraron dos cosas a la vez, y las dos son el argumento de por qué se
  arregló así: un test del rival fantasma que comparaba la marca con el informe de
  la propia partida, y el argumento de que la cuenta la pregunte al motor con
  `surrenderGame(...).end.turnsSurvived` en vez de repetir la regla en la capa de
  aplicación. Dos copias de una regla que deben coincidir son dos cosas que pueden
  no coincidir.
- **Los tests de esta tanda jugaban partidas enteras y lo pagaba el archivo.**
  `verify` corre los 27 archivos en paralelo, y cuatro tests que llegaban a la
  muerte explorando cuarenta turnos empujaron el archivo entero contra el límite de
  cinco segundos: uno estaba en 4160 ms sin cobertura. Se sustituyeron por muertes
  por rendición, que producen la misma pantalla final con dos clics, y el más
  lento pasó a 1521 ms. Al hacerlo, el test del rival fantasma se volvió además
  determinista: antes jugaba dos partidas al azar y comparaba contra
  `Math.max(...)`, lo que solo detectaba el error cuando la primera salía mejor,
  es decir, la mitad de las veces. Ahora juega una partida con un turno y se rinde
  en la segunda, así que la última es siempre peor y el error se ve siempre.
- **`replayGame` sobre un estado muerto.** Un enlace escrito a mano con acciones
  de más llama a `resolveTurn` sobre una partida que ya terminó. Se corta el
  bucle en cuanto `state.status === 'dead'`.
- **El tipo no decía que una partida muerta trae resolución.** Se añadió
  `DeadReplayResult` y el guardián `isDeadReplay` para que las dos cosas no
  puedan separarse; sin eso, TypeScript protestaba al construir el estado de
  arranque y la única forma de callarlo era un `as`.
- **Las guardas `typeof window === 'undefined'` de `seed-url.ts` parecían
  incobribles, y no lo eran.** En jsdom `window` existe siempre, y el comentario
  del archivo de pruebas afirmaba que esas guardas se cubrían «en `App.test.tsx`
  borrando `window`», cosa que allí no ocurre: `App.test.tsx` no menciona `window`
  en ninguna línea. El comentario era una excusa para no cubrirlas. Se resolvieron
  con un archivo de pruebas propio bajo el entorno `node` de Vitest, que no tiene
  `window` de verdad: `seed-url-sin-navegador.test.ts`. Borrar `window` a mano desde
  un test de jsdom habría sido montar un escenario falso para que la cobertura
  saliera. Ahora `seed-url.ts` está al 100 % y lo que se comprueba es real: importar
  la capa de URL fuera de un navegador no revienta y no lee nada.
- **Residuos de escritura.** Esta tanda coló caracteres CJK y cirílicos en
  comentarios al escribir rápido. `scripts/residue-sweep.mjs` los busca en `src/`,
  `scripts/`, `docs/` y `dist/`, y en la primera ejecución se detectó a sí mismo,
  lo que confirma que funciona. Resultado actual: cero.
- **La autopsia se borró, y con ella su código entero.** La frase que decía de
  qué moriste, en qué turno y con qué te quedaste estaba debajo del `Game Over`, y
  los tres datos ya estaban en el parte: la causa en el mensaje de derrota, el
  turno en «Supervivencia» y la comida en «Cómo terminaste». Encima del título lo
  que funciona es el remate, y repetir los datos dos veces con dos redacciones no
  es énfasis. Al quitarla se va `src/app/autopsy.ts` entero y el campo `autopsy`
  del modelo, porque dejarlos sería código muerto con tests que no vigilan nada. El
  archivo de pruebas que los cubría, `autopsy.test.ts`, además ya no tenía sentido
  como nombre: probaba también `breakdown.ts`, así que se partió en
  `breakdown.test.ts` y su parte de semilla se fue con el resto, porque `seedLabel`
  era un alias sin nada encima de `encodeSeed` y `seed.test.ts` ya fijaba su
  resultado —`encodeSeed(0xffffffff) === '1z141z3'`—, así que aquel test era un
  duplicado exacto.
- **El «desde el turno N» de cada fila se borró por la misma razón que la
  autopsia.** El turno de la primera vez de cada acción ya lo daba el parte, y
  mejor: `lastShift` da ese mismo dato una vez, y es el único de los cinco que
  significa algo por sí solo. Ponerlo en las cinco filas era un índice de turnos
  que no se leía, se recorría. Con él cae `firstTurn` de `ActionUsageViewModel` y
  el `Map` que lo llevaba en `createBreakdown`, que se queda contando.
- **La insignia del récord se puso más pequeña y con la tipografía del cuerpo.**
  Iba en la serif de titular, en mayúsculas y con `--glow`, y con eso se leía
  como el segundo título de la pantalla. En una lápida un récord es un aval, no un
  titular. Se quitaron la gótica, las mayúsculas y el halo, y se bajó a `0.8rem`,
  por debajo de la cifra que califica. El dorado se queda: no hay otra forma de
  decir «esto fue bueno» sin añadir un color más.

### Lo que las pruebas cubren, y lo que no

449 pruebas globales; `src/game` y `src/ui` al 100 % en las cuatro métricas,
`src/app` en 97.31 statements y 95.25 branches. Entre lo que ahora está cubierto y
antes no lo estaba:

- El arranque con enlace: partida normal, enlace corrupto, semilla suelta, enlace
  que no muere, y enlace que sí reconstruye la partida con su registro.
- Que la muerte reproducida no se marca como reproducida en cuanto juegas tú, y que
  tampoco se convierte en tu mejor partida.
- Que dos partidas con la misma semilla y las mismas acciones dan el mismo estado
  final y la misma causa.
- Los tres estados del rival fantasma y el caso de empatar, que sigue contando
  como competir.
- Que el banner no dice cuánto falta para el récord. El marcador es la cifra.
- La insignia de récord, por las cuatro partes: la primera partida no la lleva, la
  segunda más corta tampoco, la tercera que pasa la marca sí, y la cuarta que ya
  no mejora se la quita. Y que una partida reproducida no la lleva por muy larga
  que sea.
- Que el banner y el parte no se contradigan: se recorre la frontera del empate
  completa, con la marca en 1 y una partida que pasa por 0, por 1 —empate— y por 2.
  El caso que falla con el código anterior es el del empate.
- Que la pantalla de muerte no explica la muerte por su cuenta: ni «Moriste de…»
  ni «Te rendiste…» ni el turno con la causa. Los tres datos están en el parte.
- La distancia entre el informe y la marca: rendirse en el turno 1 dice cero
  turnos aguantados y guarda cero como marca, y no uno y dos.

### Lo que sigue sin comprobarse

- **En navegador, toda esta tanda.** El parte, el desplegable de compartir, el
  marcador del rival fantasma, que la insignia en dorado se lea discreta y, sobre
  todo, que abrir un enlace no enseñe un parpadeo de la pantalla de inicio. Las
  pruebas comprueban el árbol de accesibilidad y los modelos; ninguna comprueba que
  la pantalla se lea bien ni que el enlace open no parpadee. Sigue sin haber
  navegador de escritorio conectado.
- **Que la insignia en dorado se lea como un aval y no como un rótulo.** Que dos
  dorados no se confundan a ojo con el amarillo de la energía, y que a `0.8rem` con
  la tipografía del cuerpo siga siendo legible sin pelearse con la cifra que
  califica. El contraste está medido, 9.16:1 sobre negro puro, y el color está
  elegido para que sea claramente más apagado que el `--stat-energy`, pero que se
  lea como se quiere leer es una decisión visual, y eso solo se decide mirándola.
- **Que el enlace cabga de verdad en un mensaje de un móvil.** Con 150 turnos son
  unas 150 letras y el enlace completo ronda los 260 caracteres. Hay margen, pero
  no se ha medido en un canal real con un límite real.
- **Que `?seed=X` con la URL suelta abra la partida con ese azar.** Está cubierto
  en pruebas, pero no se ha abierto en un navegador.
- **La longitud del enlace en la partida más larga alcanzable.** El techo medido
  son 152 turnos, así que 152 letras es el peor caso honesto; no se ha generado un
  enlace de 152 turnos y copiado a mano.
- **El mapa acumulativo, el punto 2, entero.** Sin empezar, a la espera de
  medición previa y de permiso explícito antes de meter reglas nuevas.

## Aceptación en la URL pública (Fase 2, desplegada)

La publicación accesible está en `https://the-last-turn.erpro-ferru.workers.dev`.

**Despliegue de la Fase 2:** `git push origin main` con el commit `4e6d856` (9 commits
de Fase 1 y Fase 2). Cloudflare compiló y publicó de forma automática en unos
50 segundos, lo que **confirma que la integración Git está activa sobre `main`**,
la duda que quedó abierta tras la publicación de `0.1.0`. Antes del push el sitio
servía `assets/index-DWaHKHCl.js`; durante la comprobación ya servía
`assets/index-CLf495kK.js`.

Verificación por HTTP sobre el despliegue:

| Comprobación | Resultado |
|---|---|
| `npm run verify` en el commit publicado | Pasa; 256 pruebas, presupuestos dentro de límite |
| Documento | HTTP 200, `lang="es"`, título `The Last Turn`, referencias `./assets/...` y `./favicon.svg` |
| JavaScript | HTTP 200, 248 053 bytes, `text/javascript` — **idéntico** al build local |
| CSS | HTTP 200, 12 498 bytes, `text/css` — **idéntico** al build local |
| Favicon | HTTP 200, 319 bytes, `image/svg+xml` — **idéntico** al build local |
| Cabeceras | `Server: cloudflare`, `CF-Cache-Status` fluctuando entre `MISS` y `HIT` según el momento del despliegue |

El bundle servido contiene la Fase 2: aparecen `Haz click para continuar...`,
`El hambre ya camina más deprisa`, `quitarte salud`, `recuperar un poco de salud` y
`turnos aguantados`, y el CSS servido contiene `--color-blood`, `--color-hint` y las
reglas `.escalation-overlay*`. El copy retirado por la Fase 2 no aparece: `Hito`,
`quince turnos`, `treinta turnos` y `provocar una muerte` están ausentes.

Restricciones de producto, comprobadas sobre el bundle publicado:

| Construcción | Apariciones | Lectura |
|---|---:|---|
| `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` | 0 | Sin persistencia |
| `navigator.sendBeacon`, `gtag(`, `analytics` | 0 | Sin telemetría |
| `XMLHttpRequest`, `WebSocket`, `EventSource`, `eval(` | 0 | Sin backend ni evaluación dinámica |
| `fetch(` | 1 | Polyfill `modulepreload` de react-dom (`preinit`). **No se ejecuta**: la app no crea scripts ni hace `import()` dinámico, y el documento solo referencia un script y una hoja de estilos del propio origen. Queda registrado en vez de declare cero, porque el código está en el artefacto. |
| URLs externas en el bundle | 5 | `http://www.w3.org` (espacios de nombres XML/SVG/MathML) y `https://react.dev/errors/` (cadena de un mensaje de React). Ninguna se solicita en runtime. |

**Límite de esta aceptación:** no se pudo recorrer la interfaz. No hay navegador de
escritorio conectado a esta sesión, así que el aviso de escalada a negro, el foco
del diálogo, el cierre con click, `Enter` y `Espacio`, los atajos inactivos y los
anchos estrechos **no están verificados en el despliegue**. Quedan pendientes y no
se afirman aquí.

## Aceptación en la URL pública (build 0.1.0, anterior a la Fase 1)

Se conserva el registro del despliegue inicial, que se comprobó con Edge/CDP. Los
assets públicos en ese momento eran `assets/index-DWaHKHCl.js` y
`assets/index-DutSG5GR.css`. La URL pública no incluía entonces comer, la pesca
acotada ni el meteorito recuperable.

Aun así se verificó sobre el despliegue:

- Respuesta HTTP 200; `Server: cloudflare` y `CF-Cache-Status: HIT`.
- `index.html` conserva `lang="es"`, título `The Last Turn` y referencias relativas a `./assets/...` y `./favicon.svg`.
- Los tres recursos visuales cargaron con estado 200: JavaScript `244378` bytes, CSS `11416` bytes y favicon `319` bytes.
- La carga inicial realizó 4 peticiones, todas al mismo origen; 0 peticiones a terceros, 0 errores de red, 0 errores de consola y 0 excepciones.
- Flujo verificado: Inicio → Dificultad → Normal → Ayuda → Descansar → Agonía → muerte real → «Volver a jugar».
- La muerte en Agonía se alcanzó por inanición en el turno 5 (10 interacciones de acción); la pantalla final mostró `h1` «La partida ha terminado», el aviso de causa, el foco en `game-over-title` y un único botón «Volver a jugar».
- El reinicio volvió a `screen--difficulty` y una recarga durante la partida volvió a `screen--start`, sin persistencia.
- La auditoría de contraste sobre los 42 nodos de texto visibles en el estado auditado no encontró fallos; la auditoría completa de 64 nodos de las cuatro pantallas está registrada arriba.

**Nota de infraestructura:** la URL disponible termina en `workers.dev`, no en `pages.dev`. Cloudflare sirve correctamente el artefacto estático en ese endpoint. El despliegue de la Fase 2 demuestra que la compilación es automática desde `main`, lo que significa que la integración Git está configurada; lo que sigue sin confirmarse es si el proyecto se creó como Pages clásico o como Workers con Static Assets, porque ambos compilan desde Git. Hay que revisarlo en el dashboard. No se da por verificado un proyecto Pages clásico mientras la URL no sea `*.pages.dev`.

Las capturas de pantalla de 360, 768 y 1440 px se generaron temporalmente para la inspección y no forman parte del repositorio. La primera versión no incluye E2E automatizado; la comprobación de navegador se mantiene como QA manual reproducible.

## Pendiente para el build de la Fase 5

Los builds actuales se verificaron con los comandos automáticos de arriba y con una comprobación del artefacto servido: `npm run preview` devuelve 200 para el documento y para los tres recursos. Un barrido de URLs sobre el bundle solo encuentra `http://www.w3.org` (espacio de nombres SVG inerte) y `https://react.dev` (cadena de un mensaje de error de React); no hay peticiones a terceros en runtime.

Queda pendiente, y no se afirma aquí ningún resultado hasta ejecutarlo:

- Recorrido en navegador real de la Fase 5: la fila de salud con su barra de diez
  bloques, que la salud se anuncie en texto al caer a `Sangrando` y a `A un paso
  de la muerte`, los cinco atajos `E C S D R`, y que `B` y `P` no hagan nada.
- Recorrido de la nueva economía: una partida donde explorar gaste salud visible,
  una cura que la devuelva, y el reparto de comida entre comer, curar y guardar.
- Aviso de escalada a negro, mensaje en rojo sangre, foco en el diálogo, cierre
  con click, `Enter` y `Espacio`, atajos inactivos mientras el aviso está abierto,
  comportamiento en anchos estrechos y con `prefers-reduced-motion`.
- Comprobación de la tabla de modificadores en partida real, no solo en pruebas:
  que en la carga 10 un turno cueste 4 de hambre, el descanso topa en 3 de
  energía, la ración quite 10 y curar devuelva 5.
- Recorrido largo en partida real: llegar al menos al nivel 3 y ver el aviso tres
  veces seguidas, para confirmar que el copy cicla y que la escalada se nota.
- Repetición de anchos 320, 360, 768 y 1440 px, objetivos táctiles, movimiento
  reducido, consola y red sobre el build actual.
- Recorrido del pronóstico: que la terminal anuncie el evento que va a caer antes
  de elegir la acción, que cuente cuántos hay cuando son varios, y que no se vuelva
  a leer el parte entero por el lector de pantalla, porque el pronóstico vive
  fuera de `.terminal__screen` con su propio `role="status"`.
- Recorrido de la carga 1: una partida donde un fallo al reparar derribe el
  refugio, que es la única regla nueva de la rampa.
- Barrido de residuos en `dist/`: que no queden `forage`, `fish`, `Auxiliary`,
  `Ayuda`, `Hito` ni los textos de los hitos de los turnos 15 y 30.
- Confirmación de infraestructura en el dashboard de Cloudflare: si el proyecto
  es Pages clásico o Workers con Static Assets, y qué rama produce despliegues.
- Recorrido de la tanda nueva en navegador real: abrir un enlace de partida y
  confirmar que aparece directamente su pantalla de muerte sin parpadeo de la de
  inicio, que el parte se lee, que el desplegable de compartir enseña la URL
  entera y que el marcador del rival fantasma aparece en la segunda partida y
  cambia de rótulo al superar la marca.
- Mirada a la pantalla de muerte después de la limpieza: que sobre el `Game Over`
  quede solo el remate y el negro respire igual que antes, que la insignia en
  dorado a `0.8rem` se lea como un aval y no compita con los turnos aguantados, y
  que el bloque «Cómo jugaste» con solo las cuentas no deje un hueco raro al lado
  de las etiquetas.
- Empuje a `origin/main` y redespliegue, que requieren autorización explícita.

`D-01`, `D-02` y `D-03` ya no bloquean la publicación: los tres están resueltos,
medidos y cubiertos por tests. `D-05` no bloquea pero queda **abierto y declarado**:
L9 y L10 no son alcanzables porque el techo medido es 152 y sus umbrales están en
162 y 190, y rellenar las mesetas de L5 y L7 se midió y se descartó porque baja
justamente ese techo. Atacar L9 exige cambiar `threshold(n)`, que es una decisión
de alcance. Lo único que bloquea la publicación sigue siendo que nadie ha mirado
el resultado en una pantalla.