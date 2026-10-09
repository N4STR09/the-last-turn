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

Lo que se usa es **PBKDF2-HMAC-SHA-256 con 5 000 iteraciones** y sal de 16 bytes
por usuario. Argon2id es mejor, porque resiste más contra quien ataque con
tarjetas dedicadas de cálculo, y necesita WebAssembly dentro del paquete. Con 80
KiB de JavaScript y una regla de no arrastrar dependencias, PBKDF2 nativo es la
opción honesta. Los parámetros van **dentro del hash guardado**, con esta forma:

```text
pbkdf2_sha256$5000$<sal en base64>$<resultado en base64>
```

Así el algoritmo está escrito en la propia fila y se pueden subir las
iteraciones dentro de un año sin tocar los datos: se verifica con lo que dice la
fila, no con lo que dice el código.

### Decisión 5 (resuelta): bajar las iteraciones para caber en el plan gratuito

Esta decisión tiene fecha y coste, y conviene que se lea entera.

**Medido.** 600 000 iteraciones cuestan **275 ms de CPU al hashear** en este
equipo (Node 24, 6 de octubre de 2026) y **629 ms al hashear y 344 ms al
verificar** en la referencia más conservadora. El plan gratuito de Workers admite
**10 ms de CPU por petición**: el hasheo cuesta decenas de veces el cupo, así que
una petición de alta o de acceso no devolvería respuesta. El plan de pago son 30 s
por petición, subibles con `limits.cpu_ms`, y 629 ms no molesta ahí.

No es un problema de código y no se puede arreglar dentro del repositorio: hay
que **pagar el plan o bajar las iteraciones**, y las dos opciones tienen coste.
**Se ha elegido bajar las iteraciones**, para no depender del plan de pago. El
valor por defecto es **5 000**, que en las mismas medidas cuesta unos **2,4 ms**
en este equipo y **~5,2 ms** en la referencia conservadora: cabe en los 10 ms
con margen.

**El coste es de seguridad y está asumido.** OWASP pide 600 000 iteraciones para
PBKDF2, y 5 000 es 120 veces menos: quien se llevara la base de datos tendría 120
veces más fácil probar contraseñas por segundo. Lo que sostiene la defensa no es
solo el número, sino el bloqueo progresivo de intentos, que limita cuántas se
pueden probar contra el servidor. Aun así, 5 000 es un suelo elegido para el plan
gratuito y no un objetivo, y **subirlo es cambiar una variable de despliegue**,
sin migrar ningún dato.

Lo que está hecho para que la elección no obligue a reescribir nada:

- `functions/_lib/iterations.ts` lee `env.PBKDF2_ITERATIONS`, una variable de
  configuración de despliegue que solo existe en el servidor y que no se escribe
  en ningún sitio del repositorio.
- Si no existe, o si el valor escrito no es un número entre **5 000** y
  **10 000 000**, se usa el valor por defecto de **5 000**. El suelo es igual al
  valor por defecto, así que la variable **solo puede subir** las iteraciones:
  un valor mal escrito nunca baja la seguridad a escondidas, que sería un fallo
  imposible de detectar mirando la respuesta.

La fila guarda sus propias iteraciones, así que cambiar este número más adelante
no obliga a migrar nada: las cuentas viejas se siguen verificando con lo que
dijeron cuando se crearon.


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
- **La contraseña se valida por longitud solo al dar de alta**, entre 8 y 200
  caracteres. Sin esa comprobación el alta aceptaba la cadena vacía y creaba una
  cuenta cuya contraseña era cero caracteres. El acceso, en cambio, **no valida
  nada y siempre responde 401**: si rechazara la contraseña corta con un 400
  propio, estaría mandando una respuesta que no es la de una contraseña
  equivocada, y a la contraseña corta correcta directamente no se la dejaría
  entrar. El tope superior también se comprueba en el acceso, y **antes** de
  tocar la base, porque PBKDF2 lee la contraseña entera: comprobarlo después
  dejaría el tiempo como indicador de si hay cuenta ahi.

- **El `sub` es la única identidad que se guarda de Google.** El correo es
 mutable; el `sub` no. Es lo que permite enlazar una cuenta con contraseña y una
  de Google sin crear dos cuentas de la misma persona.

## Google: qué se verifica y qué no se cuenta

