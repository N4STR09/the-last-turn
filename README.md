# The Last Turn

Versión web de *The Last Turn* construida con React + Vite + TypeScript. La aplicación parte del prototipo C auditado y aplica explícitamente tres capas: la **supervivencia** (no hay victoria, comer consume una ración y reduce el hambre), la **escalada progresiva de dificultad** (un nivel de amenaza que sube solo con el avance de la partida y que endurece las reglas de forma continua) y el **rediseño de acciones** (cinco acciones con una sola función cada una, la salud como cifra visible y administrable, y la comida convertida en el único recurso con tres sumideros que compiten entre sí: calorías, medicina y reserva).

No hay victoria. La partida siempre termina; la única forma de durar más es aguantar más turnos frente a una escalada que no se detiene. Con juego ordenado en Normal la mediana es el turno 118 y el techo absoluto con el mejor azar posible es el 153, así que la escalada aprieta sin convertirse en un muro.

La aplicación es una web 100 % estática preparada para publicarse en Cloudflare Pages. No tiene backend, cuentas, multijugador, telemetría, persistencia, Web Storage, endpoints ni recursos de terceros en runtime. Una persona jugará abriendo una URL HTTPS, sin instalar ni configurar nada.

## Requisitos de desarrollo

Node.js y npm solo son necesarios para desarrollar o publicar el proyecto; no para jugar.

- Node.js `24.19.0` (rango permitido: `>=24.19.0 <25`)
- npm `11.17.0` (rango permitido: `>=11.17.0 <12`)

## Instalación

```bash
npm ci
```

## Desarrollo

```bash
npm run dev
```

Abre la URL local que indique Vite. Para servir únicamente en la interfaz local:

```bash
npm run dev -- --host 127.0.0.1
```

## Comandos de verificación

```bash
npm run typecheck       # TypeScript estricto
npm run lint            # ESLint sin warnings
npm test                # Suite Vitest + Testing Library
npm run test:coverage   # Cobertura global y umbrales de verify
npm run build           # Build estático de producción
npm run check:budget    # Presupuestos de bundle sobre dist/
npm run verify          # typecheck → lint → cobertura → build → presupuestos
```

`npm run test:coverage -- src/app` ejecuta la cobertura centrada en `src/app`; el wrapper de `scripts/run-coverage.mjs` limita el alcance para que los umbrales de esa tarea midan la capacidad indicada. Sin argumentos, `npm run test:coverage` mide todo `src/` y es el comando que usa `verify`.

`npm run check:budget` mide los archivos de `dist/assets/` ya comprimidos con gzip y falla si se superan los presupuestos de 200 KiB de JavaScript y 50 KiB de CSS. Se ejecuta al final de `verify`, de modo que un bundle que crezca sin control detiene la entrega.

Para servir el resultado de producción:

```bash
npm run preview
```

## Publicación web

El artefacto desplegable es `dist/`. En Cloudflare Pages se debe usar:

- comando de build: `npm run build`;
- directorio de salida: `dist`;
- directorio raíz: el repositorio raíz;
- versión de Node: `.node-version` (`24.19.0`).

La guía completa para integración Git, carga directa, aceptación, rollback y límites de la versión web está en [`docs/deployment.md`](docs/deployment.md). No se ha creado un proyecto remoto ni se ha iniciado ningún despliegue.

## Flujo y controles

1. **Comenzar** abre la selección de dificultad.
2. **Normal** no añade eventos aleatorios; **Agonía** sí.
3. La partida muestra hambre, energía, comida y salud, y debajo el refugio con su estado entero: `Construido` o `Destruido`.
4. Cada acción actualiza la resolución y, cuando corresponde, el turno y los recursos.
5. Al subir la dificultad, la partida se congela a negro con un aviso de escalada. Un click, `Enter` o `Espacio` lo descarta y la partida continúa desde el turno en que estaba, ya con el incremento aplicado.
6. **Rendirse** es la última fila de la rejilla, y no es una acción: no gasta turnos ni tira dados. Pide confirmación, y al confirmar termina la partida. El diálogo cierra con `Escape` o con «Seguir jugando», nunca con un click fuera. No tiene atajo de teclado, a propósito.
7. La pantalla final muestra la causa comunicada, la dificultad y los turnos aguantados. Si te rendiste, el rótulo dice «Fin voluntario» en lugar de «El último aliento». **Volver a jugar** regresa a la selección de dificultad.

Durante la partida también funcionan los atajos `E` (explorar), `C` (comer), `S` (curarse), `D` (descansar) y `R` (reparar), que son las iniciales de los verbos. Los atajos se desactivan fuera de la partida, no interfieren con controles interactivos y quedan inactivos mientras el aviso de escalada o la confirmación de rendirse están abiertos.

## Escalada de dificultad

El nivel de amenaza se deriva del turno y sube solo: el nivel `n` se alcanza en el turno `n² + 9n`, es decir 10, 22, 36, 52, 70, 90, 112, 136, 162, 190… Una acción de varios turnos salta directamente al nivel más alto que ha cruzado y avisa una sola vez.

