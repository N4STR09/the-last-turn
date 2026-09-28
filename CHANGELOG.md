# Changelog

## [Unreleased]

### Added

- **Cinco acciones con una sola función cada una.** `explore` produce comida y
  paga con salud; `eat` baja el hambre; `cure` sube la salud; `rest` sube la
  energía; `repair` levanta el refugio y paga con dos turnos. La suma de las cinco
  cubre los cinco recursos sin que dos compitan por el mismo, y la comida queda
  como el único recurso con tres sumideros que compiten entre sí: **calorías,
  medicina y reserva**. Esa competencia es la decisión central de la partida.
- **La salud es una estadística visible.** Pasa a ser la primera cifra, con el
  rojo de la sangre, su barra de `MAX_HEALTH` bloques —diez, no doce— y su aviso
  en texto: `Sangrando` a 5 o menos, `A un paso de la muerte` a 2 o menos. Es
  una inversión consciente de un requisito del prototipo C, y está declarada como
  desviación `A-05` en `docs/fidelity.md`. El motivo es que la salud se
  administra —explorar la gasta, curar la devuelve— y un presupuesto que no se
  ve no se puede administrar. No se invierte la obligatoriedad de comunicarla:
  cada punto que se pierde se dice en la terminal y sale en la lista de cambios.
- **Curarse.** Dos comidas y `max(2, exploreWound)` de salud, sin tirada. Es el
  único camino de curación, y por eso la paridad con la herida del hallazgo
  grande deja de ser decorativa: sin ella, a carga 6 el hallazgo grande salía
  peor por punto de salud que el pequeño y explorar tenía una opción mala.
- **Atajos por inicial del verbo.** `E` explorar, `C` comer, `S` curarse, `D`
  descansar, `R` reparar. `B` y `P` quedan sin mapeo, y hay una prueba que lo
  fija: una tecla que sobró al retirar una acción no puede seguir significando
  algo.
- **Rendirse.** Una salida de la partida en la última fila de la rejilla, con
  `grid-column: 1 / -1` y en color sangre. Pide confirmación en un diálogo modal
  con dos salidas, «Seguir jugando» y «Rendirme». Cierra con Escape o con
  «Seguir jugando», nunca con un click fuera: una derrota no se acepta por errar
  el ratón. El foco entra en el diálogo, queda atrapado entre los dos botones
  mientras está abierto y vuelve al botón de rendirse al cancelar. Su línea de
  coste dice `(te lleva la partida)` en lugar de un gasto de hambre o energía,
  porque no se gasta nada: se pierde la partida.
- **Nombre del juego en gótico y más grande.** El título usa su propia pila de
  familias, `--font-title`, a `clamp(3.5rem, 13vw, 7rem)` con `--glow-title`:
  blanco de siempre más una capa roja abierta. No se descarga nada: si
  «Old English Text MT» o «Blackadder ITC» no están instaladas, cae a `fantasy` y
  después a una serif.
- **Cabecera de la pantalla de dificultad centrada.** El rótulo, el título, el
  párrafo de apertura y la nota de reglas se centran como bloque. Hacía falta
  `justify-self: center` además de `text-align: center`, porque los elementos de
  rejilla se estiran a su columna, y `max-width: 58ch` en la nota de reglas,
  que estirada a todo el ancho dejaba de leerse como un párrafo centrado.
- **Escalada progresiva de dificultad.** El estado de partida lleva un nivel de
  amenaza derivado del turno: el nivel `n` se alcanza en el turno `n² + 9n`
  (10, 22, 36, 52, 70, 90, 112, 136, 162, 190…). Una acción multiturno salta al
  nivel más alto cruzado y emite un único aviso.
- **Pantalla de aviso bloqueante.** Al subir la dificultad la partida se congela
  a negro y aparece el nivel, un mensaje jocoso en rojo sangre y la pista
  «Haz click para continuar...». Se descarta con click en cualquier sitio,
  `Enter` o `Espacio`, y mientras está abierto los atajos de acciones no actúan.
