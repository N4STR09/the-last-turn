# Registro de QA final

**Fecha:** 25 de septiembre de 2026
**Alcance:** primera entrega web estática de *The Last Turn Web*

## Comandos automáticos

| Comprobación | Resultado |
|---|---|
| `npm ci` | Pasa; instalación reproducible sin vulnerabilidades reportadas |
| `npm run typecheck` | Pasa |
| `npm run lint` | Pasa sin warnings |
| `npm run test:coverage` | Pasa; 15 archivos y 149 pruebas; cobertura global 90.34% statements, 82.53% branches, 100% functions, 90.31% lines |
| `npm run test:coverage:scoped` | Pasa; aplica los umbrales de `src/app`, `src/ui` y `src/game` dentro de `verify` |
| `npm run test:coverage -- src\app` | Pasa; cobertura de `src/app` 83.44% statements, 73.85% branches, 100% functions, 83.33% lines |
| `npm run test:coverage -- src\game` | Pasa; cobertura de `src/game` 100% en las cuatro métricas |
| `npm run test:coverage -- src\ui` | Pasa; cobertura de `src/ui` 100% en las cuatro métricas |
| `npm run verify` | Pasa; typecheck, lint, cobertura global, cobertura por capacidad, build y presupuestos |
| `npm run build` | Pasa; bundle estático dentro de presupuesto |
| `npm run check:budget` | Pasa; 74.30 KiB JS gzip (37,2 % de 200 KiB) y 2.77 KiB CSS gzip (5,5 % de 50 KiB) |
| `npm audit` | 0 vulnerabilidades |

Las puertas se comprobaron además en su sentido de fallo, porque una comprobación que solo pasa no demuestra que bloquee:

| Puerta | Escenario provocado | Resultado |
|---|---|---|
| `test:coverage:scoped` | Una función sin cubrir en `src/game` | Falla con `exit=1`; cobertura al 94,73 % de funciones frente al umbral de 100 % |
| `test:coverage:scoped` | Ámbito mal escrito `src/ap` | Falla con `exit=1` y lista los ámbitos admitidos, en vez de degradar a los umbrales globales |
| `check:budget` | JavaScript de 250 KiB | Falla con `exit=1` nombrando el recurso y el límite superado |
| `check:budget` | `dist/` ausente | Falla con `exit=1` con un mensaje accionable |
| `check:budget` | `dist/assets/` sin `.js` ni `.css` | Falla con `exit=1` en vez de aprobar un presupuesto de 0 bytes |

En todos los casos se restauró el estado y se volvió a comprobar que la puerta pasa con el árbol real.

## Navegador real

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

## Comprobación adicional del artefacto web

Se volvió a servir el build de producción con `vite preview` en `127.0.0.1:4175` y se inspeccionó con Edge/CDP:

- `dist/index.html` referencia `./assets/...` y `./favicon.svg`; los cuatro recursos cargaron con estado 200.
- El borde computado de `.button--quiet` fue `rgb(98, 117, 104)` y obtuvo una relación de contraste calculada de 3.49:1 frente a la superficie base.
- Los tamaños de ventana 320, 360, 768 y 1440 px no produjeron elementos fuera del viewport; el botón más pequeño medió al menos 134.25 × 76 px.
- Consola y excepciones: 0; en esta carga inicial fueron 4 peticiones (documento, CSS, JS y favicon), todas al mismo origen y ninguna a terceros.
- Los bordes de las tarjetas informativas que no son controles permanecen sutiles; la legibilidad y la estructura los identifican sin depender del color, mientras que los bordes de controles mantienen el contraste de 3:1.

## Auditoría de contraste WCAG 1.4.3

Se recorrieron las cuatro pantallas en `1440 × 1000` y se midió cada nodo de texto contra el fondo efectivo, compositando la cadena de ancestros hasta el primer fondo opaco. El umbral aplicado fue 4.5:1 para texto normal y 3:1 para texto grande (>= 24 px, o >= 18.66 px en negrita).

| Pantalla | Nodos de texto | Fallos |
|---|---:|---:|
| Inicio | 5 | 0 |
| Dificultad | 12 | 0 |
| Partida | 39 | 0 |
| Fin de partida | 8 | 0 |
| **Total** | **64** | **0** |

La muerte se alcanzó de forma real en Agonía por inanición tras 10 turnos: la pantalla final mostró `h1` «La partida ha terminado», el aviso de causa, «Dificultad Agonía / Supervivencia 10 turnos aguantados», el foco en `game-over-title` y un único botón «Volver a jugar», que devolvió a `screen--difficulty` sin conservar la partida. Consola y excepciones: 0.

## Comprobación en subdirectorio

El build se copió a un host estático estricto, sin fallback de SPA, y se sirvió en `http://127.0.0.1:4180/juego/`:

- `./favicon.svg` y `./assets/...` resolvieron a `/juego/favicon.svg` y `/juego/assets/...`, con estado 200.
- La aplicación montó, mostró `h1` «The Last Turn» y el botón «Comenzar»; al pulsarlo pasó a «Elige dificultad», lo que confirma que React es interactivo bajo subdirectorio.
- 0 peticiones a terceros, 0 errores de consola, 0 excepciones.

Esto confirma que `base: './'` funciona tanto en la raíz de un dominio como en un subdirectorio, que es el motivo de esa configuración.

Esta comprobación valida el artefacto que se entregaría a Cloudflare Pages, no una URL pública: todavía no se ha creado ni desplegado un proyecto remoto.

Las capturas de pantalla de 360, 768 y 1440 px se generaron temporalmente para la inspección y no forman parte del repositorio. La primera versión no incluye E2E automatizado; la comprobación de navegador se mantiene como QA manual reproducible.
