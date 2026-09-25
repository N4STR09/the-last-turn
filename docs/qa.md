# Registro de QA final

**Fecha:** 25 de septiembre de 2026
**Alcance:** primera entrega web estática de *The Last Turn Web*

## Comandos automáticos

| Comprobación | Resultado |
|---|---|
| `npm ci` | Pasa; instalación reproducible sin vulnerabilidades reportadas |
| `npm run typecheck` | Pasa |
| `npm run lint` | Pasa sin warnings |
| `npm run test:coverage` | Pasa; 14 archivos y 138 pruebas; cobertura global 90.34% statements, 82.53% branches, 100% functions, 90.31% lines |
| `npm run test:coverage -- src\app` | Pasa; cobertura de `src/app` 83.44% statements, 73.85% branches, 100% functions, 83.33% lines |
| `npm run test:coverage -- src\game` | Pasa; cobertura de `src/game` 100% en las cuatro métricas |
| `npm run test:coverage -- src\ui` | Pasa; cobertura de `src/ui` 100% en las cuatro métricas |
| `npm run verify` | Pasa; typecheck, lint, cobertura y build |
| `npm run build` | Pasa; bundle estático dentro de presupuesto |
| `npm audit` | 0 vulnerabilidades |

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
- Red: 28 peticiones, todas al origen local; 0 peticiones a terceros.
- El favicon se carga como recurso local, por lo que no se produce la solicitud 404 implícita de `favicon.ico`.

## Comprobación adicional del artefacto web

Se volvió a servir el build de producción con `vite preview` en `127.0.0.1:4175` y se inspeccionó con Edge/CDP:

- `dist/index.html` referencia `./assets/...` y `./favicon.svg`; los cuatro recursos cargaron con estado 200.
- El borde computado de `.button--quiet` fue `rgb(98, 117, 104)` y obtuvo una relación de contraste calculada de 3.49:1 frente a la superficie base.
- Los tamaños de ventana 320, 360, 768 y 1440 px no produjeron elementos fuera del viewport; el botón más pequeño medió al menos 134.25 × 76 px.
- Consola y excepciones: 0; las cuatro peticiones fueron al mismo origen y no hubo ninguna petición a terceros.
- Los bordes de las tarjetas informativas que no son controles permanecen sutiles; la legibilidad y la estructura los identifican sin depender del color, mientras que los bordes de controles mantienen el contraste de 3:1.

Esta comprobación valida el artefacto que se entregaría a Cloudflare Pages, no una URL pública: todavía no se ha creado ni desplegado un proyecto remoto.

Las capturas de pantalla de 360, 768 y 1440 px se generaron temporalmente para la inspección y no forman parte del repositorio. La primera versión no incluye E2E automatizado; la comprobación de navegador se mantiene como QA manual reproducible.