Los modificadores usan la carga `load = min(threat, 10)`, así que el nivel sigue contando y sigue avisando para siempre, pero la presión mecánica se estabiliza. Con carga 0 el comportamiento es idéntico al de la fase anterior, línea base del prototipo C incluida. Con carga máxima, cada turno cuesta 4 de hambre, el descanso topa en 3 de energía, explorar deja de dar el hallazgo grande casi nunca y solo con la tirada 1, reparar falla en nueve de cada diez intentos, la ración quita 10 de hambre y Agonía hace tres tiradas de evento por turno.

**La ración escala al doble que el hambre.** Comer quita `4 + 2·hambreExtra`, de modo que la holgura por ración crece de 3 a 6 puntos según la carga en vez de quedarse clavada. Esa asimetría es deliberada: si el alivio subiera al mismo ritmo que el gasto, la fracción de turnos que habría que dedicar a comer no bajaría nunca con la escalada, el presupuesto se cerraría solo y la partida dejaría de ser superable por construcción.

**Y curar devuelve exactamente lo que abre explorar.** `cureAmount` es `max(2, exploreWound)`, con paridad exacta. Sin ella, a carga 6 el hallazgo grande daba 4 comidas por 4 de salud y el pequeño 2 por 1: el premio grande salía a la mitad de rinde, y explorar tenía una opción mala.

Las fórmulas exactas, la tabla de modificadores, la aritmética de la válvula de escape y el orden de resolución están en [`SPEC-threat.md`](SPEC-threat.md).

## Qué tan lejos llega una partida

Medido con el motor real sobre 400 semillas, no estimado:

| Medida | Turno |
|---|---:|
| Normal, mediana con juego ordenado | 118 |
| Normal, percentil 90 | 147 |
| Normal, máximo observado | 172 |
| Normal, techo absoluto con el mejor azar posible en cada tirada | **153** |

El primer nivel salta en el turno 10 y el octavo en el 136, así que **los niveles 1 a 8 de la rampa quedan dentro del alcance alcanzable**. El noveno y el décimo empiezan en los turnos 162 y 190, por encima de cualquier ruta medible: es donde el juego pasa de difícil a histórico.

El máximo observado (172) está por encima del techo con el mejor azar (153) y no es una contradicción: el «mejor azar posible» fuerza el hallazgo grande en cada exploración, y el hallazgo grande cuesta entre 2 y 5 de salud. Una partida que juega normal y tiene suerte de vez en cuando vive más que una que acierta el premio grande todas las veces.

**Agonía es mucho más corta:** mediana 31, máximo 57, y 57 % de las muertes por energía. Su fractura estructural —el recargo de energía por evento y la tormenta que anulaba el descanso en el mismo turno— está arreglada, pero el impuesto de la tormenta (10 % por tirada, y reparar cuesta dos turnos) sigue marcando el techo. Se acepta como dificultad y no como defecto; si al jugarlo se lee como un muro, esa decisión hay que revertirla.

## Estructura

```text
src/game/   Motor puro de reglas; no conoce React, CSS ni APIs del navegador.
src/ui/     Componentes y pantallas; reciben modelos de vista y emiten callbacks.
src/app/    App-shell, reducer, navegación, foco, atajos y adaptación de modelos.
scripts/    Utilidades de verificación reproducible.
docs/       Ledger de fidelidad y documentación de la migración.
```

El azar se inyecta en el motor. El adaptador de producción (`browserRandomInt`) usa `Math.random` únicamente en la capa de aplicación; la resolución se ejecuta antes de despachar al reducer, por lo que el reducer permanece puro y compatible con `StrictMode`.

## Fidelidad

Las reglas actuales, la línea base histórica del C y los cambios deliberados de cada fase están registrados en [`docs/fidelity.md`](docs/fidelity.md) y [`SPEC-game-engine.md`](SPEC-game-engine.md). La web no intenta reproducir bit a bit el `rand()` de MinGW: usa enteros nominalmente uniformes con extremos inclusivos y documenta esa diferencia.

La pantalla de escalada usa rojo sangre `#8b0000` sobre negro puro, con 2.10:1 de contraste. Es una desviación consciente y registrada: el tono pedido y un fondo negro puro son incompatibles con el 4.5:1 que exige WCAG AA, y se eligió la estética. La pista «Haz click para continuar...» usa `#7a7a7a` (4.89:1) y sí cumple, porque ahí no había conflicto estético.

## Build web estático

El build se genera en `dist/` y se publica directamente como contenido estático, sin backend ni Pages Functions. La puerta `npm run check:budget` vuelve a comprimir cada archivo de `dist/assets/` con gzip nivel 9 y confirma que el total está dentro de los presupuestos: **76.47 KiB de JavaScript** (38,2 % de 200 KiB) y **3.85 KiB de CSS** (7,7 % de 50 KiB). Vite imprime cifras propias que difieren en unos pocos KiB porque ajusta gzip de forma distinta —para el mismo bundle, 79.28 y 3.95— y la puerta aplica siempre su propia medición. El favicon y todos los recursos visuales se incluyen en el artefacto.

## Alcance de QA

La verificación incluye Vitest, React Testing Library, `typecheck`, ESLint, build y una comprobación en navegador real del flujo, teclado, foco, `360`, `768` y `1440` px, ausencia de scroll horizontal, objetivos táctiles, movimiento reducido, consola y panel de red. El registro reproducible está en [`docs/qa.md`](docs/qa.md). No se incluye E2E automatizado en esta primera versión.
