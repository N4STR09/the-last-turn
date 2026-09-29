# The Last Turn

Versión web de *The Last Turn* construida con React + Vite + TypeScript. La aplicación parte del prototipo C auditado y aplica explícitamente tres capas: la **supervivencia** (no hay victoria, comer consume una ración y reduce el hambre), la **escalada progresiva de dificultad** (un nivel de amenaza que sube solo con el avance de la partida y que endurece las reglas de forma continua) y el **rediseño de acciones** (cinco acciones con una sola función cada una, la salud como cifra visible y administrable, y la comida convertida en el único recurso con tres sumideros que compiten entre sí: calorías, medicina y reserva).

No hay victoria. La partida siempre termina; la única forma de durar más es aguantar más turnos frente a una escalada que no se detiene. Con juego ordenado en Normal la mediana es el turno 119 y el techo absoluto con el mejor azar posible es el 152, así que la escalada aprieta sin convertirse en un muro.

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
npm run check:residues  # Barrido de caracteres fuera del alfabeto
npm run verify          # typecheck → lint → cobertura → build → presupuestos → residuos
```

`npm run test:coverage -- src/app` ejecuta la cobertura centrada en `src/app`; el wrapper de `scripts/run-coverage.mjs` limita el alcance para que los umbrales de esa tarea midan la capacidad indicada. Sin argumentos, `npm run test:coverage` mide todo `src/` y es el comando que usa `verify`.

`npm run check:budget` mide los archivos de `dist/assets/` ya comprimidos con gzip y falla si se superan los presupuestos de 200 KiB de JavaScript y 50 KiB de CSS. Se ejecuta al final de `verify`, de modo que un bundle que crezca sin control detiene la entrega.

`npm run check:residues` recorre `src/`, `scripts/`, `docs/` y `dist/` buscando caracteres CJK, cirílicos y el carácter de reemplazo `U+FFFD`, que aparece cuando un texto se escribe en una codificación que no lo soporta. Es una puerta contra un defecto que se ha repetido en varias tandas —escribir en otro alfabeto dentro de comentarios en español— y que ni el typecheck ni las pruebas ven. Falla con `exit=1` y señala archivo, línea y el tipo de carácter.

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
7. Al terminar, la pantalla se queda **negra de punta a punta**, sin tarjeta: un **Game Over** en rojo brillante y, debajo, solo el **mensaje jocoso de la causa**. No hay una frase que explique la muerte: lo que explica es el parte. Siguen los datos de la partida —dificultad, turnos aguantados y la semilla— y dos bloques: **cómo terminaste**, con los cinco recursos en su valor final, y **cómo jugaste**, con las cinco acciones y cuántas veces se usó cada una. Debajo, un botón para compartir la muerte. Si esa partida dejó tu mejor marca de la sesión, aparece **Nuevo récord** en dorado, en pequeño y con la tipografía del resto, justo debajo de los turnos aguantados. No sale en tu primera partida —sin marca previa no hay nada que batir—, el empate no cuenta, y una partida reproducida no puede ser récord porque la muerte es de otra persona. Rendirse no tiene rótulo propio: es una de las cuatro causas, y el mensaje de derrota la reconoce igual. **Volver a jugar** regresa a la selección de dificultad.

Durante la partida también funcionan los atajos `E` (explorar), `C` (comer), `S` (curarse), `D` (descansar) y `R` (reparar), que son las iniciales de los verbos. Los atajos se desactivan fuera de la partida, no interfieren con controles interactivos y quedan inactivos mientras el aviso de escalada o la confirmación de rendirse están abiertos.

## El rival fantasma

El banner lleva una tercera cifra: la mejor partida de esta sesión, en turnos aguantados. Solo aparece cuando ya ha muerto alguna, porque antes de eso no hay nada contra lo que medir. Mientras vas por detrás dice «Tu mejor» y enseña la marca; en cuanto lo superas la cifra pasa a decir «Récord» y enseña la nueva. No hay ninguna frase que te diga cuántos turnos te faltan: el marcador es un número y restar es cosa del jugador. La cuenta va sobre los turnos ya aguantados y no sobre la ronda del banner, que es la que aún no has jugado, porque es la misma medida que usa el «Nuevo récord» del parte de muerte.

Vive solo en memoria: recargar la página lo borra. Es lo que lo hace un rival y no un récord, y es lo que permite no guardar nada. Una partida abierta desde un enlace ajeno no cuenta como tu marca.

## Semillas y enlaces

La barra de direcciones admite tres parámetros:

- `?seed=X` arranca una partida nueva con ese azar, sin más.
- `?seed=X&d=<n|a>&a=<letras>` reproduce una partida entera: semilla en base 36, dificultad (`n` Normal, `a` Agonía) y una letra por turno. Las letras son las de los atajos, en minúscula: `e` explorar, `c` comer, `s` curar, `d` descansar, `r` reparar. Una partida larga son unas 150 letras.

Al morir, la pantalla ofrece **Compartir mi muerte**: un botón que copia el enlace al portapapeles y un desplegable con la URL escrita, por si el portapapeles está bloqueado. Al abrir un enlace, la partida se reproduce de golpe y aparece su pantalla de muerte tal cual, con un aviso de que no la has jugado tú.

Dos partidas con la misma semilla y las mismas acciones producen exactamente la misma partida, con los mismos dados. Un enlace corrupto, o cuya partida no muere, arranca una partida normal: no hay nada que reproducir.

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
| Normal, mediana con juego ordenado | 119 |
| Normal, percentil 90 | 145 |
| Normal, máximo observado | 166 |
| Normal, techo absoluto con el mejor azar posible en cada tirada | **152** |
| Agonía, mediana | 38 |
| Agonía, techo absoluto con el mejor azar posible | **152** |

El primer nivel salta en el turno 10 y el octavo en el 136, así que **los niveles 1 a 8 de la rampa quedan dentro del alcance alcanzable**. El noveno y el décimo empiezan en los turnos 162 y 190, por encima de cualquier ruta medible: es donde el juego pasa de difícil a histórico.

El máximo observado (166) está por encima del techo con el mejor azar (152) y no es una contradicción: el «mejor azar posible» fuerza el hallazgo grande en cada exploración, y el hallazgo grande cuesta entre 2 y 5 de salud. Una partida que juega normal y tiene suerte de vez en cuando vive más que una que acierta el premio grande todas las veces.

**Agonía no es más corta, es más variable.** Su techo medido es el mismo que el de
Normal, 152. Apagando los eventos, Agonía da 121 y Normal 119: el hueco entero son
los eventos, no la aritmética de la escalada. Con la tormenta al 4 % su mediana
pasa de 29 a 38 y las tormentas por partida de 2.42 a 1.24, con reparto L1 11.5 % /
L2 27.0 % / L3 49.8 % / L4 11.8 %.

El motivo por el que era un muro está medido en el orden de resolución: el 52 % de
las partidas de Agonía morían en los tres turnos siguientes a una tormenta, y 181 de
201 muertes por energía tenían una tormenta en los seis turnos previos, porque el
evento caía sobre un turno que el jugador ya había decidido y ya había pagado. Por
eso el azar se adelanta una tirada: se guarda en `pendingEvents` y se aplica al
turno siguiente, de modo que el pronóstico avisa antes de que la persona elija.
**Los niveles 9 y 10 no son alcanzables, y es un problema abierto.** El mejor azar
posible muere en el turno 152, y sus umbrales están en 162 y 190. Además L1, L5 y
L7 no cambian ningún modificador, lo que parece una omisión pero es aritmética: la
carga es el propio nivel y todos los modificadores son `⌊load / k⌋`, así que dividir
enteros produce mesetas —con `k = 3`, los niveles 6, 7 y 8 dan 2, 2 y 2. Se
implementaron y midieron reglas para L5 y L7 y se descartaron: toda regla que
aguanta la partida baja el techo, y el techo es lo que dejaría L9 dentro de
alcance. Rellenar la meseta y alcanzar L9 se contradicen con la forma de rampa
actual. La única que entra es la de la carga 1, un fallo al reparar derriba el
refugio, porque solo puede dispararse sobre una tirada que ya era un fallo y no
cuesta nada medible.

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

El build se genera en `dist/` y se publica directamente como contenido estático, sin backend ni Pages Functions. La puerta `npm run check:budget` vuelve a comprimir cada archivo de `dist/assets/` con gzip nivel 9 y confirma que el total está dentro de los presupuestos: **78.77 KiB de JavaScript** (39,4 % de 200 KiB) y **4.37 KiB de CSS** (8,7 % de 50 KiB). Vite imprime cifras propias que difieren en unos pocos KiB porque ajusta gzip de forma distinta, y la puerta aplica siempre su propia medición. El favicon y todos los recursos visuales se incluyen en el artefacto.

## Alcance de QA

La verificación incluye Vitest, React Testing Library, `typecheck`, ESLint, build y una comprobación en navegador real del flujo, teclado, foco, `360`, `768` y `1440` px, ausencia de scroll horizontal, objetivos táctiles, movimiento reducido, consola y panel de red. El registro reproducible está en [`docs/qa.md`](docs/qa.md). No se incluye E2E automatizado en esta primera versión.
