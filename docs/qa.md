# Registro de QA final

**Fecha:** 25 de septiembre de 2026
**Alcance:** entrega web estática de *The Last Turn Web* con las reglas de la Fase 1 de supervivencia y la Fase 2 de escalada progresiva

## Estado de este registro

Las tablas de la sección «Comandos automáticos» reflejan el árbol con Fase 2. Las secciones de navegador real y de aceptación pública se realizaron sobre el build `0.1.0`, publicado antes de la Fase 1, y están etiquetadas como tales; la repetición en navegador con el build actual queda registrada como pendiente porque no hay navegador de escritorio conectado a esta sesión.

## Comandos automáticos

| Comprobación | Resultado |
|---|---|
| `npm ci` | Pasa; instalación reproducible sin vulnerabilidades reportadas |
| `npm run typecheck` | Pasa |
| `npm run lint` | Pasa sin warnings |
| `npm run test:coverage` | Pasa; 18 archivos y 256 pruebas; cobertura global 94.04% statements, 87.15% branches, 100% functions, 93.96% lines |
| `npm run test:coverage:scoped` | Pasa; aplica los umbrales de `src/app`, `src/ui` y `src/game` dentro de `verify` |
| `npm run test:coverage -- src\app` | Pasa; cobertura de `src/app` 88.62% statements, 81.03% branches, 100% functions, 88.55% lines (61 pruebas) |
| `npm run test:coverage -- src\game` | Pasa; cobertura de `src/game` 100% en las cuatro métricas (151 pruebas) |
| `npm run test:coverage -- src\ui` | Pasa; cobertura de `src/ui` 100% en las cuatro métricas (28 pruebas) |
| `npm run verify` | Pasa; typecheck, lint, cobertura global, cobertura por capacidad, build y presupuestos |
| `npm run build` | Pasa; bundle estático dentro de presupuesto |
| `npm run check:budget` | Pasa; 75.44 KiB JS gzip (37,7 % de 200 KiB) y 3.01 KiB CSS gzip (6 % de 50 KiB) |
| `npm audit` | 0 vulnerabilidades |

La puerta mide con gzip nivel 9 sobre `dist/assets/` e informa de 75.44 KiB, mientras que Vite imprime su propia cifra para el mismo archivo. La diferencia es esperable y está explicada en `scripts/check-budget.mjs`: ambos ajustan gzip de forma distinta y la puerta aplica siempre su propia medición.

Las puertas se comprobaron además en su sentido de fallo, porque una comprobación que solo pasa no demuestra que bloquee:

| Puerta | Escenario provocado | Resultado |
|---|---|---|
| `test:coverage:scoped` | Una función sin cubrir en `src/game` | Falla con `exit=1`; cobertura al 94,73 % de funciones frente al umbral de 100 % |
| `test:coverage:scoped` | Ámbito mal escrito `src/ap` | Falla con `exit=1` y lista los ámbitos admitidos, en vez de degradar a los umbrales globales |
| `check:budget` | JavaScript de 250 KiB | Falla con `exit=1` nombrando el recurso y el límite superado |
| `check:budget` | `dist/` ausente | Falla con `exit=1` con un mensaje accionable |
| `check:budget` | `dist/assets/` sin `.js` ni `.css` | Falla con `exit=1` en vez de aprobar un presupuesto de 0 bytes |

En todos los casos se restauró el estado y se volvió a comprobar que la puerta pasa con el árbol real.

## Defecto detectado en QA: `D-01`, ya resuelto

La verificación de la Fase 2 encontró un defecto de diseño, no de implementación. Se documenta entero porque alteró el criterio de aceptación de supervivencia indefinida y porque el arreglo cambió números que ya estaban aprobados.

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

### Cobertura de la regresión

Los dos tests que afirmaban el defecto se invirtieron. Ahora `src/game/__tests__/engine.test.ts` exige superar el turno 100 en las dos dificultades y alcanzar el nivel 6, y `src/game/__tests__/threat.test.ts` fija el invariante aritmético que estaba detrás del defecto:

```text
foodRelief(threat) > 1 + extraHungerPerTurn(threat)   para todo threat >= 0
```

Volver a tapar el alivio de la ración rompe ese test antes de que alguien vuelva a morir en el 37.

### Pendiente tras el arreglo

Ninguno en diseño: el defecto está cerrado y medido. Queda pendiente la verificación en navegador real y la autorización de publicación, ambas en la sección final de este registro.

## Navegador real (build 0.1.0, anterior a la Fase 1)

Se comprobó el build servido por `vite preview` en `127.0.0.1` con un perfil aislado de Edge y CDP. El flujo recorrido fue:

`Inicio → Dificultad → Normal → Descansar → Ayuda → recarga → Agonía → muerte → reinicio`.

Resultados observados:

