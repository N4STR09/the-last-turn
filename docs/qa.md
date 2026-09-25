# Registro de QA final

**Fecha:** 25 de septiembre de 2026
**Alcance:** primera entrega local de *The Last Turn Web*

## Comandos automáticos

| Comprobación | Resultado |
|---|---|
| `npm ci` | Pasa; instalación reproducible sin vulnerabilidades reportadas |
| `npm run typecheck` | Pasa |
| `npm run lint` | Pasa sin warnings |
| `npm run test:coverage` | Pasa; umbrales globales 80/70/80/80 |
| `npm run test:coverage -- src/app` | Pasa; cobertura de `src/app` 83.44% statements, 73.85% branches, 100% functions, 83.33% lines |
| `npm run build` | Pasa; bundle local dentro de presupuesto |
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

Las capturas de pantalla de 360, 768 y 1440 px se generaron temporalmente para la inspección y no forman parte del repositorio. La primera versión no incluye E2E automatizado; la comprobación de navegador se mantiene como QA manual reproducible.
