# Tareas: The Last Turn Web

## Tarea 1: Inicializar Git y línea base

**Descripción:** Convertir el proyecto aprobado en un repositorio limpio y versionar la documentación sin mezclar los fuentes C.

**Criterios de aceptación:**
- [x] El repositorio usa la rama `main` y contiene las especificaciones aprobadas.
- [x] `CAPABILITIES.md` enlaza las cuatro especificaciones.
- [x] No se copia el ejecutable ni código C al proyecto.
- [x] No hay secretos ni artefactos generados.

**Verificación:**
- [x] `git status --short` solo contiene cambios intencionados.
- [x] `git log --oneline` muestra un commit inicial atómico.

**Dependencias:** Ninguna.

**Archivos probables:**
- `CAPABILITIES.md`
- `SPEC-*.md`
- `tasks/*.md`

**Alcance:** S.

## Tarea 2: Crear scaffold y toolchain

**Descripción:** Inicializar React + Vite + TypeScript y la barrera de calidad sin implementar todavía reglas ni UI final.

**Criterios de aceptación:**
- [x] `package.json` contiene versiones exactas y los scripts aprobados.
- [x] TypeScript estricto incluye `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- [x] Vitest, React Testing Library, cobertura y ESLint están configurados.
- [x] `.gitignore` excluye `node_modules`, `dist` y cobertura.

**Verificación:**
- [x] `npm ci` termina correctamente.
- [x] `npm run typecheck` pasa.
- [x] `npm run lint` pasa sin warnings.
- [x] `npm run test` pasa.
- [x] `npm run build` pasa.

**Dependencias:** Tarea 1.

**Archivos probables:**
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig*.json`
- `eslint.config.js`
- `.gitignore`
- `index.html`
- `src/main.tsx`

**Alcance:** M.

## Checkpoint A: Cadena de herramientas

- [x] Instalación limpia reproducible.
- [x] TypeScript, ESLint, pruebas y build pasan.
- [x] Configuración versionada sin artefactos generados.

## Tarea 3: Definir contratos y ledger del motor

**Descripción:** Crear los contratos TypeScript, el estado inicial y el registro de fidelidades antes de implementar transiciones.

**Criterios de aceptación:**
- [x] `PlayingGameState` y `FinishedGameState` son internamente consistententes.
- [x] `createGame` devuelve siempre una partida activa con los valores iniciales del C.
- [x] `docs/fidelity.md` contiene `F-01…F-11` y `W-01…W-04`.
- [x] `src/game/` no importa React, CSS ni APIs del navegador.

**Verificación:**
- [x] `npm run test -- src/game` pasa.
- [x] `npm run typecheck` pasa.

**Dependencias:** Tarea 2.

**Archivos probables:**
- `docs/fidelity.md`
- `src/game/types.ts`
- `src/game/initial-state.ts`
- `src/game/index.ts`
- `src/game/__tests__/initial-state.test.ts`

**Alcance:** M.

## Tarea 4: Implementar acciones con TDD

**Descripción:** Portar las siete acciones, tiradas y costes del C sin añadir correcciones.

**Criterios de aceptación:**
- [x] Cada resultado de acción tiene pruebas y 100% de cobertura para `src/game/actions.ts` y `src/game/random.ts`.
- [x] Descansar con y sin refugio consume las tiradas correctas.
- [x] Explorar cubre 1–4, 5–15 y 16–20.
- [x] Reparar falla únicamente con 5.
- [x] Pescar termina cuando obtiene 1 y mantiene la tirada hasta 3.
- [x] Comer conserva la rama inalcanzable de `food < 0` sin modificar comida.
- [x] El estado de entrada no se muta.

**Verificación:**
- [x] Se observa RED antes de cada implementación.
- [x] `npm run test -- src/game` pasa.
- [x] `npm run test:coverage -- src/game` pasa.

**Dependencias:** Tarea 3.

**Archivos probables:**
- `src/game/random.ts`
- `src/game/actions.ts`
- `src/game/__tests__/actions.test.ts`
- `src/game/__tests__/test-random.ts`

**Alcance:** M.

## Tarea 5: Implementar eventos, dificultad y fin

**Descripción:** Portar eventos, hitos, penalizaciones y las dos causas de muerte observables.

**Criterios de aceptación:**
- [x] Tormenta cubre 1–10, mapache 51–59 y meteorito 99.
- [x] Normal no consume RNG de evento; Agonía consume uno por resolución.
- [x] Los hitos exactos 15 y 30 y las penalizaciones `>15` y `>30` se aplican en ambas dificultades.
- [x] Una acción multiturno no repite penalizaciones por turnos saltados.
- [x] `condition` y `reportedCause` reproducen las precedencias diferentes del C.
- [x] Meteorito termina la partida mediante salud.

**Verificación:**
- [x] `npm run test -- src/game` pasa.
- [x] `npm run typecheck` pasa.
- [x] No se ejecutan secuencias de pesca infinitas.

