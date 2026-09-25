# Plan de implementación: The Last Turn Web

## Resumen

Construiremos una aplicación React + Vite + TypeScript como web 100 % estática que migre las reglas actuales del prototipo C sin corregirlas silenciosamente. El motor de juego se implementará primero mediante TDD y con azar inyectable; después se construirán la interfaz, la capa de aplicación y la verificación integral.

## Objetivo de la primera entrega

Completar un flujo web jugable mediante navegador, sin instalación para la persona que juega:

```text
Inicio → Dificultad → Partida → Acción → Resultado → Fin o siguiente turno → Reinicio
```

La entrega se considera terminada cuando `npm run verify` pasa, el build es estático, el navegador no muestra errores y el ledger de fidelidad demuestra que los comportamientos conocidos del C no fueron corregidos.

## Decisiones de arquitectura

- `src/game/` será la única fuente de reglas y no importará React ni APIs del navegador.
- Las transiciones serán inmutables y precedidas por un reducer puro de aplicación.
- El azar se resolverá en el manejador de eventos y se despachará ya calculado al reducer.
- `src/ui/` recibirá view models y emitirá callbacks; no invocará el motor.
- No habrá router, store global, persistencia, backend, Pages Functions ni recursos de red en runtime.
- El build de `dist/` se publicará como web estática en Cloudflare Pages; quien juega no instalará dependencias.
- Las acciones y reglas se implementarán en cortes pequeños con RED → GREEN → REFACTOR.
- Las versiones se fijarán en `package.json` y `package-lock.json`.
- Cada corte verificado se guardará en un commit atómico.

## Dependencias

```text
Especificaciones aprobadas
          │
          ▼
1. Git y línea base
          │
          ▼
2. Scaffold y toolchain
          │
          ▼
3. Contratos y estado inicial
          │
     ┌────┴────┐
     ▼         ▼
4. Acciones  5. Eventos/dificultad/fin
     └────┬────┘
          ▼
6. API pública del motor
          │
     ┌────┴─────────────┐
     ▼                  ▼
7–9. Interfaz       10–12. App shell
     └────────┬─────────┘
              ▼
       13. Flujo completo
              │
              ▼
       14. Verificación final
```

## Fase 1: Fundación y motor

### Tarea 1: Git y línea base

- Inicializar Git en el proyecto.
- Conservar y versionar las especificaciones aprobadas.
- No copiar el ejecutable ni los fuentes C al bundle web.

### Tarea 2: Scaffold y toolchain

- Crear el esqueleto React + Vite + TypeScript.
- Configurar Vitest, Testing Library, ESLint, cobertura y scripts.
- Activar TypeScript estricto y verify con salida limpia.

### Tarea 3: Contratos y fidelidad

- Definir tipos y unión de estados.
- Crear estado inicial.
- Crear ledger `F-*` / `W-*`.

### Tarea 4: Acciones

- Implementar por TDD las siete acciones.
- Preservar orden de tiradas, costes y bugs de comer/pescar.

### Tarea 5: Eventos, hitos y fin

- Implementar eventos de Agonía.
- Implementar hitos/penalizaciones en ambas dificultades.
- Separar condición de fin y causa comunicada.

### Tarea 6: API del motor

- Orquestar acción → evento → dificultad → fin.
- Rechazar estado terminado y RNG inválido.
- Alcanzar 100% de cobertura en `src/game/`.

## Fase 2: Interfaz

### Tarea 7: Inicio y dificultad

- Implementar las dos primeras pantallas con TDD.
- Incluir semántica, foco y contenido en español.

### Tarea 8: Presentación de partida

- Implementar recursos, resolución y acciones.
- Mantener salud oculta y orden de resolución visible.

### Tarea 9: Fin de partida y sistema visual

- Implementar pantalla final y botón compartido.
- Crear variables visuales, adaptación responsive, foco visible y movimiento reducido.
- Revisar esta tarea como un único incremento funcional antes de continuar.

## Fase 3: Aplicación

### Tarea 10: Estado de aplicación

- Implementar unión de pantallas y reducer puro.
- Añadir adaptador de azar del navegador.

### Tarea 11: Teclado y foco

- Implementar atajos B/D/E/R/P/C/?.
- Ignorar repetición, modificadores y controles interactivos.
- Gestionar foco por pantalla.

### Tarea 12: Modelos de vista y sesión

- Construir recursos, resolución y pantalla final.
- Resolver acciones fuera del reducer.
- Reiniciar sin estado residual.

### Tarea 13: Integración completa

- Conectar todas las pantallas.
- Verificar inicio, partida, eventos, muerte y reinicio.

## Fase 4: Calidad y entrega

### Tarea 14: Verificación final

- Ejecutar instalación limpia, verificación y auditoría.
- Medir el paquete de producción.
- Comprobar navegador, teclado, anchos de ventana, movimiento reducido y red.
- Completar el README y el registro de fidelidad.

## Checkpoints

### Checkpoint A: Toolchain

- `npm ci` funciona.
- `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` pasan.

### Checkpoint B: Motor

- Todas las reglas tienen pruebas.
- `src/game/` alcanza 100% en las cuatro métricas.
- El ledger cubre todos los comportamientos conocidos.

### Checkpoint C: Interfaz

- Los cuatro estados visuales tienen pruebas semánticas.
- No hay desbordamiento horizontal en los anchos definidos.
- Flujo principal navegable con teclado.

### Checkpoint D: Aplicación completa

- Inicio → dificultad → partida → fin → reinicio funciona.
- Recargar reinicia la aplicación.
- No hay errores de consola ni peticiones a terceros.

### Checkpoint E: Entrega

- `npm run verify` pasa desde instalación limpia.
- Los presupuestos de bundle se cumplen o quedan documentados.
- README y fidelidad están completos.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Corregir accidentalmente un defecto del C | Alto | Registro `F-*`, pruebas de fidelidad y revisión del diff contra la especificación. |
| La pesca infinita bloquea una prueba | Alto | No probar secuencias infinitas; conservar el azar real sin límite y probar solo secuencias finitas. |
| Diferencia entre el azar de C y el de la web | Medio | Inyectar `RandomInt`; documentar la diferencia `W-03` sin replicar el comportamiento binario. |
| El reducer consume azar y React lo duplica en modo estricto | Alto | Resolver fuera del reducer y despachar una transición pura. |
| La interfaz reimplementa la lógica del juego | Alto | Componentes con modelos de vista y callbacks; se prohíbe importar `resolveTurn`. |
| Acumulación del paquete o dependencia visual pesada | Medio | CSS propio, iconos que admiten tree shaking y presupuestos de gzip. |
| Diferencias entre el ejecutable y los fuentes actuales | Medio | Tomar los fuentes C autorizados y declarar el binario solo como referencia visual. |
| La accesibilidad depende solo de pruebas automáticas | Alto | Aserciones semánticas, navegación manual y revisión de foco y contraste. |

## Estrategia de paralelización

- El motor debe completarse antes de exponer sus contratos a la interfaz.
- Las tareas 7–9 pueden empezar en otra rama después de aprobar la API pública del motor.
- Las tareas 10–12 pueden paralelizarse parcialmente después de esa misma API.
- En esta sesión se ejecutarán de forma secuencial para mantener commits pequeños y fáciles de revisar.

## Preguntas abiertas

Ninguna. Las decisiones, límites, estilos y comportamientos fieles fueron aprobados.
