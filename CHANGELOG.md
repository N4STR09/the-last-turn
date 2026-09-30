# Changelog

## [Unreleased]

### Added

- **El menú de ajustes, con el engranaje en el banner.** Sustituye a la tecla de
  reglas que se pensó al principio. Una tecla es un atajo para quien ya conoce el
  juego, y lo que faltaba era lo contrario: una puerta visible para quien no lo
  conoce y no va a adivinar que existe. Va arriba a la derecha, dentro del banner
  y fuera del flujo, con `aria-label="Ajustes"`, `aria-expanded` y
  `aria-controls`. Es un desplegable y no un diálogo, y **no tiene tecla**: cerrar
  con Escape es accesibilidad, abrir con una tecla sería volver a lo que este menú
  sustituye. El menú queda además como el sitio donde añadir ajustes sin tocar el
  teclado, que es por donde empezará el siguiente.
- **«Mostrar la semilla», en el menú, y solo cuando se pide.** El dato no hace
  falta para jugar, y en una pantalla que se mira por encima del hombro de alguien
  lo que no se pide no se ve, así que el botón dice en qué estado está
  (`aria-pressed`) y alterna entre «Mostrar la semilla» y «Ocultar la semilla». Lo
  que se recuerda es si estaba revelado, y sale tal y como viaja en el enlace: un
  entero de 32 bits escrito en base 36.
- **La hoja de reglas, como diálogo modal.** «Información» la abre encima del
  tablero y **sustituye** al menú en vez de apilarse: dos capas sobre el mismo
  tablero serían dos cosas que cerrar y ningún sitio para saber cuál está
  encima. Es un `role="dialog"` con `aria-modal`, con la barra de título y el
  botón «Cerrar» fijos sobre un cuerpo con scroll, para que la salida siga a la
  vista a media lectura. Cierra con Escape, con el botón y con un click en el
  fondo, y **nunca con un click dentro**: cerrar la ayuda al intentar seleccionar
  una línea sería el peor momento posible para cerrarla. El foco entra en el
  diálogo y no en su primer botón, para no saltarse el principio de la hoja, que es
  justo lo que el jugador ha venido a leer, y queda atrapado entre sus bordes.
- **Los números de la hoja salen del motor, no de la hoja.** El nombre y el gasto
  de cada acción salen de `createActions`, que es la misma función que dibuja los
  botones, y la tecla sale de `shortcutKeyForAction`. Las cifras que el motor
  resuelve por función —alivio de la ración, tope del descanso, herida del
  hallazgo grande, salud de la cura— se citan llamando a esa función. No hay una
  segunda lista de precios: si el precio cambiara, la ayuda y el botón cambiarían
  a la vez, que es lo único que impide que una ayuda contradiga a lo que ayuda.
  Las dos direcciones de los atajos tienen un test de ida y vuelta, y como
  `shortcutKeys` es un `Record<GameAction, string>` completo, una sexta acción sin
  tecla rompe la compilación en vez de colarse en la hoja con un hueco sin
  dibujar.
- **Lo que la hoja no puede decir, no lo dice.** Los eventos son solo de Agonía y
  la sección lo dice; la línea de la salud **no nombra el meteorito ni el mapache
  en Normal**, porque en Normal ninguno de los dos llega a tirar y un jugador al
  que se le nombra un meteorito se queda esperando un cielo que no cae nunca. Las
  probabilidades de la tabla de sorteos no se citan: viven en constantes internas
  del motor, y una ayuda con números que envejecen solos es la peor ayuda que se
  puede escribir.
- **El `+` al final de la barra, cuando hay más unidades que bloques.** Una barra
  que saturaba se llenaba y no decía nada, y la verdad estaba en la cifra del lado,
  que es lo que hay que mirar de verdad. El `+` va pegado a los bloques, no antes
  de ellos, y solo aparece cuando `units > capacity`. Dos barras lo admiten y dos
  no lo pueden admitir nunca: la salud está topada en `MAX_HEALTH` y el hambre mata
  por encima de 10, así que su máximo vivo es 11 de 12. **Va pelado, sin la cuenta
  del exceso, y es decisión cerrada.** Un `+N` daría un dato mejor del que ya
  está escrito al lado de la barra, y la copia es el problema: dos cifras del mismo
  número en dos sitios son dos fuentes de verdad, y la que está metida en una fila
  de doce cuadrados es la que primero se lee mal. Lo que el `+` tiene que decir es
  «mira la cifra, no la barra», y eso cabe en un carácter.