El acceso con Google usa el flujo de **token de identificación**, no el de
autorización con código. En el segundo, el navegador se va a Google y vuelve con
un código que el servidor intercambia por un token: añade una vuelta, una URL de
retorno que declarar y un secreto que rotar. En el primero, Google Identity
Services entrega el token firmado en la propia página y se manda de una vez. El
que lo verifica está en el mismo origen que el que lo emite, así que la vuelta no
aporta nada.

Toda la verificación vive en `functions/_lib/google.ts`, y el orden importa:

- **La firma se verifica antes de decodificar el cuerpo.** Al revés sería leer
  y creer un campo que escribió el atacante.
- **`alg` tiene que ser `RS256`.** Un JWT admite varios algoritmos, y aceptar
  `none` o uno simétrico es la forma clásica de fabricar un token válido a mano.
- **`aud` se compara con `!==`.** Es el identificador del cliente; contenerlo
  dejaría que un token emitido para otro cliente nuestro abriera esta cuenta.
- **`email_verified` tiene que ser exactamente `true`.** Sin eso, cualquiera con
  un dominio propio se hace pasar por cualquier correo de ese dominio.
- **La clave pública sale de la JWKS de Google y se cachea.** Se respeta el
  `max-age` del `Cache-Control` con suelo de 5 minutos y techo de un día, defecto
  de una hora; si la petición falla, la caché queda vacía 30 segundos en lugar de
  quedarse con las claves viejas para siempre.

Del token solo se guardan **`sub` y correo**. El `name` no: es un campo que la
persona puede cambiar en Google, y quedaría escrito en la base de datos como si
fuera suyo para siempre. El `sub`, en cambio, no cambia nunca, y es por eso por
lo que una cuenta con contraseña y una de Google se pueden enlazar sin crear dos
cuentas de la misma persona.

### El correo ya tiene contraseña: no se enlaza a ciegas

Un token de Google con el correo de una cuenta que ya tiene contraseña **no abre
nada: responde 409 con el código `'cuenta'`** y el mensaje «Entra con tu
contrasena». Enlazarlo automáticamente sería entregar la cuenta de la contraseña
a quienquiera que controle el buzón de ese correo en Google en ese momento, y
sin sesión abierta no hay nada que demuestre que el que está delante es el
titular.

Con **la sesión ya abierta por contraseña** y el mismo correo, el caso es el
contrario: quien está delante ya ha probado ser el titular, así que el `sub` se
enlaza a esa cuenta, sobrescribiendo al que hubiera. Ese es el camino que tiene
quien ya tiene cuenta y quiere añadir el acceso de Google.

Los dos casos son alcanzables y los dos salen de `signInWithGoogle`, y por eso la
ruta distingue: **409 cuando el problema es que ahí hay una cuenta que este
camino no abre, 401 para todo lo demás.** Son dos preguntas distintas, y una
respuesta plana para las dos convertiría el 409 en un misterio.

### El botón en la interfaz

- **Las cuentas y el botón de Google son dos puertas distintas.** Las cuentas
  —correo y contraseña, con o sin Google— se deciden con `VITE_ACCOUNTS`: sin
  ella (ni cliente de Google) no hay panel, no se pide el script y no se hace
  ninguna petición. El botón solo necesita `VITE_GOOGLE_CLIENT_ID`; sin cliente
  no se pide el script ni se pinta nada, pero el formulario sigue. Las dos
  variables se leen en tiempo de ejecución y no al empaquetar, porque qué acceso
  hay es cosa del despliegue y no del build.
- **`AccountPanel` se monta en `StartScreen` y se lleva su estado él mismo.** No
  se hila por `App.tsx`, porque la cuenta no forma parte de la partida: una
  sesión abierta o cerrada no tiene por qué arrastrar un cambio de pantalla. Lo
  único que sale de él es un aviso, `onSessionChange`, y sale porque hay alguien
  al otro lado que necesita saber si hay con quién hablar de las estadísticas.
  Desde la ronda de las estadísticas `src/app/stats.ts` también hace `fetch`
  contra `/api`, así que el panel ya no es el único sitio de `src/` que lo hace.
- **El botón es el de Google Identity Services, no uno propio.** No existe una
  API de botón con el identificador del cliente; lo que hay es `initialize` y
  `renderButton`, y el resultado es un iframe que Google pinta dentro del
  contenedor.
- **Tres estados y ninguno más:** `cargando` (la consulta de sesión, que no se
  enseña para que la cuenta aparezca ya dicha y no crezca debajo del texto),
  `fuera` (el formulario y, si hay cliente, el botón de Google) y `dentro` (el
  correo y «Cerrar sesión»).
