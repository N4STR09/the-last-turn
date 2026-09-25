# Mapa de capacidades: The Last Turn Web

## Objetivo

Migrar el prototipo C a una aplicación web estática, reproducible y verificable, preparada para publicarse por Internet sin instalación para quien juega. Se conservarán las reglas actuales y los defectos conocidos se registrarán como desviaciones fieles pendientes de mejora posterior.

| ID | Capacidad | Responsabilidad | Depende de |
|---|---|---|---|
| `game-engine` | Motor de reglas | Estado del juego, acciones, turnos, azar, eventos, dificultad y condiciones de fin mediante una interfaz independiente de React y del navegador. | — |
| `web-interface` | Interfaz interactiva | Presentación del estado, controles de acciones, resultados, eventos, dificultad y pantalla final; accesibilidad y adaptación a distintos tamaños de pantalla. | `game-engine` |
| `app-shell` | Experiencia web | Inicio de partida, selección de dificultad, ciclo de vida sin persistencia y conexión entre motor e interfaz. | `game-engine`, `web-interface` |
| `verification` | Calidad verificable | Pruebas del motor, pruebas de componentes, lint, TypeScript, build de producción y comprobación manual en navegador. | `game-engine`, `web-interface`, `app-shell` |

## Límites de responsabilidad

- `game-engine` no importa React, CSS, APIs del navegador ni estado global mutable de componentes.
- `web-interface` no calcula resultados ni modifica directamente el estado interno de una partida.
- `app-shell` coordina el flujo, pero no implementa reglas de juego.
- `verification` valida comportamiento; no contiene lógica de producto para que las pruebas puedan seguir detectando regresiones.

## Decisiones transversales

- React + Vite + TypeScript.
- Aplicación web estática preparada para Cloudflare Pages; quien juega solo abre una URL HTTPS y no instala nada.
- Sin backend, Pages Functions, cuentas, telemetría, guardado ni recursos de terceros en runtime.
- Navegadores modernos, con diseño responsive y accesible.
- Estado de juego explícito y funciones de transición deterministas mediante una fuente de azar inyectable.
- La interfaz muestra la partida; no utiliza `localStorage`, servicios externos ni animaciones que bloqueen la acción.
- Los bugs conocidos de la versión C se conservan durante la migración fiel y quedan registrados para correcciones posteriores.

## Orden de construcción

1. `game-engine`
2. `web-interface`
3. `app-shell`
4. `verification`

La verificación se aplicará de forma continua durante 1–3 y se cerrará como capacidad verificable en 4.

## Especificaciones

- [`game-engine`](SPEC-game-engine.md)
- [`web-interface`](SPEC-web-interface.md)
- [`app-shell`](SPEC-app-shell.md)
- [`verification`](SPEC-verification.md)