- **Nueve modificadores de carga** que escalan con `load = min(threat, 10)`:
  hambre por turno, **alivio de la ración**, tope de energía al descansar, herida
  y cura de explorar, hallazgo grande, hallazgo normal, raciones que roba el
  mapache, radio de fallo al reparar y tiradas de evento extra en Agonía. Con
  carga 0 reproducen exactamente la Fase 1.
- **Severidad por carga** en tormenta y mapache, sin cambiar la tabla de sorteos
  1..100. La tabla de eventos se mantiene en tres tipos. El recargo de energía se
  cobra **una sola vez por turno**, no uno por evento.
- `SPEC-threat.md` con el alcance, las fórmulas, el orden de resolución y el
  defecto abierto de esta fase.
- 12 mensajes de escalada que ciclan, con el nivel anotado a partir del segundo
  ciclo.
- Reequilibrio de la economía de comida: comer quita `4 + hambreExtraPorTurno`
  en lugar de 4 fijos. Con carga 0 y 1 no cambia nada, así que la Fase 1 queda
  intacta, y a partir de ahí la ración vuelve a tapar el gasto del turno.

### Changed

- **Rediseño completo de la interfaz.** La partida es una sola columna estrecha
  sobre negro casi puro, y cada elemento es una fuente de luz. En orden de
  lectura: banner con el nombre del juego y, debajo, la ronda y el nivel de
  escalada en blanco puro con halo; una fila por recurso en el color que le
  toca; el registro del turno como un recuadro de terminal con calavera de fondo;
  y las acciones debajo, sin descripciones.
- **El refugio sale de la lista de cifras y pasa a línea propia.** Era una
  cuarta fila con la etiqueta «Refugio» y la cifra «Presente»/«Ausente», y eso lo
  trataba como un número cuando es un interruptor. Ahora vive debajo de las
  cifras, con su bloque, y se dice entero: `Construido` o `Destruido`. La palabra
  está en un único sitio, el helper `shelterStatus`, que el delta de la terminal
  también usa; antes el delta decía «Presente»/«Ausente» y la fila decía otra
  cosa. Su fila comparte la misma rejilla de cuatro columnas que las cifras, para
  que quede cuadrada con ellas en lugar de alineada por el borde.
- **Barras de recursos por bloques.** Un bloque encendido por unidad, hasta doce.
  Por encima la barra satura y la cifra sigue siendo la verdad. El refugio es
  binario y usa un solo bloque. La salud es la excepción: su barra va hasta
  `MAX_HEALTH`, diez bloques, porque no comparte escala con las otras tres.
- **Gasto por acción impreso en el botón.** Hambre y energía se gastan por turno,
  no por acción, así que la etiqueta se calcula contra la escalada vigente. Las
  cuatro acciones de un turno imprimen su cifra exacta, que cambia con la
  escalada; reparar imprime la suya, que es el doble porque dura dos turnos. **Ya
  ningún botón anuncia un peor caso**, porque quitada la pesca no queda ninguna
  acción con coste azar: `actionTurns` devuelve un número y no un intervalo, y la
  etiqueta es el gasto exacto.
- **La válvula de escape de la escalada.** `extraHungerPerTurn` pasa a
  `min(4, ⌊load/3⌋)`, el alivio de la ración a `4 + 2·extra` y el tope del
  descanso a `max(3, 5 − ⌊load/4⌋)`. Con `/2` en el hambre por turno, el hambre y
  el alivio crecían al mismo ritmo y la holgura por ración no se movía nunca: la
  partida no era renewable por construcción y su techo absoluto era el turno 97.
  Con la válvula, 153. La aritmética completa y el techo medido están en
  `SPEC-threat.md`.
- **Calavera de fondo en el registro del turno**, en SVG en línea y decorativa. En
  Agonía lleva cuernos y los ojos cambian a rojo con aura. Es la única
  representación de la dificultad dentro de la partida, así que el banner ya no
  la repite.
- **Aviso de estado en las barras.** Un recurso en estado de aviso late en rojo a
  0.55 Hz, muy por debajo del umbral de 3 destellos de WCAG 2.3.1, y con
  `prefers-reduced-motion` se queda en rojo fijo. El aviso y el parpadeo son la
  misma señal, así que basta con que `tone` sea `'warning'`.