- **El «nuevo récord» en la pantalla de muerte.** En dorado, justo debajo de los
  turnos aguantados, porque es lo que califica a esa cifra y no un dato más de la
  partida. No es una victoria: en este juego siempre se muere, así que lo único
  que se puede superar es la marca propia. Y hay tres condiciones, porque las tres
  importan: **no aparece en la primera partida** de la sesión —sin marca previa no
  hay récord que batir, y felicitar a alguien por su primera muerte sería absurdo—;
  **empate no es superar**, con `>` y no con `>=`, igual que el rival fantasma, para
  que las dos reglas no se contradigan; y **una partida reproducida nunca lo es**,
  porque la muerte es de otra persona. El color es un token nuevo, `--color-gold`,
  que da 9.16:1 sobre el negro puro de esa pantalla, y no es un `--stat-*` porque
  un récord no es un recurso de nadie. Se dice bajito: tipografía del cuerpo, sin
  halo y en `0.8rem`, más pequeña que la cifra que califica. En una lápida un
  récord es un aval, no un titular.
- **La partida tiene semilla, y la semilla viaja en la URL.** Toda partida nace de
  un entero de 32 bits sin signo que se escribe en base 36, y ese entero decide el
  azar a través de un `mulberry32` sembrado. Abrir `?seed=X` sin más parámetros
  arranca una partida con ese azar; abrir `?seed=X&d=n&a=ece` recorre la partida
  entera. `Math.random` queda confinado a un único sitio, `createRandomSeed`, y el
  motor sigue sin verlo: recibe un `RandomInt` y no sabe de dónde sale. Es el
  mismo generador con el que se midió el endgame, así que una partida sembrada es
  comparable con la línea base de 400 semillas.
- **El enlace reproduce la partida, no un resumen.** `?seed=<base36>&d=<n|a>&a=<letras>`
  lleva semilla, dificultad y una letra por turno, y las letras son las de los
  atajos de teclado: `e` explorar, `c` comer, `s` curar, `d` descansar, `r` reparar.
  Un enlace se lee con el mismo alfabeto con el que se juega. La reproducción pasa
  por el mismo `createGame` y el mismo `resolveTurn` con la fuente sembrada, así
  que la pantalla final es la de verdad —con la resolución real que cerró la
  partida— y no un parte hecho a mano. El bucle corta en cuanto la partida muere,
  de modo que un enlace con acciones de más no puede romper la aplicación, y un
  enlace manipulado que no muere arranca una partida normal porque sin muerte no
  hay nada que reproducir. Una partida larga son unas 150 letras y el enlace
  completo se queda por debajo de los 260 caracteres.
- **El parte final de la pantalla de muerte.** Encima del mensaje de causa no hay
  ninguna frase que explique la muerte: lo que la explica es el parte. Debajo van
  los cinco recursos en su valor final, con la misma lectura que durante la
  partida: mismo orden, mismas etiquetas, mismo tono. El turno de muerte y los
  turnos aguantados son el mismo número, porque el motor avanza el contador al
  consumir el turno y el último turno jugado es el que acabó con la partida.
- **El parte de cómo jugaste.** Las cinco acciones, aunque no se hayan usado
  nunca, con la cuenta y nada más. Un parte que solo listara lo que se hizo
  escondería justo lo interesante: la acción que el jugador tenía delante y no usó.
  Del turno de cada acción no queda nada, y se quitó en las dos formas en que
  estaba: el «desde el turno N» de las filas repetía un mismo dato cinco veces, y el
  párrafo del último estreno lo decía una sola vez y en forma de juicio sobre cómo
  se jugó. El parte ya dice en qué turno murió.
