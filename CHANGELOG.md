# Changelog

## [Unreleased]

### Changed

- Fase 1 de supervivencia: comer consume una ración, reduce el hambre y recupera salud; la pesca termina tras seis intentos como máximo; el meteorito quita un punto de salud en lugar de matar desde salud inicial; los hitos 15 y 30 aplican una penalización solo al cruzarse.
- La interfaz comunica las nuevas resoluciones sin mostrar la salud y permite una estrategia determinista que supera el turno 100 en Normal y Agonía.
- `docs/fidelity.md` y `SPEC-game-engine.md` separan la línea base histórica del C de las desviaciones explícitas de la Fase 1.

### Verification

- Se añadieron pruebas de supervivencia, meteorito recuperable, pesca fallida, hitos cruzados y copy de interfaz.
- La publicación pública existente todavía no contiene estos cambios locales; queda pendiente una autorización explícita para empujar o desplegar.

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
