# Changelog

## [Unreleased]

### Added

- **Escalada progresiva de dificultad.** El estado de partida lleva un nivel de
  amenaza derivado del turno: el nivel `n` se alcanza en el turno `n² + 9n`
  (10, 22, 36, 52, 70, 90, 112, 136, 162, 190…). Una acción multiturno salta al
  nivel más alto cruzado y emite un único aviso.
- **Pantalla de aviso bloqueante.** Al subir la dificultad la partida se congela
  a negro y aparece el nivel, un mensaje jocoso en rojo sangre y la pista
  «Haz click para continuar...». Se descarta con click en cualquier sitio,
  `Enter` o `Espacio`, y mientras está abierto los atajos de acciones no actúan.
- **Siete modificadores de carga** que escalan con `load = min(threat, 10)`:
  hambre por turno, **alivio de la ración**, tope de energía al descansar,
  tiradas de evento extra en Agonía, éxito al buscar comida, radio de fallo al
  reparar y turnos de reparación. Con carga 0 reproducen exactamente la Fase 1.
- **Severidad por carga** en tormenta y mapache, sin cambiar la tabla de sorteos
  1..100. La tabla de eventos se mantiene en tres tipos.
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
  y las acciones debajo, sin descriptions.
- **Barras de recursos por bloques.** Un bloque encendido por unidad, hasta doce.
  Por encima la barra satura y la cifra sigue siendo la verdad. El refugio es
  binario y usa un solo bloque.
- **Gasto por acción impreso en el botón.** Hambre y energía se gastan por turno,
  no por acción, así que la etiqueta se calcula contra la escalada vigente. La
  ayuda no gasta; las acciones simples imprimen su cifra exacta; reparar imprime
  la suya, que sube con el nivel; y pescar imprime su peor caso, porque su coste
  es azar y un rango fijo mentiría en la mitad de las partidas.
- **Calavera de fondo en el registro del turno**, en SVG en línea y decorativa. En
  Agonía lleva cuernos y los ojos cambian a rojo con aura. Es la única
  representación de la dificultad dentro de la partida, así que el banner ya no
  la repite.
- **Aviso de estado en las barras.** Un recurso en punto crítico late en rojo a
  0.55 Hz, muy por debajo del umbral de 3 destellos de WCAG 2.3.1, y con
  `prefers-reduced-motion` se queda en rojo fijo. El aviso crítico es un campo
  explícito y no coincide con `tone === 'warning'`: quedarse sin refugio es una
  advertencia, no una muerte, y una fila que latiera desde el primer turno sería
  ruido.
- Fase 1 de supervivencia: comer consume una ración, reduce el hambre y recupera salud; la pesca termina tras seis intentos como máximo; el meteorito quita un punto de salud en lugar de matar desde salud inicial.
- La interfaz comunica las nuevas resoluciones sin mostrar la salud.
- `docs/fidelity.md` y `SPEC-game-engine.md` separan la línea base histórica del C de las desviaciones explícitas de la Fase 1 y de la Fase 2.

### Removed

- **Los hitos 15 y 30 y su penalización.** La escalada progresiva los absorbe.
  Esto retira el compromiso de fidelidad de `SPEC-infinite-survival.md` y es una
  decisión de Fase 2, no una corrección silenciosa.
- El decaimiento pasivo de la salud, que se decidió no introducir: con la salud
  oculta, un desgaste silencioso sería ilegible.
- Las descripciones largas de los botones de acción y los encabezados de sección.
  El texto se suprime y la información que no cabe en la etiqueta se calcula y se
  imprime en el sitio donde se necesita.

### Fixed

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

- `GameResolution.randomEvent` pasa a ser `randomEvents: readonly GameEvent[]`.
- `GameResolution.milestone` pasa a ser `threatNotice: ThreatNotice | null`, y
  `Milestone` se elimina del contrato público.
- `energyRecovered` pasa de `3 | 5` a `number`, porque el tope de energía al
  descansar depende de la carga.
- `ResourceViewModel` añade `units`, `capacity` y `critical`, que son lo que
  dibuja la barra y decide el aviso.
- `GameViewModel` añade `threat` y `actions`. `actions` mueve las etiquetas y el
  gasto de los botones a la capa de aplicación, donde vive el texto.
- `ResolutionPanel` recibe `turn` y `difficulty`, porque la terminal imprime la
  ronda en el prompt y decide la variante de la calavera.
- `ResolutionViewModel.events` es una lista. Con tiradas extra el mismo evento
  puede repetirse en un turno, así que `event` singular ya no alcanza.

### Verification

- 290 pruebas en verde. Cobertura global 94.95% statements, 88.96% branches, 100%
  functions y 94.88% lines. `src/game` y `src/ui` al 100% en las cuatro métricas.
  Bundle de 76.13 KiB JS gzip y 3.48 KiB CSS gzip.
- Contraste medido sobre el fondo de página `#050706`: texto `#b9c4bd` 11.25:1,
  apagado `#93a09a` 7.44:1, pista `#7a7a7a` 4.71:1, blanco 20.20:1. Recursos:
  hambre `#ff5f4d` 6.73:1, energía `#ffd166` 14.01:1, comida `#7ee08a` 12.43:1,
  refugio `#5ec8f5` 10.64:1. Todos AA o mejor.
- Geometría de la calavera comprobada numéricamente sobre el PNG rasterizado:
  0.00% de asimetría horizontal en las dos variantes, silueta dentro del lienzo, y
  en Agonía 9 px más alta por los cuernos. **No se ha visto la imagen**: el
  aspecto queda pendiente de navegador real.
- La aceptación en navegador del despliegue sigue pendiente: no hay navegador de
  escritorio conectado a la sesión, así que el aviso de escalada, el foco, el
  cierre con teclado, los anchos estrechos y el aspecto de la calavera no están
  verificados sobre la URL pública.
- **Publicado en `https://the-last-turn.erpro-ferru.workers.dev`** con el commit
  `4e6d856`, que incluye la Fase 1 y la Fase 2. Cloudflare compiló desde `main` de
  forma automática. El bundle servido (`index-CLf495kK.js`, 248 053 bytes) coincide
  byte a byte con el build local, y el copy de escalada está dentro del artefacto.
  **El rediseño de esta entrada todavía no está desplegado.**

### Known issue

Ninguno conocido. El defecto `D-01` que se detectó durante esta fase está
resuelto y medido; el detalle está en `SPEC-threat.md` y en `docs/qa.md`.

Para quien lea el historial: `D-01` era que la escalada de hambre hacía la
partida insuperable. La ruta renewable evidente moría en el **turno 37** y una
búsqueda exhaustiva sobre las siete acciones con el mejor azar posible fijaba el
techo absoluto en el **turno 50**, con el nivel 4 empezando en el 52, de modo que
los niveles 4 a 10 nunca aparecían. La causa era que la ración quitaba 4 fijos
mientras el hambre del turno subía hasta 6. Con el alivio escalado el techo
absoluto sube a **191** y la rampa de niveles 1 a 10 queda entera dentro del
alcance, aunque el techo práctico con juego ordenado es 103. Los dos tests que
afirmaban el defecto se invirtieron y ahora exigen superar el turno 100.

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
