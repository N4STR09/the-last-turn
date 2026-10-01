# Cuentas, sesiones y lo que se guarda

Este documento es el registro de la decisión que cambió el proyecto: **el juego
dejó de ser solo frontend**. Hasta aquí la regla estaba escrita en trece sitios
y era real: sin backend, sin cuentas, sin persistencia, sin Web Storage. A partir
de aquí hay un servidor.

El documento existe para que el cambio quede escrito antes de que el sistema
funcione, y no cuando ya esté en producción. Es más fácil revisar una decisión
que un código terminado, y una decisión que solo se lee en el historial de
commits se pierde en cuanto alguien filtra por otra cosa.

## Qué se invirtió y por qué

Dos cosas, y solo dos.

**El secreto de cliente de Google no puede vivir dentro de `dist/`.** Se
publicaría en el paquete que descarga cualquiera que abra la página, y con él
cualquiera podría hacerse pasar por la aplicación. No hay forma de hacer login
con Google en un sitio estático: el secreto obliga a que haya un servidor. Esto
no es una preferencia de diseño, es una consecuencia aritmética de dónde vive un
secreto.

**Guardar un récord entre sesiones necesita un sitio donde guardarlo.** La regla
anterior no era caprichosa: la mejor partida vivía en un `useState` y se perdía
al recargar, y `SPEC-web-interface.md` lo decía a propósito, porque eso es lo que
hace que sea un rival y no un récord. Pedir un récord que sobreviva a cerrar la
pestaña es pedir que algo se escriba fuera del navegador.

Lo que **no** se invierte: el motor no se toca. Ni una probabilidad, ni un turno,
ni el nombre de una acción, ni una línea de `src/game`. Por eso este bloque no
tiene entrada en el ledger de reglas de `docs/fidelity.md`. Las reglas del juego
son las mismas con cuenta que sin ella.

## Dónde vive

**Cloudflare Pages con Functions y D1.** El sitio que ya estaba publicado pasa a
servir también las rutas de `functions/`, en el mismo origen. Eso trae dos
ventajas que no se pagan en otro sitio:

- No hay CORS. El frontend y la API son el mismo origen, así que no hay una lista
  de orígenes permitidos que mantener ni que se quede vieja.
- `SameSite=Lax` basta para la cookie de sesión. Con un Worker aparte, la cookie
  sería de otro origen y habría que relajarla a `SameSite=None; Secure`, que la hace
  enviarse en peticiones de terceros.

No se pide `nodejs_compat`. El código del servidor usa funciones web estándar
(`fetch`, `crypto.subtle`, `TextEncoder`, `URL`) y nada de Node.

## Las contraseñas no se cifran, se hashean

Conviene dejarlo escrito porque es un error muy común y muy grave.

Cifrar es reversible: quien tenga la clave lee la contraseña. Una base de datos
con contraseñas cifradas es **peor** que una vacía, porque aparenta estar
protegida y no lo está. Lo correcto es una función de derivación de un solo
sentido, con sal por usuario, y no existe forma de volver atrás.

Lo que se usa es **PBKDF2-HMAC-SHA-256 con 600 000 iteraciones** y sal de 16 bytes
por usuario. Argon2id es mejor, porque resiste más contra quien ataque con
tarjetas dedicated de cálculo, y necesita WebAssembly dentro del paquete. Con 80 KiB de
JavaScript y una regla de no arrastrar dependencias, PBKDF2 nativo es la opción
honesta. Los parámetros van **dentro del hash guardado**, con esta forma:

```text
pbkdf2_sha256$600000$<sal en base64>$<resultado en base64>
```

Así el algoritmo está escrito en la propia fila y se pueden subir las
iteraciones dentro de un año sin tocar los datos: se verifica con lo que dice la
fila, no con lo que dice el código.

**Aviso sin resolver:** 600 000 iteraciones son del orden de 300 ms de CPU, y eso
puede no caber en el cupo de CPU por petición del plan gratuito de Workers. Si no
cabe hay dos salidas, y las dos tienen coste: bajar las iteraciones debilita el
hasheado, o pagar el plan. Está sin medir a propósito, porque elegir sin medir es
elegir por gusto.

## El resto de la defensa

- **Intentos fallidos contados en D1**, con bloqueo progresivo. Sin esto, el
  hasheado no protege: solo le pone un límite de ritmo a quien intenta
  muchos passwords por segundo, y el límite hay que ponerlo en algún sitio.