**Dependencias:** Tarea 3.

**Archivos probables:**
- `src/game/events.ts`
- `src/game/difficulty.ts`
- `src/game/end-state.ts`
- `src/game/__tests__/pipeline.test.ts`

**Alcance:** M.

## Tarea 6: Completar API y cobertura del motor

**Descripción:** Orquestar la transición completa y endurecer el contrato público antes de conectar React.

**Criterios de aceptación:**
- [x] `resolveTurn` no acepta partidas terminadas.
- [x] Valida que cada resultado RNG sea entero y esté dentro del intervalo.
- [x] Ordena acción → evento → dificultad → fin.
- [x] No muta estado ni resultados previos.
- [x] `src/game/` alcanza 100% en statements, branches, functions y lines.

**Verificación:**
- [x] `npm run test:coverage -- src/game` pasa umbrales.
- [x] `npm run typecheck` pasa.
- [x] `npm run lint` pasa sin warnings.
- [x] `npm run build` pasa.

**Dependencias:** Tareas 4 y 5.

**Archivos probables:**
- `src/game/engine.ts`
- `src/game/index.ts`
- `src/game/__tests__/engine.test.ts`

**Alcance:** M.

## Checkpoint B: Motor

- [x] Instalación limpia reproducible.
- [x] Suite del motor completa.
- [x] Cobertura del motor al 100%.
- [x] Ledger de fidelidad revisado.
- [x] Commit de motor verificado.

## Tarea 7: Implementar Inicio y Dificultad

**Descripción:** Construir las dos primeras pantallas con componentes semánticos y callbacks.

**Criterios de aceptación:**
- [x] Inicio explica que la partida no se guarda.
- [x] Normal y Agonía explican que solo Agonía añade eventos aleatorios.
- [x] Ambas dificultades mencionan los hitos compartidos 15/30.
- [x] La selección funciona con teclado y puntero.
- [x] Cada pantalla tiene un único `h1` enfocable.

**Verificación:**
- [x] `npm run test -- src/ui` pasa.
- [x] `npm run typecheck` pasa.

**Dependencias:** Tarea 6.

**Archivos probables:**
- `src/ui/screens/StartScreen.tsx`
- `src/ui/screens/DifficultyScreen.tsx`
- `src/ui/components/DifficultyCard.tsx`
- `src/ui/__tests__/screens.test.tsx`

**Alcance:** M.

## Tarea 8: Implementar presentación de partida

**Descripción:** Crear recursos, resolución, acciones y pantalla de juego a partir de modelos de vista.

**Criterios de aceptación:**
- [x] Se muestran hambre, energía, comida y refugio con texto; no se muestra salud.
- [x] La resolución muestra acción, evento opcional e hito opcional en orden.
- [x] Los siete botones emiten la acción correcta.
- [x] La región de resolución se anuncia con `aria-live="polite"` y es atómica.
- [x] No se importa lógica del motor en componentes.

**Verificación:**
- [x] `npm run test -- src/ui` pasa.
- [x] `npm run lint` pasa sin warnings.

**Dependencias:** Tarea 7.

**Archivos probables:**
- `src/ui/screens/GameScreen.tsx`
- `src/ui/components/ResourcePanel.tsx`
- `src/ui/components/ResolutionPanel.tsx`
- `src/ui/components/ActionGrid.tsx`
- `src/ui/__tests__/game-screen.test.tsx`

**Alcance:** M.

## Tarea 9: Implementar fin de partida y sistema visual

**Descripción:** Añadir pantalla final, botón compartido, tokens y estilos responsive accesibles.

**Criterios de aceptación:**
- [ ] Fin de partida muestra la causa comunicada y los turnos aguantados.
- [ ] El botón reinicio emite un único callback.
- [ ] Los colores cumplen los contrastes definidos.
- [ ] No hay desplazamiento horizontal entre 320 y 1440 px.
- [ ] Movimiento reducido elimina animaciones no esenciales.
- [ ] Los objetivos interactivos miden al menos 44 × 44 px.

**Verificación:**
- [ ] `npm run test -- src/ui` pasa.
- [ ] Inspección en navegador a 360, 768 y 1440 px.
- [ ] Navegación por teclado sin pérdida de foco.

**Dependencias:** Tarea 8.

**Archivos probables:**
- `src/ui/screens/GameOverScreen.tsx`
- `src/ui/components/AppButton.tsx`
- `src/ui/styles/tokens.css`
- `src/ui/styles/components.css`
- `src/ui/styles/screens.css`
- `src/styles/app.css`

**Alcance:** M; revisión visual y funcional en una sola tarea.

## Checkpoint C: Interfaz

- [ ] Cuatro pantallas renderizadas.
- [ ] Pruebas semánticas de UI pasan.
- [ ] Teclado y foco verificados.
- [ ] Responsive revisado en navegador.

## Tarea 10: Implementar estado de aplicación

**Descripción:** Crear unión de pantallas, reducer puro y fuente aleatoria del navegador.