- **El rival fantasma.** La mejor partida de la sesión, en turnos, vive en el
  banner como tercera cifra. Aparece solo cuando ya ha muerto alguna partida,
  porque antes de eso no hay nada contra lo que medir. Al superar la marca el
  rótulo de la cifra pasa de `Tu mejor` a `Récord`: ese es el momento en que la
  escala invisible se vuelve visible. La marca vive solo en memoria y se pierde al
  recargar, que es justo lo que la hace un rival y no un récord. Una partida
  reproducida no se convierte en tu marca: no es tuya.
- **La partida se puede compartir.** El enlace aparece en la pantalla de muerte,
  junto a un botón que lo copia al portapapeles y a un desplegable que lo escribe
  entero para poder leerlo y copiarlo a mano cuando el portapapeles está bloqueado.
  La barra de direcciones no se toca: si la partida muerta metiera su enlace en la
  URL, recargar reventaría la muerte en vez de empezar otra, y nadie ha pedido eso.
- **El evento se telegrafía un turno antes de caer.** Es el cambio de mayor valor de
  esta tanda. El azar del evento se tira al cerrar el turno y se guarda en
  `GameCoreState.pendingEvents`; al empezar el siguiente se aplica y además se
  publica en `GameResolution.randomEvents`. Antes la tormenta caía sobre un turno
  que el jugador ya había decidido y ya había pagado, y la medición lo cuantificó:
  el 52 % de las partidas de Agonía morían en los tres turnos siguientes a una
  tormenta, y 181 de 201 muertes por energía tenían una tormenta en los seis
  turnos previos. `rollRandomEvents` y `applyRandomEvents` quedan separadas a
  propósito: una tira sin tocar el estado y la otra aplica sin tirar.
- **El pronóstico, en la interfaz.** Se renderiza fuera de `.terminal__screen`
  con su propio `role="status"`, para que un lector de pantalla no lea el parte
  entero dos veces. Anuncia el evento de mayor prioridad —tormenta, meteorito,
  mapache— y cuenta cuántos hay cuando son más de uno.
- **Un fallo al reparar derriba el refugio desde la carga 1.** Antes un fallo no
  tocaba nada y la tirada gastada solo costaba los dos turnos, así que reparar era
  gratis de riesgo y el fallo era un turno perdido en vez de una decisión. La carga
  1 es el turno 10, el primer aviso de escalada, y ese nivel no cambiaba ningún
  modificador. Es la única regla de meseta que sale gratis: solo puede dispararse
  sobre una tirada que ya era un fallo, y la medición de 400 semillas deja la
  mediana de Normal en 119 y el techo en 152, los de antes.
### Removed
- **El rótulo sobre el `Game Over`.** Decía `El último aliento`, o `Fin voluntario`
  si te habías rendido. Se borró al ampliar la pantalla de muerte con el parte: la
  causa y el turno ya estaban dichos más abajo y con más precisión, y rendirse es
  una de las cuatro, así que el dato no hacía falta dos veces. El gesto de rendirse
  se sigue reconociendo, en el mensaje de derrota, que es donde se lee. Encima del
  título solo quedaba una frase que repetía de otra manera lo que ya estaba a la
  vista.
- **La frase de autopsia.** Decía de qué moriste, en qué turno y con qué te
  quedaste, y estaba debajo del `Game Over`. Los tres datos ya están en el parte —
  la causa en el mensaje de derrota, el turno en «Supervivencia» y la comida en
  «Cómo terminaste»— y encima del título lo que funciona es el remate. Se va con
  ella `createAutopsy` entero y el campo `autopsy` del modelo, porque dejarlos
  sería código muerto con tests que no vigilan nada. Lo que explica la muerte es el
  parte.
- **La línea de persecución del banner.** Decía `Aguantados 2 de 118.` o
  `Récord de la sesión superado. Antes morías en el turno 118.`. Se quitó porque
  la tercera cifra del banner **es** el marcador: repetirlo en una frase añadía un
  dato derivado sin información nueva, y encima obligaba a decidir si esa frase
  era una pista o un reproche según lo lejos que fuera el jugador. La cifra se
  queda; la frase no.
- **El turno de la primera vez en cada fila de «Cómo jugaste».** Cada acción
  decía `4 veces · desde el turno 1`. El turno ya lo da el parte, una vez y mejor,
  con el de la última acción estrenada. Repetido en las cinco filas era un índice
  de turnos que no se leía, se recorría. Con él cae `firstTurn` del modelo de uso
  y el `Map` que lo calculaba en `createBreakdown`.