- **Un solo mensaje de error** al iniciar sesión, tanto si el correo no existe
  como si la contraseña no es la correcta. Distinguir los dos casos convierte el
  formulario de registro en una lista de correos válidos.
- **La sesión guarda el hash del token, no el token.** Si alguien se lleva la
  base de datos entera no se lleva ninguna sesión utilizable: para hacer falta
  el token en claro, y eso solo estaba en la cookie.
- **`email_verified` se comprueba siempre** en el token de Google. Sin esa
  comprobación, cualquiera con un dominio propio puede hacerse pasar por esa
  cuenta.
- **El `sub` es la única identidad que se guarda de Google.** El correo es
 mutable; el `sub` no. Es lo que permite enlazar una cuenta con contraseña y una
  de Google sin crear dos cuentas de la misma persona.

## No se guarda ninguna partida

La promesa no se sostiene con disciplina, se sostiene con el esquema. **No hay
ninguna tabla donde meter una partida**, y la prueba que aplica la migración real
sobre una base en memoria comprueba la lista completa de tablas. Si algún día
alguien añade una tabla `games`, esa prueba falla y hay que explicar para qué
sirve.

La ruta de estadísticas no recibe un estado de partida: recibe enteros. El cliente
manda lo que pasó en una partida —su mejor turno, un contador— y **el servidor
suma**, con `MAX` o con una suma dentro del propio SQL. Dos cosas se siguen de
ahí:

- El cliente no puede declararse un récord que no tiene. Si mandara totales, el
  último en escribir ganaría y con dos dispositivos a la vez se perderían
  partidas.
- No hay ningún campo donde quepa un tablero. No es una promesa de no guardar
  partidas: es que la puerta no existe.

## Las tres cosas futuras

Monedas, personajes y logros van en **una sola tabla**, `player_unlocks`, con
`kind` tomando `moneda`, `personaje` o `logro`. La tabla existe desde la primera
migración y no escribe nadie todavía.

Las monedas en concreto son un saldo, y un saldo guardado como número se puede
descontar dos veces. Contando filas no hay doble gasto posible, porque no hay
nada que restar: hay filas que están o no están, y la clave primaria impide
duplicar la misma. Es la razón por la que el saldo es un `count` y no una
columna.

## Lo que falta y hay que decidir

Nada de esto se puede hacer desde el repositorio:

- **El `database_id` de D1.** Sale de `wrangler d1 create the-last-turn`, y hace
  falta una sesión iniciada en Cloudflare. Está marcado como pendiente en
  `wrangler.toml` a propósito, para que no se pase por alto.
- **El cliente de OAuth de Google.** Hace falta crearlo en la consola de Google
  con el dominio del sitio como origen autorizado. El secreto no entra en el
  repositorio ni en el paquete del navegador.
- **Los scripts de instalación de `workerd` y `esbuild`**, que npm ha dejado
  sin ejecutar. `wrangler` funciona, pero `wrangler dev` los necesita.
- **Un aviso de privacidad.** Se guarda un correo, y un correo es un dato
  personal. Alguien tiene que escribirlo.
- **La migración de las estadísticas de invitado.** Se decided que al iniciar
  sesión se suba lo que se haya jugado sin cuenta, pero conviene saber que hoy
  casi no hay nada que subir: la mejor partida vive en un `useState` y se pierde
  al recargar. Lo que se suba es lo de esa sesión, y el valor de las cuentas está
  en las sesiones siguientes, no en rescatar un historial que nunca existió.

## Los trece sitios que dirán otra cosa

La regla de "sin backend, cuentas ni persistencia" está escrita en `README.md`
(2), `CAPABILITIES.md`, `docs/fidelity.md`, `SPEC-app-shell.md`,
`SPEC-game-engine.md` (2), `SPEC-infinite-survival.md`, `SPEC-threat.md`,
`SPEC-verification.md`, `SPEC-web-interface.md`, `CHANGELOG.md`, `docs/qa.md` y
`tasks/todo.md`.

No se reescriben ahora a propósito, y la regla para hacerlo es esta:

- **Lo que describe una fase** se deja. «La Fase 5 no toca el motor» seguirá siendo
  cierto dentro de mil años, y reescribirlo sería hacer que la historia del
  proyecto dijera algo que nunca pasó.
- **Lo que describe el proyecto hoy** se reescribe cuando el sistema esté
  funcionando. Reescribirlo ahora documentaría un sistema que no existe, que es
  peor que un documento que va con retraso.

Faltan dos familias más: la ayuda dentro del juego y el aviso de privacidad de la
página, que no se pueden escribir hasta que esté hecho el formulario de alta.