**Criterios de aceptación:**
- [x] La unión impide partida nula en playing/dead o resolución nula en dead.
- [x] El reducer elige la pantalla según el estado resuelto.
- [x] Reiniciar descarta partida y resolución.
- [x] El reducer no llama a azar, fecha o motor.
- [x] `browserRandomInt` devuelve extremos inclusivos.

**Verificación:**
- [x] `npm run test -- src/app` pasa.
- [x] `npm run typecheck` pasa.

**Dependencias:** Tarea 6.

**Archivos probables:**
- `src/app/app-state.ts`
- `src/app/app-reducer.ts`
- `src/app/browser-random.ts`
- `src/app/__tests__/app-state.test.ts`

**Alcance:** M.

## Tarea 11: Implementar teclado y foco

**Descripción:** Añadir atajos de acciones y gestión de foco sin interferir con controles.

**Criterios de aceptación:**
- [x] B/D/E/R/P/C/? activan únicamente la partida.
- [x] Se ignoran repetición, modificadores y eventos en controles interactivos.
- [x] Inicio, Dificultad y Fin no registran atajos.
- [x] El foco se mueve al `h1` enfocable de cada pantalla.

**Verificación:**
- [x] `npm run test -- src/app` pasa.
- [x] `npm run lint` pasa sin warnings.

**Dependencias:** Tarea 10.

**Archivos probables:**
- `src/app/app-keyboard.ts`
- `src/app/screen-focus.ts`
- `src/app/__tests__/keyboard-focus.test.tsx`

**Alcance:** M.

## Tarea 12: Construir modelos de vista y sesión

**Descripción:** Adaptar el motor a español y coordinar acciones fuera del reducer.

**Criterios de aceptación:**
- [x] Los recursos muestran etiquetas y valores sin calcular reglas.
- [x] La resolución traduce resultados, eventos e hitos en orden.
- [x] La causa final usa `reportedCause`.
- [x] Una acción invoca `resolveTurn` una sola vez.
- [x] La sesión nueva no hereda estado ni resolución.

**Verificación:**
- [x] `npm run test -- src/app` pasa.
- [ ] `npm run test:coverage -- src/app` cumple 80/70.

**Dependencias:** Tareas 10 y 11.

**Archivos probables:**
- `src/app/game-view-model.ts`
- `src/app/use-game-session.ts`
- `src/app/__tests__/game-view-model.test.ts`
- `src/app/__tests__/use-game-session.test.tsx`

**Alcance:** M.

## Tarea 13: Conectar flujo completo

**Descripción:** Reemplazar la plantilla inicial por la aplicación final y verificar todos los estados principales.

**Criterios de aceptación:**
- [x] Inicio navega a dificultad.
- [x] Elegir dificultad crea partida.
- [x] Una acción actualiza recursos y resolución.
- [x] Una muerte cambia a pantalla final.
- [x] Reiniciar vuelve a dificultad.
- [x] Recargar vuelve a Inicio.
- [x] No hay llamadas a Web Storage, red o endpoints.

**Verificación:**
- [x] `npm run test -- src/app` pasa.
- [x] `npm run verify` pasa.
- [ ] Flujo completo verificado en navegador real.

**Dependencias:** Tareas 9 y 12.

**Archivos probables:**
- `src/app/App.tsx`
- `src/main.tsx`
- `src/app/__tests__/App.test.tsx`

**Alcance:** M.

## Checkpoint D: Aplicación completa

- [x] Flujo completo funcional.
- [x] Modo estricto de React sin azar duplicado.
- [x] Build de producción limpio.
- [ ] Cero errores de consola.

## Tarea 14: Ejecutar QA final y documentar

**Descripción:** Cerrar la entrega con instalación limpia, auditoría, navegador, rendimiento y documentación.

**Criterios de aceptación:**
- [ ] `npm ci` y `npm run verify` pasan desde cero.
- [ ] `npm audit` no contiene riesgos alcanzables en runtime sin resolver o documentar.
- [ ] Bundle inicial cumple 200 KiB JS gzip y 50 KiB CSS gzip.
- [ ] Navegador sin peticiones a terceros.
- [ ] README explica instalación, desarrollo, test, verify y build.
- [ ] `docs/fidelity.md` distingue claramente migración y mejoras futuras.

**Verificación:**
- [ ] `npm ci` pasa.
- [ ] `npm run verify` pasa.
- [ ] `npm audit` revisado.
- [ ] Bundle medido.
- [ ] QA a 360, 768 y 1440 px.
- [ ] Flujo completo y teclado verificados.
- [ ] Movimiento reducido comprobado.

**Dependencias:** Tarea 13.

**Archivos probables:**
- `README.md`
- `docs/fidelity.md`
- `CHANGELOG.md`

**Alcance:** M.

## Checkpoint E: Entrega

- [ ] Instalación limpia y verificación completa.
- [ ] Auditoría y presupuestos revisados.
- [ ] QA de navegador y documentación final completados.
