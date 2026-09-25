# The Last Turn

Migración local de *The Last Turn* a React + Vite + TypeScript. La aplicación reproduce las reglas del prototipo C auditado y conserva también sus defectos deliberados: no hay victoria, la salud no se muestra, comer no reduce el hambre y la partida termina únicamente por las condiciones del modelo.

La primera versión es completamente local. No tiene backend, cuentas, multijugador, telemetría, persistencia, Web Storage, endpoints ni recursos de red.

## Requisitos

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
npm run verify          # typecheck → lint → cobertura → build
```

`npm run test:coverage -- src/app` ejecuta la cobertura centrada en `src/app`; el wrapper de `scripts/run-coverage.mjs` limita el alcance para que los umbrales de esa tarea midan la capacidad indicada. Sin argumentos, `npm run test:coverage` mide todo `src/` y es el comando que usa `verify`.

Para servir el resultado de producción:

```bash
npm run preview
```

## Flujo y controles

1. **Comenzar** abre la selección de dificultad.
2. **Normal** no añade eventos aleatorios; **Agonía** sí.
3. La partida muestra hambre, energía, comida y refugio. La salud permanece oculta.
4. Cada acción actualiza la resolución y, cuando corresponde, el turno y los recursos.
5. La pantalla final muestra la causa comunicada, la dificultad y los turnos aguantados. **Volver a jugar** regresa a la selección de dificultad.

Durante la partida también funcionan los atajos `B` (buscar), `D` (descansar), `E` (explorar), `R` (fabricar o reparar), `P` (pescar), `C` (comer) y `?` (ayuda). Los atajos se desactivan fuera de la partida y no interfieren con controles interactivos.

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

Las reglas y los defectos intencionales están registrados en [`docs/fidelity.md`](docs/fidelity.md). La web no intenta reproducir bit a bit el `rand()` de MinGW: usa enteros nominalmente uniformes con extremos inclusivos y documenta esa diferencia.

## Build local

El build se genera en `dist/` y no debe desplegarse con un backend. En la verificación actual el bundle inicial mide aproximadamente **77.02 KiB JS gzip** y **2.83 KiB CSS gzip**, dentro de los presupuestos de 200 KiB y 50 KiB respectivamente. El favicon y todos los recursos visuales son locales.

## Alcance de QA

La verificación incluye Vitest, React Testing Library, `typecheck`, ESLint, build y una comprobación en navegador real del flujo, teclado, foco, `360`, `768` y `1440` px, ausencia de scroll horizontal, objetivos táctiles, movimiento reducido, consola y panel de red. El registro reproducible está en [`docs/qa.md`](docs/qa.md). No se incluye E2E automatizado en esta primera versión.