- Fase 1 de supervivencia: comer consume una ración, reduce el hambre y recupera salud; la pesca termina tras seis intentos como máximo; el meteorito quita un punto de salud en lugar de matar desde salud inicial.
- La interfaz comunica las nuevas resoluciones, y ya no oculta la salud.
- `docs/fidelity.md` y `SPEC-game-engine.md` separan la línea base histórica del C de las desviaciones explícitas de la Fase 1, de la Fase 2 y de la Fase 5.

### Removed

- **La pesca y la búsqueda de comida, del motor y no solo de la pantalla.** Las dos
  salen de `GameAction`, de `ActionOutcome`, del mapa de atajos y de sus filas, y
  con ellas desaparece la palanca de escalada que las sostenía. La pesca era el
  único bucle de intentos del juego y el único botón cuyo precio no se podía
  decir de antemano; la búsqueda era una acción con un éxito que se estrechaba y
  sin ningún otro efecto. Entre las dos ocupaban dos de los cinco recursos
  compartidos sin aportar una decisión que las otras tres no cubrieran.
- **La acción Ayuda, del motor y no solo de la pantalla.** Sale de `GameAction`,
  de `ActionOutcome`, de `action-cost.ts` y del mapa de atajos, y con ella
  desaparece su fila. Se elimina igual que se eliminaron los hitos: una acción que
  no hace nada en el motor es ruido que además obliga a cada prueba a gastar un
  turno de datos en algo que no existe. `?` deja de ser atajo.
- **El campo `critical` de `ResourceViewModel`.** Con el refugio fuera de la lista
  de cifras ya era idéntico a `tone === 'warning'`, y el parpadeo se deriva del
  tono. Se elimina el campo, no la señal.
- **La etiqueta «Modo de supervivencia» de las tarjetas de dificultad.** No
  distinguía una tarjeta de la otra: las dos son supervivencia.
- **Los hitos 15 y 30 y su penalización.** La escalada progresiva los absorbe.
  Esto retira el compromiso de fidelidad de `SPEC-infinite-survival.md` y es una
  decisión de Fase 2, no una corrección silenciosa.
- El decaimiento pasivo de la salud, que se decidió no introducir. El motivo no
  cambió con la visibilidad: un desgaste que nadie anuncia es ilegible igual que
  la salud esté oculta o no. El único daño por salud sigue siendo el resultado de
  explorar, que dice cuánto costó, y el evento que lo quita.
- Las descripciones largas de los botones de acción y los encabezados de sección.
  El texto se suprime y la información que no cabe en la etiqueta se calcula y se
  imprime en el sitio donde se necesita.

### Fixed

- **Agonía era un impuesto, no un modo.** Cuatro cosas encadenaban: con carga
  alta se tiran tres eventos por turno, cada tormenta y cada mapache cobraban 1 de
  energía **uno por evento**, el descanso con techo devolvía como mucho 2, y la
  tormenta tiraba el refugio, tras lo cual descansar sin techo devolvía 0. La
  energía caía sola, sin turno en el que decidir. Ahora el recargo se cobra una
  vez por turno propagando la marca entre tiradas, descansar sin refugio devuelve
  1 —lo que cuesta el turno—, el mapache saquea una cantidad fija en vez de vaciar
  el depósito, y reparar no hiere. El peor turno de Agonía pasa a costar 1 de
  energía en lugar de 3.
- **La partida no era renewable por construcción.** El techo absoluto con el mejor
  azar posible era el turno 97, por debajo del nivel 6 que empieza en el 90, y
  ninguna combinación de los otros modificadores lo subía. Con la válvula de
  escape son 153. Medido sobre 400 semillas con el piloto competente: mediana 118,
  percentil 90 147, máximo 172, y 57 % de muertes por hambre frente a 43 % por
  salud.
- **Explorar tenía una opción mala.** A carga 6 el hallazgo grande daba 4 comidas
  por 4 de salud y el pequeño 2 por 1, así que el premio grande salía a la mitad
  de rinde por punto de salud. `cureAmount` es ahora `max(2, exploreWound)`, con
  paridad exacta, y hay un test que la exige en toda la rampa.