- Pantallas y encabezados correctos; el foco programático queda en el `h1` enfocable al cambiar de pantalla.
- El atajo `?` ejecutó Ayuda; `Tab` alcanzó el botón de Inicio sin perder el orden de foco.
- Anchos comprobados: 320, 360, 768 y 1440 px. No hubo elementos fuera del viewport ni scroll horizontal estable.
- Todos los botones midieron al menos 44 × 44 px.
- `prefers-reduced-motion: reduce` coincidió y la hoja de estilos elimina transiciones y animaciones no esenciales.
- La salud no apareció en el texto de la partida.
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

## Aceptación en la URL pública (build 0.1.0)

La publicación accesible está en `https://the-last-turn.erpro-ferru.workers.dev` y se comprobó con Edge/CDP sobre el build servido por Cloudflare. **Este despliegue es anterior a la Fase 1**: los assets públicos son `assets/index-DWaHKHCl.js` y `assets/index-DutSG5GR.css`, mientras que el build local actual produce `assets/index-D3tQLqmK.js`. La URL pública no incluye todavía comer, la pesca acotada ni el meteorito recuperable.

Aun así se verificó sobre el despliegue:

- Respuesta HTTP 200; `Server: cloudflare` y `CF-Cache-Status: HIT`.
- `index.html` conserva `lang="es"`, título `The Last Turn` y referencias relativas a `./assets/...` y `./favicon.svg`.
- Los tres recursos visuales cargaron con estado 200: JavaScript `244378` bytes, CSS `11416` bytes y favicon `319` bytes.
- La carga inicial realizó 4 peticiones, todas al mismo origen; 0 peticiones a terceros, 0 errores de red, 0 errores de consola y 0 excepciones.
- Flujo verificado: Inicio → Dificultad → Normal → Ayuda → Descansar → Agonía → muerte real → «Volver a jugar».
- La muerte en Agonía se alcanzó por inanición en el turno 5 (10 interacciones de acción); la pantalla final mostró `h1` «La partida ha terminado», el aviso de causa, el foco en `game-over-title` y un único botón «Volver a jugar».
- El reinicio volvió a `screen--difficulty` y una recarga durante la partida volvió a `screen--start`, sin persistencia.
- La auditoría de contraste sobre los 42 nodos de texto visibles en el estado auditado no encontró fallos; la auditoría completa de 64 nodos de las cuatro pantallas está registrada arriba.

**Nota de infraestructura:** la URL disponible termina en `workers.dev`, no en `pages.dev`. Cloudflare sirve correctamente el artefacto estático en ese endpoint, pero si la intención era usar el producto Pages clásico, hay que revisar en el dashboard si el proyecto se creó como Pages o como Workers con Static Assets. No se da por verificado un proyecto Pages clásico mientras la URL no sea `*.pages.dev`.

Las capturas de pantalla de 360, 768 y 1440 px se generaron temporalmente para la inspección y no forman parte del repositorio. La primera versión no incluye E2E automatizado; la comprobación de navegador se mantiene como QA manual reproducible.

## Pendiente para los builds de Fase 1 y Fase 2

Los builds actuales se verificaron con los comandos automáticos de arriba y con una comprobación del artefacto servido: `npm run preview` devuelve 200 para el documento y para los tres recursos. Un barrido de URLs sobre el bundle solo encuentra `http://www.w3.org` (espacio de nombres SVG inerte) y `https://react.dev` (cadena de un mensaje de error de React); no hay peticiones a terceros en runtime.

Queda pendiente, y no se afirma aquí ningún resultado hasta ejecutarlo:

- Recorrido en navegador real de la Fase 1: comer con y sin comida, pesca con seis intentos, meteorito no mortal desde salud inicial, teclado, foco y ausencia de la salud en pantalla.
- Recorrido en navegador real de la Fase 2: aviso de escalada a negro, mensaje en rojo sangre, foco en el diálogo, cierre con click, `Enter` y `Espacio`, atajos inactivos mientras el aviso está abierto, comportamiento en anchos estrechos y con `prefers-reduced-motion`.
- Comprobación de la tabla de modificadores en partida real, no solo en pruebas: que en la carga 10 un turno cueste 6 de hambre, el descanso topa en 2 de energía y la ración quite 9.
- Recorrido largo en partida real: llegar al menos al nivel 3 y ver el aviso tres veces seguidas, para confirmar que el copy cicla y que la escalada se nota.
- Repetición de anchos 320, 360, 768 y 1440 px, objetivos táctiles, movimiento reducido, consola y red sobre los builds actuales.
- Confirmación de infraestructura en el dashboard de Cloudflare: si el proyecto es Pages clásico o Workers con Static Assets, y qué rama produce despliegues.
- Empuje a `origin/main` y redespliegue, que requieren autorización explícita.

`D-01` ya no bloquea la publicación: está resuelto, medido y cubierto por tests.
