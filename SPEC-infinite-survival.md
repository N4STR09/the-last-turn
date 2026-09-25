# Especificación: supervivencia infinita — Fase 1

## Objetivo

Convertir el motor de *The Last Turn* en un juego de supervivencia endless sin
victoria. Una partida debe poder superar los turnos 15, 30 y 100 sin que
la estructura del juego impida la recuperación. La dificultad debe aumentar la
presión, pero no debe crear una muerte matemática por hambre ni una muerte
automática por una tirada aislada.

Esta fase cambia deliberadamente algunos defectos del prototipo C. La
migración fiel queda documentada en `docs/fidelity.md`; estas reglas son una
evolución posterior y deben identificarse como tales.

## Alcance

### Reglas nuevas

1. **Comer**
   - Si hay al menos una comida, consume exactamente una.
   - Reduce el hambre en 4 antes del coste normal del turno; el resultado nunca
     baja de 0.
   - Recupera 1 de salud, hasta el máximo de 10.
   - Si no hay comida, conserva el comportamiento cruel actual: consume un
     turno, aumenta el hambre en 1 y reduce la energía en 1.
   - La comida deja de ser un recurso decorativo.

2. **Pesca acotada**
   - Se mantienen los intentos hasta obtener un 1, con un máximo de 6 intentos.
   - Si se obtiene un 1, se conservan la comida y los costes actuales.
   - Si se agotan los 6 intentos sin obtener un 1, la acción termina en
     `fish-failed`, sin añadir comida, pero cobra todos los turnos, hambre y
     energía de los intentos realizados.
   - Ninguna acción puede quedar bloqueada por una secuencia de azar infinita.

3. **Meteorito recuperable**
   - El meteorito reduce la salud en 1 en lugar de establecerla en 0.
   - La salud puede recuperarse comiendo.
   - Si la salud llega a 0, la partida termina por salud.

4. **Hitos sin penalización infinita**
   - Se conservan los mensajes exactos de los turnos 15 y 30.
   - El cruce de cada hito aplica una sola penalización de +1 hambre y -1 energía.
   - Se elimina la aplicación repetida de penalizaciones en cada turno
     posterior al 30. La presión continua de la Fase 1 procede del hambre,
     la energía, las acciones y los eventos de Agonía.

5. **Sin victoria ni persistencia**
   - No existe condición de victoria.
   - No se añade Web Storage, backend, cuentas, telemetría ni persistencia.
   - Una recarga sigue reiniciando la partida.

## Comandos

- Ejecutar la suite: `npm test`
- Ejecutar la barrera completa: `npm run verify`
- Ejecutar solo el motor: `npm test -- src/game`
- Construir el artefacto estático: `npm run build`

## Estructura

- `src/game/types.ts`: contratos y nuevas variantes de resultados.
- `src/game/actions.ts`: comer y pesca acotada.
- `src/game/events.ts`: daño recuperable del meteorito.
- `src/game/difficulty.ts`: hitos de una sola aplicación.
- `src/game/__tests__/`: pruebas de regresión y casos nuevos.
- `src/app/game-view-model.ts`: textos de resolución coherentes con el motor.
- `docs/fidelity.md`: desviaciones deliberadas respecto del C.

## Estilo

El motor seguirá siendo puro y basado en contratos. Las funciones devolverán
estados nuevos; no mutarán la entrada ni usarán azar de React o del navegador.

```ts
export function resolveAction(
  state: GameCoreState,
  action: GameAction,
  randomInt: RandomInt,
): ActionResolution;
```

## Estrategia de pruebas

Vitest y las utilidades de secuencia determinista existente. Cada regla nueva
debe tener una prueba que falle antes de implementarse y pase después.

Casos obligatorios:

- comer consume comida, reduce hambre y recupera salud;
- comer sin comida mantiene el coste cruel;
- la salud no baja de 0 ni de 10;
- la pesca termina como máximo en el sexto intento;
- la pesca fallida no añade comida y cobra los seis intentos;
- el meteorito deja a la persona viva con salud suficiente;
- el hito 15 y el hito 30 penalizan una sola vez;
- una partida puede superar el turno 30 con una secuencia de acciones válida;
- una partida con una ruta de comida y descanso puede superar el turno 100;
- el motor sigue rechazando partidas terminadas y azar fuera de intervalo.

## Fronteras

- Siempre: ejecutar pruebas antes de cada commit; mantener el motor sin React;
  documentar toda desviación del C; conservar la ausencia de victoria.
- Preguntar antes: añadir dependencias, persistencia, backend, telemetría,
  nuevos recursos o una segunda condición de victoria.
- Nunca: ocultar un cambio de reglas solo en la interfaz; introducir un bucle
  de azar sin límites; hacer mutar el estado de entrada; subir secretos.

## Criterios de éxito

- `npm test` pasa.
- `npm run verify` pasa con la cobertura por capacidad y presupuestos.
- El motor no contiene un bucle de pesca sin límite.
- Existe una prueba de una partida que supera el turno 100.
- Existe una prueba que demuestra que el meteorito no mata automáticamente a
  una persona con salud inicial.
- La partida puede morir por hambre, energía o salud, pero no por una regla que
  haga imposible toda recuperación.
- La UI identifica correctamente comer, comer sin comida, pesca fallida y
  meteorito no mortal.

## Fuera de alcance

La Fase 2 podrá añadir integridad de refugio, materiales, un director de eventos
más elaborado, amenazas escalonadas, puntuación, simulación estadística,
semillas, historia de partida y mejoras visuales. La Fase 1 no los implementa.