- **La salud podía quedarse negativa sin terminar la partida.** El cierre usaba
  `health === 0` y el daño no siempre cae de uno en uno —explorar quita de 2 a 5
  según la carga—, así que a partir de carga 8 se saltaba el cero y se seguía
  jugando con salud negativa. Ahora es `health <= 0`.
- **La entradilla de inicio decía «Overvive»** en lugar de «Sobrevive». Era una
  errata, no una decisión, y ahora hay una prueba literal que falla si el
  anglicismo vuelve a colarse.
- **La reparación ya no rompe la línea base.** Un límite del tipo `valor ≤ radio`
  hacía que la reparación nunca fallara con carga 0. Ahora la banda de fallo es
  un radio centrado en 5 (`|tirada − 5| ≤ radio`), de modo que con carga 0 sigue
  fallando únicamente la tirada 5, como en el prototipo C.
- **El copy de la pantalla de dificultad ya no habla de los hitos 15 y 30**, que
  la Fase 2 eliminó. Sobrevivió a la Fase 2 porque la comprobación del bundle
  buscaba «quince turnos» en palabras y el texto usaba cifras.
- **Las etiquetas visibles del banner no se generan con `content: attr()`.** El
  texto producido por CSS no entra en el árbol de accesibilidad, así que un
  lector de pantalla anunciaba «3 1» sin decir qué es cada número. Ahora Ronda y
  Nivel son elementos de verdad.
- El listener de teclado del aviso se retira al desmontar el diálogo.
- Se eliminó la regla `eslint-disable` de `EscalationOverlay.tsx`, que
  referenciaba reglas de un plugin no configurado y hacía fallar el lint.

### Breaking

- `GameAction` queda en cinco valores: `'forage'` y `'fish'` se eliminan y se
  añaden `'cure'`. El mapa de acciones de la vista, el de atajos y las filas de la
  rejilla se reconstruyen con el orden `explore, eat, cure, rest, repair`.
- `ActionOutcome` pierde `{ type: 'forage-found' }`, `{ type: 'forage-empty' }`,
  `{ type: 'fish-caught' }` y `{ type: 'fish-failed' }`, y gana
  `{ type: 'cure-done' }` y `{ type: 'cure-no-food' }`. `explore-find` y
  `explore-rich` conservan su forma pero con el daño en `healthLost` explícito.
- `ActionCost` deja de ser un rango: `turns` pasa de `ActionTurnSpan` a `number` y
  aparece `hungerPerTurn`. `actionTurns(action)` sustituye a la lectura del rango,
  y `actionCostLabel` ya no tiene rama de «hasta».
- `GameCoreState` añade `health` con `MAX_HEALTH = 10` como techo, y el motor deja
  de recortarla: el daño se aplica entero y el cierre decide.
- `ResourceViewModel` gana el caso `'health'` en `StatId`, y `MAX_HEALTH` se
  exporta desde el índice del motor porque la vista necesita el techo de la barra.
- `GameResolution.randomEvent` pasa a ser `randomEvents: readonly GameEvent[]`.
- `GameResolution.milestone` pasa a ser `threatNotice: ThreatNotice | null`, y
  `Milestone` se elimina del contrato público.
- `energyRecovered` pasa de `3 | 5` a `number`, porque el tope de energía al
  descansar depende de la carga.
- `EndCondition` y `DeathCause` añaden `'surrender'`.
- `AppState` hace `resolution` nulable en la variante `dead`, porque rendirse
  termina la partida sin que hubiera un turno que resolver, y añade
  `surrenderPending: boolean` **solo** en la variante `playing`, para que un
  estado con la confirmación puesta en pantalla equivocada no compile.
- `AppCommand` añade `ask-surrender`, `cancel-surrender` y `surrender`.
- `GameViewModel` cambia `resources` por `stats` (hambre, energía, comida y salud)
  más un `shelter` nuevo. `ShelterViewModel` lleva `label`, `hasShelter`,
  `status: 'Construido' | 'Destruido'` y `tone`, y no lleva bloques: su bloque es
  un interruptor encendido o apagado.
- `ResourceViewModel` añade `units` y `capacity`; `critical` se elimina (ver
  arriba).