- **Un fallo de la consulta de sesión significa jugar sin cuenta, no un error.**
  Sin red o con el servidor caído, la pantalla se comporta exactamente como se
  comportaría sin sistema de cuentas. Enseñar un error rojo en una pantalla que
  funciona sería pedirle al visitante que arreglara el servidor.
- **Los errores que sí se enseñan van en un `role="alert"`, con el mensaje del
  servidor si lo trae y con uno propio si no.** El 409 de «ese correo ya tiene
  cuenta» llega a la persona tal y como lo escribió el servidor, que es donde
  está la frase que hay que leer.
- **La cuenta va debajo de la nota y no entre el titular y «Comenzar».** Entrar
  o salir no cambia lo que hay que elegir para jugar, y un bloque de acceso en
  mitad de la única acción de la pantalla haría parecer que jugar exige cuenta.

### El formulario de correo y contraseña

El servidor acepta correo y contraseña desde la primera ronda —`/api/auth/register`
y `/api/auth/login`—, pero al principio la interfaz no tenía dónde escribirlas: el
único acceso en la pantalla de inicio era el de Google. El formulario ya vive en
`AccountPanel`, en el mismo bloque que el botón, y por eso el 409 de Google
—«Entra con tu contrasena»— ya apunta a algún sitio.

- **Uno solo, para entrar y para crear la cuenta.** Son dos rutas y la diferencia
  es un campo; separarlas en dos pantallas obligaría a adivinar cuál quiere quien
  todavía no ha escrito nada. Un texto debajo cambia de la una a la otra.
- **La contraseña se borra al entrar y el correo se queda.** El formulario
  desaparece al entrar, y si se vuelve a salir el campo de la contraseña tiene que
  estar vacío: dejarla puesta es dejársela al siguiente que use la página. El
  correo se conserva, que ahorra volver a escribirlo y no es ningún secreto.
- **El mensaje del servidor se enseña tal cual.** Si el correo tiene mala forma,
  si la contraseña es corta o si las credenciales no coinciden, se lee la frase
  del servidor, que es donde está escrito qué pasa. El mensaje propio solo sale
  cuando no hay ninguno suyo: sin red o con un cuerpo que no se entiende.
- **La puerta es `VITE_ACCOUNTS`, no el cliente de Google.** Al principio el
  panel se ataba a `VITE_GOOGLE_CLIENT_ID`, y eso dejaba sin formulario a un
  despliegue con la base y las contraseñas pero sin Google. Ahora la señal de
  «aquí hay cuentas» es propia y admite cualquier valor no vacío; una cadena
  vacía cuenta como ausente. El cliente de Google queda como puerta de
  compatibilidad: un despliegue que ya lo tuviera antes de existir
  `VITE_ACCOUNTS` sigue teniendo cuentas sin tocar nada.

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

## Las estadísticas en la interfaz

Lo que una partida deja al morir es un entero, y lo que se lee al arrancar es una
marca. Nada de eso es una partida: no hay tablero, ni semilla, ni nombre de acción
en lo que cruza la frontera en cualquiera de los dos sentidos.

### Lo que se sube y lo que se lee

- **La dificultad se llama igual en la base, en el cable y en el cliente**:
  `'normal'` y `'agony'`, que son los dos valores de `Difficulty` en `src/game`. No
  hay tabla de traducción en ningún lado, y por eso no puede haber dos sitios que
  digan cosas distintas de la misma partida.
- **`GET /api/stats` responde 200 siempre.** Sin sesión contesta
  `{ autenticado: false }`; con sesión, el resumen entero. Un 401 aquí
  convertiría «no estás dentro» en un error de red que la interfaz tendría que
  interpretar, y no hay nada que interpretar.
- **`bestTurns` es `null` cuando no hay ninguna partida, no `0`.** Cero es una
  partida de cero turnos, que existe; `null` es no haber jugado nunca. Si se
  confundieran, la primera partida de cualquiera parecería batir un récord que no
  existe.
- **`POST /api/stats` comprueba en este orden: origen, sesión y cuerpo.** Al
  revés, un cuerpo mal formado de alguien sin sesión recibiría un 400 que
  contesta una pregunta que no se ha hecho. 400 si el cuerpo no se entiende, 401
  sin sesión, 403 sin same-origin.
