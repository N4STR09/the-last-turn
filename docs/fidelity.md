# Fidelidad de reglas

## Propósito

Este documento es la línea base de la migración de *The Last Turn Web*. Las reglas se implementan desde los fuentes C de referencia, no desde el ejecutable. Durante esta migración se conservan los defectos conocidos para que puedan evaluarse y modificarse más adelante de forma explícita.

## Fuentes autorizadas

- `C:\Proyectos_C\the_last_turn_v2\the_last_turn_v2.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.c`
- `C:\Proyectos_C\the_last_turn_v2\functions.h`

El ejecutable existente solo sirve como referencia visual. No demuestra que su lógica sea idéntica a la de los fuentes actuales.

## Comportamientos que se conservan

| ID | Comportamiento fiel |
|---|---|
| `F-01` | Comer nunca reduce hambre ni modifica comida en estados alcanzables. |
| `F-02` | La salud solo puede pasar de 10 a 0 mediante un meteorito; no hay recuperación. |
| `F-03` | No existe victoria. |
| `F-04` | El bucle permite hambre 10, pero el mensaje de muerte empieza en 10. |
| `F-05` | La terminación por energía suele quedar eclipsada por el mensaje de hambre. |
| `F-06` | La pesca puede consumir un número ilimitado de turnos y queda bloqueada si la fuente de azar nunca devuelve 1. |
| `F-07` | Los hitos usan igualdad exacta y pueden omitirse al saltar turnos. |
| `F-08` | Una acción multiturno aplica evento y penalizaciones una sola vez al finalizar. |
| `F-09` | Ayuda no consume turno, pero sí puede producir un evento en Agonía. |
| `F-10` | Energía y comida no tienen límite superior. |
| `F-11` | Los hitos y penalizaciones se aplican también en Normal. |

## Diferencias inevitables de la web

| ID | Diferencia y motivo |
|---|---|
| `W-01` | No existe acción `invalid`: los controles React solo pueden despachar valores de `GameAction`. Se elimina una entrada textual imposible, no una regla. |
| `W-02` | La dificultad se selecciona mediante una unión de dos valores. No se conservan entradas inválidas de `scanf`, incluidos valores distintos de 1. |
| `W-03` | El adaptador web genera enteros nominalmente uniformes. No se reproduce el sesgo específico de `rand() % n` de MinGW. |
| `W-04` | El motor devuelve datos y claves de mensaje; no imprime texto directamente. |

## Regla de cambio

No se corregirá ni eliminará ningún elemento `F-*` durante la migración base. Una mejora posterior deberá:

1. identificarse con un nuevo elemento `F-*` o una decisión explícita;
2. añadir una prueba que demuestre el comportamiento anterior;
3. explicar la regla nueva y sus efectos;
4. actualizar este documento antes de cambiar el motor.

No se añadirá una diferencia `W-*` sin documentar su motivo y su impacto observable.