### Changed
- **El panel empieza por la salud.** El orden es salud, energía, hambre y comida, y
  el refugio debajo. La salud abre la lista porque es la única de las cuatro que
  puede acabar con la partida: las otras tres avisan de un problema que aún se
  puede resolver, y esta marca el borde a partir del cual no. La energía y el
  hambre van juntas porque son los dos contadores que se mueven en todos los
  turnos, los que se administran con los botones, y la comida va la última porque
  es la única que acumula en vez de gastarse. El orden vive en `statIds` y la
  terminal lo toma de ahí en vez de recorrer su propia lista, así que la lista de
  cambios de la partida se lee mirando la rejilla de arriba y un cambio de orden en
  el panel no puede dejarlos sin reordenar.
- **El rival fantasma cuenta turnos aguantados, no rondas.** El banner comparaba
  `model.turn` contra la marca y la insignia de récord del parte comparaba
  `turnsSurvived`, que es esa misma cifra menos uno. En la partida que igualaba la
  marca el juego decía «Récord» en el banner y al morir no llevaba «Nuevo récord»:
  dos veredictos opuestos sobre la misma partida, y solo uno cierto. Ahora los dos
  miden lo mismo, que es la medida que se imprime en el informe.
- **La tormenta baja del 10 % al 4 %**, sin tocar el coste de reparación. Apagarla
  entera sacaba la mediana de Agonía de 29 a 44, y el 4 % se queda cerca de ese
  techo. Subir el coste de reparación habría castigado justo a quien ya moría por
  ahí. Medido en el motor real: tormentas por partida de 2.42 a 1.24 y mediana de
  Agonía de 29 a 38, con reparto L1 11.5 % / L2 27.0 % / L3 49.8 % / L4 11.8 %.
- **La tabla de sorteos deja de tener huecos muertos.** Las tres bandas pasan a ser
  contiguas desde el 1: tormenta 1-4, mapache 5-13, meteorito 99. La probabilidad
  conjunta no cambia —4 + 9 + 1—, lo que cambia es dónde estaban.
- **La pantalla de muerte se rehace como el resto del juego.** Negro de punta a
  punta, sin la tarjeta con borde y fondo que la convertía en un panel de
  aplicación, y composición centrada como la del inicio. Encima el rótulo de
  siempre, `Game Over` en rojo de alarma con el halo en rojo sangre, debajo el
  mensaje jocoso de la causa en blanco puro y sin recuadro, y debajo los datos de
  la partida en monoespaciada. El relleno del título va en `--color-alarm` y no en
  `--color-blood` a propósito: sobre negro puro la sangre da 2.02:1 y un título
  grande necesita 3:1, así que en sangre se leería por el halo y no por las
  letras.
### Fixed
- **La mejor partida se guardaba un turno por encima de lo que decía la partida.**
  La marca se calculaba con `state.turn` mientras que el motor announce
  `turn - 1`, así que rendirse en el turno 1 se anunciaba como un turno aguantado
  y a la vez se guardaba como rival de dos. Para el jugador eran dos cifras
  distintas sobre la misma partida, y solo una era cierta. Ahora la cuenta la
  pregunta al motor con `surrenderGame(...).end.turnsSurvived` en vez de repetir la
  regla del contador en la capa de aplicación, que es donde puede volver a
  separarse. Lo encontró un test del rival fantasma.
- **El violeta del hambre se había comido media interfaz.** Al mover el hambre de
  rojo a violeta en `93d4176`, tres cosas que tomaban `--stat-hunger` por ser el
  único rojo que no era `--color-alarm` se llevaron el violeta con ella: el botón
  de rendirse, los cambios de recursos en tono de aviso y el pronóstico del
  turno siguiente. Vuelven al rojo de alarma, el pronóstico deja de hablar con el
  color de un recurso del que no habla, y la fila base de `.stat` pasa a gris
  neutro para que ninguna fila sin modificador herede el tono de otra. Los cinco
  `--stat-*` quedan declarados en `tokens.css` y en el SPEC como de un recurso y
  solo de un recurso.