- **El nivel que se sube es `state.game.threat`**, el más alto alcanzado, y no el
  que le tocaría por los turnos aguantados. La amenaza solo sube, así que es la
  misma cifra que el jugador vio en el banner y no una que el servidor recalcule
  por su cuenta.
- **El servidor suma, el cliente no manda totales.** Se manda `{ turns, level,
  difficulty }` y el servidor aplica `MAX` o incrementa dentro del propio SQL. Si
  el cliente mandara los acumulados, dos dispositivos a la vez se pisarían.
- **El cliente solo usa `bestTurns`.** `gamesPlayed`, `totalTurns` y
  `hardestLevel` viajan porque el contrato los tiene, no porque hoy se pinten.

### El aviso de sesión

`AccountPanel` es el único que sabe quién está dentro, y la sesión de juego es la
única que sabe si hay algo que subir. Se enlazan con **una sola función**,
`onSessionChange`, que va de `App` a `StartScreen` y de ahí al panel. Es un
aviso —«ahora hay sesión» o «ahora no la hay»— y no un estado: la cuenta sigue
sin gobernar ninguna pantalla.

- **El aviso dice lo que el panel cree, que es lo que enseña.** Si la consulta de
  sesión no responde, el panel se comporta como si no hubiera nadie dentro —ya lo
  hace: enseña el botón— y avisa de eso. Lo que no avisa es de una entrada o una
  salida que no se completan: ahí no cambia quién está dentro.
- **La función tiene que ser estable entre renderizaciones.** La consulta de
  sesión depende de ella, así que una que se redeclarara en cada render volvería a
  preguntar al servidor en cada render. La que pasa `App` viene de un
  `useCallback`.
- **El panel se monta una sola vez por carga.** `restart` lleva a la pantalla de
  dificultad, no a la de inicio, así que el panel no se desmonta y vuelve a
  montarse cada vez que se juega otra partida.

### La cola de invitado

Sin cuenta también se juega, y esas partidas no se tiran: se quedan en una cola en
memoria y se suben la primera vez que hay sesión.

- **En un `ref` y no en estado.** No pinta nada y no hace falta que renderice nadie
  para leerla.
- **De la cola se saca la partida antes de mandarla**, y se devuelve al frente si
  el servidor no la aceptó. Sacarla antes es lo que hace imposible que dos envíos
  se lleven la misma: entre comprobar que queda algo y sacarlo no hay ningún
  `await`.
- **Al salir de la cuenta se vacía la cola.** Sin forma de saber de qué cuenta eran
  esas partidas, mandárselas al siguiente que entre sería peor que perderlas.
- **La marca no se borra al salir.** Las partidas de esta sesión se jugaron aquí,
  siguen estando aquí, y quitarla haría que la comparación del récord dependiera
  de si alguien entró o salió a mitad de la página.
- **La marca de la cuenta se suma con `Math.max`, no se asigna.** Las dos son
  marcas de lo mismo —cuánto se aguantó—, y por eso ninguna borra a la otra.
- **Hoy casi no hay nada que subir, y conviene saberlo.** La mejor partida vive en
  un `useState` y se pierde al recargar: lo que la cola rescata es lo de esa
  sesión. El valor de las cuentas está en las partidas siguientes, no en un
  historial que nunca existió.

### Dónde se dispara

Dos efectos y ninguno más:

- **Al montar**, se lee la marca y se vacía la cola. Lo que llegue después de que
  el componente se haya ido ya no se aplica.
- **Al morir**, en un efecto sobre la pantalla `dead`. Va ahí y no dentro de
  `performAction` ni de la rendición por dos motivos: así no hay una tercera
  forma de morir que pueda olvidarse de avisar, y el estado de esa pantalla es el
  que el motor acaba de devolver, con su cuenta de turnos y su nivel.
- **Una muerte reproducida desde un enlace no sube nada.** La partida de un enlace
  no es del que la ve, y eso ya está dicho en `selectDifficulty`, que es donde la
  partida pasa a ser suya.
- **Un `GET` de más al arrancar con la sesión ya abierta.** La consulta de sesión
  del panel y la lectura de la marca del juego son dos preguntas que se hacen a la
  vez y ninguna sabe de la otra. Se acepta: una petición de más al abrir la página
  es más barata que un estado compartido que las coordine.

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
página. El formulario de alta, que era lo que bloqueaba al segundo, ya está;
escribir el aviso sigue pendiente.