- `GameViewModel` añade `threat` y `actions`. `actions` mueve las etiquetas y el
  gasto de los botones a la capa de aplicación, donde vive el texto.
- `GameScreen` recibe `surrender`, que es el disparador y su diálogo a la vez.
- `ResolutionPanel` recibe `turn` y `difficulty`, porque la terminal imprime la
  ronda en el prompt y decide la variante de la calavera.
- `ResolutionViewModel.events` es una lista. Con tiradas extra el mismo evento
  puede repetirse en un turno, así que `event` singular ya no alcanza.
- `ResourceDeltaViewModel` gana el caso `'health'`, y la lista de deltas de la
  terminal incluye la salud.

### Verification

- 337 pruebas en verde. Cobertura global 97.14% statements, 95.73% branches, 100%
  functions y 97.12% lines. `src/game` al 100% en las cuatro métricas con 177
  pruebas, y `src/ui` al 100% con 63. Bundle de 76.47 KiB JS gzip y 3.85 KiB CSS
  gzip.
- La sostenibilidad de la partida se mide, no se estima: con el piloto
  competente y el mejor azar posible en cada dado, el techo absoluto es el turno
  **153** en Normal. Sobre 400 semillas con juego normal: mediana 118, percentil
  90 147, máximo 172. El máximo por encima del techo no es una contradicción —
  forzar el hallazgo grande en cada exploración cuesta entre 2 y 5 de salud, y por
  eso una partida que juega normal y tiene suerte de vez en cuando vive más.
- La trampa de foco del diálogo de rendirse se probó con `Tab` y `Shift+Tab` en
  los cuatro sentidos, incluido el caso en que el foco está en el propio diálogo
  al abrirse. Para eso el manejador busca los botones con `event.currentTarget` en
  lugar de un ref, y no lleva guarda de lista vacía: sin lista, el foco no es
  ningún extremo, el tabulador sale y Escape sigue funcionando. Perder el foco es
  un fallo recuperable; atraparlo en un diálogo sin salida, no.
- Contraste medido sobre el fondo de página `#050706`: texto `#b9c4bd` 11.25:1,
  apagado `#93a09a` 7.44:1, pista `#7a7a7a` 4.71:1, blanco 20.20:1. Recursos:
  salud `#ff5f4d` 6.73:1, hambre `#b184ff` 7.32:1, energía `#ffd166` 14.01:1,
  comida `#7ee08a` 12.43:1, refugio `#5ec8f5` 10.64:1. Todos AA o mejor. El rojo
  pasa del hambre a la salud y el hambre se va al violeta, el único matiz que
  quedaba libre sin pegarse a ninguno de los otros tres.
- Geometría de la calavera comprobada numéricamente sobre el PNG rasterizado:
  0.00% de asimetría horizontal en las dos variantes, silueta dentro del lienzo, y
  en Agonía 9 px más alta por los cuernos. **No se ha visto la imagen**: el
  aspecto queda pendiente de navegador real.
- La aceptación en navegador del despliegue sigue pendiente: no hay navegador de
  escritorio conectado a la sesión, así que el aviso de escalada, el foco, el
  cierre con teclado, los anchos estrechos, el aspecto de la calavera, el título
  gótico, el centrado de la pantalla de dificultad, la línea de refugio, la
  nueva fila de salud, el diálogo de rendirse y la sensación de endless **no
  están verificados en un navegador real**. Las medidas confirman geometría y
  contraste, no que la interfaz quede bien.
- **Publicado en `https://the-last-turn.erpro-ferru.workers.dev`** con el commit
  `4e6d856`, que incluye la Fase 1 y la Fase 2. Cloudflare compiló desde `main` de
  forma automática. El bundle servido (`index-CLf495kK.js`, 248 053 bytes) coincide
  byte a byte con el build local, y el copy de escalada está dentro del artefacto.
  **El rediseño de esta entrada todavía no está desplegado.**

### Known issue

Ninguno conocido. Los tres defectos que se detectaron durante esta fase están
resueltos y medidos; el detalle está en `SPEC-threat.md` y en `docs/qa.md`.

