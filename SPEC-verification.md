# Especificación: `verification`

## Objetivo

Establecer una barrera de calidad reproducible para que la migración sea demostrablemente compilable, testeable, accesible y publicable como web estática antes de considerarla terminada.

## Entorno y versiones

| Paquete | Versión | Motivo |
|---|---:|---|
| Node.js | `24.19.0` | Rama LTS instalada; rango de proyecto `>=24.19 <25`. |
| npm | `11.17.0` | Gestor de paquetes y lockfile reproducible. |
| React | `19.3.0` | Runtime de la interfaz. |
| React DOM | `19.3.0` | Renderizado en navegador. |
| Vite | `8.3.1` | Bundler y servidor local. |
| `@vitejs/plugin-react` | `6.1.1` | Integración oficial de Vite con React. |
| TypeScript | `6.0.3` | Última versión 6.x; se evita 7.x hasta que `typescript-eslint` admita ese rango. |
| Vitest | `5.0.1` | Test runner compatible con Vite 8. |
| `@vitest/coverage-v8` | `5.0.1` | Cobertura mediante V8. |
| React Testing Library | `16.3.3` | Pruebas orientadas al comportamiento. |
| Testing Library DOM | `10.4.2` | Peer dependency de RTL. |
| `@testing-library/jest-dom` | `7.0.1` | Matchers DOM. |
| `@testing-library/user-event` | `14.6.7` | Interacción de usuario. |
| jsdom | `30.1.1` | Entorno DOM para Vitest. |
| ESLint | `10.11.0` | Lint. |
| `@eslint/js` | `10.0.1` | Configuración base de ESLint. |
| `typescript-eslint` | `8.70.1` | Reglas de TypeScript. |
| `eslint-plugin-react-hooks` | `7.1.1` | Reglas de Hooks. |
| `eslint-plugin-react-refresh` | `0.5.7` | Fronteras de importación de Vite. |
| `globals` | `17.12.0` | Entornos de navegador y Node. |
| `@types/node` | `24.13.6` | Tipos de Node para configuración y scripts. |
| `@types/react` | `19.3.0` | Tipos de React. |
| `@types/react-dom` | `19.3.0` | Tipos de React DOM. |
| `lucide-react` | `1.48.0` | Iconos locales que admiten tree shaking. |

Las versiones se fijarán de forma exacta en `package.json` y se resolverán en `package-lock.json`. Una actualización mayor requerirá revisar su registro de cambios y ejecutar la barrera completa por separado.

## Fuentes oficiales

- Vite guide: https://vite.dev/guide/
- React `useReducer`: https://react.dev/reference/react/useReducer
- Vitest config: https://vitest.dev/config/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Node releases: https://nodejs.org/en/about/previous-releases

## Estructura de pruebas

```text
src/game/__tests__/      → Motor y reglas
src/ui/__tests__/        → Componentes y accesibilidad semántica
src/app/__tests__/       → Flujo, coordinación y atajos
src/test/setup.ts        → Configuración común de jsdom
```

Las pruebas vivirán junto al módulo que describen. No se usarán como una segunda fuente de reglas.

## Comandos

### Instalación reproducible

```text
npm ci
```

### Desarrollo

```text
npm run dev
```

### Pruebas

```text
npm run test
npm run test:watch
npm run test:coverage
```

`npm run test` ejecutará Vitest en modo run, una sola pasada y sin watcher.

### Calidad estática

```text
npm run lint
npm run typecheck
```

### Build y vista previa

```text
npm run build
npm run preview
```

### Barrera única

```text
npm run verify
```

`verify` ejecutará en este orden:

```text
npm run typecheck
npm run lint
npm run test:coverage
npm run build
```

El script `test:coverage` usa `scripts/run-coverage.mjs` para conservar la cobertura global cuando no recibe filtros. Si se ejecuta con `src/app`, `src/ui` o `src/game`, restringe `coverage.include` a ese árbol para aplicar los umbrales de la capacidad correspondiente sin reducir el alcance de la verificación global.

## Criterios automáticos

### TypeScript