- **Agonía ya no es cuatro veces más corta que Normal.** La medición cambió el
  diagnóstico: no era aritmética de la escalada sino el impuesto de la tormenta, y
  Agonía no era más corta sino **más variable**. El techo de las dos dificultades
  es el mismo, 152. Apagando los eventos, Agonía da 121 y Normal 119: el hueco
  entero son los eventos.
### Known issues
- **El mapa acumulativo no está.** Es el punto grande de la tanda y el único que
  toca el motor, así que va con medición previa y con permiso explícito antes de
  meter reglas nuevas. Los datos para decidirlo ya están medidos: en Normal no hay
  tormentas, el refugio nunca se pierde y el piloto de referencia jamás repara; en
  Agonía la mediana es el turno 38, muy antes de que la carga 5 llegue en el turno
  70. Es decir, cualquier regla que solo afecte a la carga 5 o superior es código
  muerto para la mitad de las partidas, y ese es el coste de escribirlas.
- **La reproducción no se ve turno a turno.** La fold resuelve la partida entera de
  una vez y aterriza en la pantalla final. Es una limitación consciente: lo que se
  muestra es la partida de verdad, con su parte, pero no se reproduce
  el ritmo. Verla con su ritmo exigiría llevar el estado de cada turno en el
  enlace, y el enlace tiene que ser corto.
- **El rival fantasma se pierde al recargar.** Es lo que lo hace un rival y no un
  récord, y es lo que permite no usar Web Storage. Aun así, quien recargue la
  página pierde la referencia, y no hay forma de recuperarla sin persistir algo.
- **L9 y L10 no son alcanzables, y L5 y L7 no cambian ningún modificador.** No es
  una omisión: la carga es el propio nivel y todos los modificadores son
  `⌊load / k⌋`, así que dividir enteros produce mesetas —con `k = 3`, los niveles
  6, 7 y 8 dan 2, 2 y 2. Se implementaron y midieron reglas para L5 y L7 —desgaste
  del refugio y comida estropeada en las cargas 5 a 8, con periodos de 6 a 30
  turnos, más acaparamiento, curar más caro, reparar más caro y hallazgos secos— y
  **se descartaron**: toda regla que aguanta la partida baja el techo absoluto, y
  el techo es justamente lo que dejaría L9 dentro de alcance. El mejor azar posible
  muere en el turno 152 y el umbral de L9 está en el 162. Rellenar la meseta y
  alcanzar L9 son objetivos que se contradicen con la forma de rampa actual; atacar
  el segundo exige cambiar `threshold(n)`, que es una decisión de alcance. Queda
  registrado como `D-05` en `SPEC-threat.md` y en `docs/fidelity.md`.
- El desgaste del refugio además queda descartado por un motivo propio:
  `repairFailureRadius` se frena en 4, así que en carga alta reparar acierta un
  10 %. Quitarle el refugio a alguien que ya no puede recuperarlo es un tapón, no
  una dificultad. En la carga 5 dio mediana de Normal 85 y techo 121, con el cien
  por cien de las muertes por hambre.


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

### Verification de la tanda de ajustes

- 493 pruebas en verde en 30 archivos. Cobertura global 98.69 % statements, 97.50 %
  branches, 100 % functions y 98.67 % lines. `src/game` y `src/ui` al 100 % en las
  cuatro métricas, con 183 y 113 pruebas, y `src/app` en 97.75/95.93 con 181. Los
  huecos que quedan en `src/app` —`app-keyboard.ts:85`, `game-view-model.ts` y dos
  puntos de rama en `use-game-session.ts`— son anteriores a esta tanda. Bundle de
  80.68 KiB JS gzip y 4.96 KiB CSS gzip.
- Los tres puntos del bloque se comprobaron en su sentido de fallo. La congelación
  por overlay se comprobó de la única forma que se puede: **`use-game-session`
  apaga el atajo cuando hay un overlay puesto**, así que la guarda de
  `performAction` es la segunda red. Se alcanzó por la vía que de verdad la cruza en
  un navegador —el menú es un desplegable pequeño y los botones de acción siguen
  alcanzables por debajo—, y el test pulsa «Explorar» con el menú abierto y
  comprueba que no se resuelve ningún turno. Los ocho comandos del overlay tienen
  sus guardas en `app-reducer`, incluidas las dos que se combinan con
  `surrenderPending` en los dos sentidos.