Para quien lea el historial. `D-01` era que la escalada de hambre hacía la
partida insuperable: la ruta evidente moría en el **turno 37** y el techo absoluto
con el mejor azar posible estaba en el **turno 50**, con el nivel 4 empezando en el
52, de modo que los niveles 4 a 10 nunca aparecían. Se arregló escalando el
alivio de la ración.

`D-02` era que Agonía era un impuesto. Las tres palancas de reequilibrio de la
Fase 2 la movieron **un turno como mucho**, porque su muro no eran los recursos:
con carga alta se tiran tres eventos por turno, cada tormenta y cada mapache
cobraban 1 de energía uno por evento, y la tormenta tiraba el refugio, tras lo
cual descansar devolvía 0. La energía caía sola. Se arregló con estructura, no
con números: el recargo único por turno, el descanso sin refugio que devuelve lo
que cuesta, el mapache que saquea en vez de vaciar, y reparar sin herir.

`D-03` era que la partida no era renewable. El techo absoluto estaba en el
**turno 97**, por debajo del nivel 6 que empieza en el 90, y ninguna combinación
de los otros tres modificadores lo subía: el hambre por turno y el alivio de la
ración crecían al mismo ritmo, así que la holgura por ración era una constante de
3 puntos. Y a carga 6 el hallazgo grande de explorar salía peor por punto de salud
que el pequeño, o sea que explorar tenía una opción mala. Con la válvula de
escape el techo sube a **153** y `cureAmount` iguala a `exploreWound`.

Un dato que sigue abierto y conviene no maquillar: **Agonía continúa siendo mucho
más corta que Normal** (mediana 31 frente a 118, techo 57 frente a 153). La
fractura estructural está arreglada, pero el impuesto de la tormenta marca el
techo. Se acepta como dificultad, no como defecto, y por eso el techo renewable se
define sobre Normal. Si al jugarlo en navegador se lee como un muro y no como un
modo, la fase no está cerrada.

## 0.1.0

Primera versión jugable de *The Last Turn Web*, migración del prototipo C a una
aplicación web estática preparada para publicarse en Cloudflare Pages.

### Added

- Migración web de *The Last Turn* a React, Vite y TypeScript como aplicación 100 % estática.
- Preparación para Cloudflare Pages con Node.js fijado, rutas relativas y guía de publicación y rollback.
- Publicación inicial verificada en `https://the-last-turn.erpro-ferru.workers.dev`; la URL disponible termina en `workers.dev` y queda pendiente confirmar si el proyecto es Pages clásico o Workers con Static Assets.
- Motor puro con las siete acciones, eventos, hitos, dificultad y condiciones de fin del prototipo C.
- Inicio, selección de dificultad, partida, pantalla final, atajos y gestión de foco.
- Verificación con Vitest, React Testing Library, ESLint, TypeScript, cobertura y build estático.
- Puerta `npm run check:budget` que bloquea la entrega si el bundle supera 200 KiB JS o 50 KiB CSS gzip.
- Ledger de fidelidad en [`docs/fidelity.md`](docs/fidelity.md).

### Fixed

- La pesca añade una sola vez las 3 comidas definidas por el C, con independencia del número de intentos.
- Los bordes de los botones de acción alcanzan el contraste mínimo de componentes gráficos.
- La cobertura por capacidad aplica sus propios umbrales y reconoce rutas con separadores Windows.
- `verify` encadena los ámbitos por capacidad: antes los umbrales de `src/game` y `src/app` estaban definidos pero no se aplicaban, y una regresión de cobertura podía pasar en silencio.
- Un ámbito de cobertura no reconocido se rechaza con error en lugar de degradar a los umbrales globales.
- Auditoría de contraste WCAG 1.4.3 sobre los 64 nodos de texto de las cuatro pantallas, sin fallos.

### Fidelity notes

Estos comportamientos son deliberados y forman parte de la fidelidad con el
prototipo C. No deben "corregirse" sin una decisión explícita.

- No existe una condición de victoria.
- La salud no se muestra y no se recupera.
- Comer no reduce el hambre.
- No se imponen límites superiores a energía o comida.
- La pesca y la terminación conservan los defectos descritos en el ledger de fidelidad.
