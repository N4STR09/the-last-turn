# Especificación: `app-shell`

## Objetivo

Conectar el motor y la interfaz para proporcionar una experiencia web completa: inicio, selección de dificultad, partida, acciones, resultado y reinicio, sin persistencia ni servicios externos. El mismo build se publicará como web estática por HTTPS sin instalación para quien juega.

## Flujo de pantallas

```text
start → difficulty → playing → dead → difficulty
```

- `start`: presentación y botón “Comenzar”.
- `difficulty`: Normal o Agonía.
- `playing`: recursos, resolución y acciones.
- `dead`: causa comunicada, turnos aguantados y reinicio.

Recargar la página vuelve a `start`.

## Responsabilidades

- Mantener el estado de navegación de la aplicación.
- Crear el estado inicial al elegir dificultad.
- Adaptar la fuente de azar del navegador al contrato `RandomInt`.
- Resolver una acción fuera del reducer y despachar su resultado ya calculado.
- Construir view models para la interfaz.
- Reiniciar de forma limpia una partida terminada.
- Gestionar atajos de teclado equivalentes a los botones.
- Mover el foco al encabezado de cada pantalla.

No implementará reglas ni guardará la partida.

## Estado de aplicación

El estado se modelará como una unión discriminada para impedir combinaciones inválidas:

```ts
export type AppState =
  | {
      readonly screen: 'start' | 'difficulty';
      readonly game: null;
      readonly resolution: null;
    }
  | {
      readonly screen: 'playing';
      readonly game: PlayingGameState;
      readonly resolution: GameResolution | null;
    }
  | {
      readonly screen: 'dead';
      readonly game: FinishedGameState;
      readonly resolution: GameResolution;
    };
```

Comandos del reducer:

```ts
export type AppCommand =
  | { readonly type: 'show-difficulty' }
  | { readonly type: 'start-game'; readonly game: PlayingGameState }
  | { readonly type: 'resolve-action'; readonly resolution: GameResolution }
  | { readonly type: 'restart' };
```

El reducer será puro. No llamará `Math.random`, `Date`, APIs del DOM ni `resolveTurn`.

- `show-difficulty` pasa de inicio a selección.
- `start-game` almacena el estado inicial y entra en juego.
- `resolve-action` almacena la resolución y elige `playing` o `dead` según `resolution.state.status`.
- `restart` descarta partida y resolución, y vuelve a dificultad.

No habrá un comando `finish-game` independiente: la finalización forma parte de la transición ya resuelta.

## Integración con React

Se usará `useReducer` para coordinar explícitamente el flujo, siguiendo la recomendación de React para lógica de estado compleja. La fuente de azar y `resolveTurn` se ejecutarán en el manejador del evento antes de despachar `resolve-action`.

Motivo: React exige que los reducers sean puros y, en modo estricto, puede invocarlos más de una vez durante desarrollo. Generar azar dentro del reducer podría consumir valores distintos durante una comprobación y producir estados impredecibles.

Fuente oficial: https://react.dev/reference/react/useReducer

## Adaptador de azar

```ts
export function browserRandomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
```

El adaptador pertenece a la aplicación, no a `src/game/`. Se documentará que la web no reproduce una semilla de `time()` ni el sesgo de `rand() % n` del C.

## Atajos de teclado

- Se registrarán únicamente durante la partida.
- `B/D/E/R/P/C` activan la acción correspondiente.
- `?` activa Ayuda.
- Se ignorarán `event.repeat`, `Ctrl`, `Alt` y `Meta`.
- Se ignorarán eventos originados en `input`, `textarea`, `select`, `button`, `a` o elementos `contenteditable` para evitar duplicar la activación de un control.
- No se registrarán en Inicio, Dificultad o Fin de partida.
- Los botones seguirán siendo la vía principal y accesible.

Los atajos reproducen las letras del prototipo y no añaden reglas.

## Gestión de foco

Al entrar en cada pantalla, el foco se moverá a su encabezado principal mediante una ref. Esto hace que el cambio de pantalla y la derrota sean anunciables sin usar dos regiones `alert` superpuestas.

## Reinicio

“Volver a jugar” debe:

1. Descartar `GameState` y la resolución anterior.
2. Volver a la pantalla de dificultad.
3. Crear un estado nuevo cuando se seleccione una dificultad.
4. No conservar una semilla o secuencia aleatoria anterior.

No habrá persistencia. Recargar el documento produce el estado inicial de `start`.

## Estructura prevista

```text
src/app/
  App.tsx
  app-state.ts
  app-reducer.ts
  use-game-session.ts
  browser-random.ts
  game-view-model.ts
  app-keyboard.ts
  screen-focus.ts
  __tests__/

src/main.tsx
src/styles/app.css
```

## Estrategia de pruebas

React Testing Library y Vitest comprobarán:

- El flujo inicio → dificultad → partida.
- Normal y Agonía crean estados distintos.
- Una acción despacha un resultado calculado una sola vez.
- Una resolución terminal cambia a la pantalla final.
- Reiniciar elimina partida y resolución anteriores.
- Una nueva renderización después de recarga comienza en Inicio.
- El adaptador devuelve enteros inclusivos para valores de `Math.random` dentro de `[0, 1)`.
- El reducer no llama a la fuente de azar ni a `resolveTurn`.
- Los atajos se activan, ignoran repetición, modificadores, foco interactivo y pantallas no compatibles.
- El foco se mueve al cambiar de pantalla.

Comandos previstos:

```text
npm run test -- src/app
npm run test:coverage -- src/app
npm run typecheck
npm run lint
```

## Límites

- Siempre: mantener el motor como única fuente de reglas.
- Siempre: resolver el azar antes de despachar una transición ya calculada.
- Siempre: retirar atajos en pantallas que no los soportan.
- Siempre: comprobar que una partida nueva no hereda estado ni resolución.
- Preguntar antes: añadir React Router, un store global, persistencia, telemetría o una dependencia de estado.
- Nunca: llamar `localStorage`, `sessionStorage`, cookies ni una API durante el inicio.
- Nunca: guardar decisiones de reglas en componentes visuales.
- Nunca: mutar `GameState` desde un componente.

## Criterios de éxito

- El ciclo completo funciona desde una página recién cargada.
- No hay estado residual entre partidas.
- El motor se invoca una vez por acción, incluso en modo estricto de React.
- No hay errores de consola durante inicio, selección, acciones, muerte y reinicio.
- Recargar reinicia la experiencia de forma predecible.
- La capa de aplicación no contiene reglas de juego.

## Preguntas abiertas

Ninguna para esta capacidad.