- La ida y vuelta de los atajos se prueba sobre el alfabeto entero, no sobre una
  copia de las cinco teclas: para cada acción, `shortcutKeyForAction` y
  `shortcutActionForKey` devuelven lo mismo, y para cada letra del alfabeto que
  tenga acción, la vuelta devuelve la misma letra. Además se cuenta que son
  exactamente cinco, que es donde se delataría una sexta acción sin tecla.
- **Lo que la hoja dice no se ha visto en ningún navegador.** No hay navegador de
  escritorio conectado a esta sesión. Que el engranaje quede donde tiene que
  quedar, que el desplegable no se salga por arriba en pantallas estrechas, que la
  hoja se lea entera con la barra fija y que el `+` se vea bien son
  afirmaciones sobre el árbol y el CSS, no sobre lo que se ve. Queda pendiente
  recargar con Ctrl+Shift+R y comprobar, en el mismo sitio donde ya estaba pendiente
  la pantalla de muerte.
- Dos residuos de texto **preexistentes en `HEAD`** y corregidos aquí: `turnola` por
  `turno la` en `use-game-session.ts`, `shattería` por `rompería` en
  `components.css`, y además `se Adds un campo más` en `app-state.test.ts` y un
  `Jugó` en mayúscula en `app-state.ts`. Los cuatro estaban en comentarios, que es
  donde el idioma se cuela sin que nada lo mire.

### Verification de la tanda de semilla y muerte

- 459 pruebas en verde en 27 archivos. Cobertura global 98.42% statements, 97.04%
  branches, 100% functions y 98.39% lines. `src/game` al 100% en las cuatro
  métricas con 183 pruebas, `src/ui` al 100% con 85, y `src/app` en 97.44/95.48 con
  175. Bundle de 78.77 KiB JS gzip y 4.37 KiB CSS gzip.
- Puerta nueva `npm run check:residues`, dentro de `verify`: busca CJK, kana,
  hangul, cirílico y `U+FFFD` en `src/`, `scripts/`, `docs/` y `dist/`. Existe
  porque es un defecto que se ha repetido en varias tandas —escribir en otro
  alfabeto dentro de comentarios en español— y que ni el typecheck ni las pruebas
  ven. Probada en su sentido de fallo: con un ideograma en un `.md` temporal
  devuelve `exit=1` y señala `docs/…md:2 [CJK] U+540C`.
- `seed-url.ts` pasó de 77.77% a 100%. Sus dos guardas `typeof window` no eran
  incobribles: el comentario del archivo de pruebas remitía a una cobertura en
  `App.test.tsx` que allí no existe. Ahora se cubren en su propio archivo bajo el
  entorno `node` de Vitest, que no tiene `window` de verdad, en vez de borrar
  `window` a mano para que la cobertura saliera.
- La insignia de récord se comprobó en su sentido de fallo: sustituida la regla
  por `true`, cinco tests la detectan. El desfase entre banner y parte se comprobó
  volviendo el banner a comparar contra el número de ronda, y lo pillan dos tests
  de dos archivos. Y el error de la marca —un turno de discrepancia entre el
  informe y el rival fantasma— se comprobó deshaciendo el arreglo, y también lo
  pillan dos tests de archivos distintos.
- `?seed=X&d=n&a=<letras>` se comprobó extremo a extremo en el arranque, no solo en
  el códec: enlace completo, semilla suelta, enlace corrupto y enlace que no muere.
- El enlace más largo posible son 152 letras por el techo medido de turnos, más
  unos 30 de parámetros. **No se ha copiado a mano ni enviado por un canal real.**
- Todo lo visual sigue sin comprobarse: no hay navegador de escritorio conectado a
  esta sesión. El parte, el desplegable de compartir, el marcador del rival fantasma,
  que la insignia en dorado se lea discreta y que abrir un enlace no parpadee son
  afirmaciones sobre el árbol y los modelos, no sobre lo que se ve.

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