- `strict` activo.
- `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos.
- Sin `any` implícitos.
- Sin casts innecesarios para ocultar errores.
- Sin errores de tipos en `src/` ni en la configuración.

### ESLint

- Cero errores.
- Cero warnings.
- No se añadirán `eslint-disable` para funcionalidad que pueda corregirse.
- No se usará `any`, conversiones de tipos inseguras ni importaciones de desarrollo en producción.

### Pruebas

- `src/game/`: 100% statements, branches, functions y lines.
- `src/ui/` y `src/app/`: al menos 80% statements, functions y lines, y 70% branches.
- No se permiten tests omitidos, `.only` o `xit` sin justificación escrita y aprobación explícita.
- Cada acción, evento, hito, fin de partida, reinicio, atajo y callback de interfaz tiene cobertura.
- Las pruebas de azar usan secuencias inyectadas, nunca `Math.random` real.

### Build

- `npm run build` termina con código 0.
- El resultado es una aplicación web estática que puede publicarse directamente en Cloudflare Pages.
- No se generan Pages Functions, Workers, endpoints ni secretos.
- El runtime de producción no realiza peticiones a terceros.

## Verificación manual en navegador

Se usará un navegador real para validar:

1. Carga inicial sin errores de consola.
2. Flujo Inicio → Dificultad → Partida.
3. Ejecución de cada acción.
4. Resultado, evento e hito en el orden correcto.
5. Comportamiento de Ayuda en Normal y Agonía mediante pruebas deterministas.
6. Muerte, causa comunicada, turnos aguantados y reinicio.
7. Recarga de página: vuelve a Inicio y no conserva estado.
8. Navegación completa por teclado.
9. Anchos de ventana de 360, 768 y 1440 px.
10. `prefers-reduced-motion`.
11. Contraste, foco visible y nombres accesibles.
12. Panel de red sin llamadas a terceros.

La inspección visual no reemplaza las pruebas; las pruebas no reemplazan la inspección en navegador.

## Rendimiento y bundle

- JavaScript inicial: máximo 200 KiB gzip.
- CSS inicial: máximo 50 KiB gzip.
- Sin fuentes, imágenes, APIs o trackers externos.
- Sin carga de JavaScript adicional por acción.
- Las animaciones no bloquean la entrada del usuario.
- Valores de estadísticas grandes no amplían el documento horizontalmente.

Estos presupuestos no se comprueban a ojo: `npm run check:budget` mide con gzip los archivos generados en `dist/assets/` y devuelve código de salida 1 al superarse. `npm run verify` ejecuta esa puerta después del build, de modo que crecer el bundle sin documentarlo detiene la entrega en lugar de quedar como un hecho informado. Si se supera un presupuesto, se medirá el tamaño y se documentará la causa antes de optimizar.

## Seguridad y suministro

- No se manejan datos personales ni credenciales.
- No se almacena estado en Web Storage durante este MVP.
- No se crean endpoints.
- `npm audit` se ejecuta como señal de suministro. Un hallazgo alcanzable en tiempo de ejecución bloquea la entrega hasta documentarse o resolverse.
- El generador aleatorio no es criptográfico y no debe utilizarse para competiciones, sorteos ni recompensas.

## Definición de terminado

- Todas las capacidades tienen implementación y pruebas asociadas.
- Una instalación limpia con `npm ci` funciona.
- `npm run verify` pasa.
- El build de producción se genera correctamente.
- El flujo completo se verifica en navegador real.
- No hay errores de consola ni solicitudes de runtime a terceros.
- La interfaz funciona con teclado, móvil y escritorio.
- `docs/fidelity.md` enumera comportamientos `F-*` y diferencias `W-*`.
- El README explica cómo iniciar, probar, construir y publicar el build web.
- No se ha añadido backend, persistencia ni funcionalidad fuera de alcance.

## Preguntas abiertas

Ninguna. La primera versión no incluye E2E automatizado; React Testing Library y la inspección en navegador cubren el MVP. Playwright/E2E podrá añadirse posteriormente como mejora independiente.
