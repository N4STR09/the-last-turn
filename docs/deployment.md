# Publicación web con Cloudflare

## Decisión de publicación

| Aspecto | Valor |
|---|---|
| Repositorio | GitHub |
| Modo | Integración Git (Workers Builds) |
| Tipo de proyecto | Worker con Static Assets |
| Rama de producción | `main` |
| Nombre del proyecto | `the-last-turn` |
| URL pública disponible | `https://the-last-turn.erpro-ferru.workers.dev` |
| Dominio propio | No en la primera publicación |
| Estado | **Integración Git confirmada activa.** El despliegue de la Fase 2 (commit `4e6d856`) se compiló y publicó solo, en unos 50 segundos tras el `push`. No hace falta usar Wrangler para actualizar. |

## Publicar una actualización

```text
npm run verify
git push origin main
```

El `verify` es obligatorio antes del `push`: Cloudflare compila la rama sin volver
a pasar la barrera, así que un commit que no la haya pasado llega a producción
igual. Tras el `push`, la publicación tarda del orden de un minuto. Para
confirmarla, comparar el nombre del bundle servido con el de `dist/assets/`: si
coinciden, el despliegue es el esperado.

Cloudflare conserva los despliegues anteriores, así que una regresión se puede
revertir desde el dashboard. La alternativa es revertir el commit en local y
volver a hacer `push`.

## Qué publica Cloudflare

El proyecto de Cloudflare es un **Worker con Static Assets** conectado a Git, no
un proyecto Pages. Lo delatan la URL pública, que termina en `workers.dev`, y el
paso de publicación, que ejecuta `wrangler deploy`.

Durante el bloque de cuentas se supuso lo contrario y la publicación se rompió:
`wrangler.toml` estaba escrito como si fuera Pages (`pages_build_output_dir`) y
`wrangler deploy`, que busca un Worker o un directorio de assets, no encontraba
ninguno de los dos. El error era `Missing entry-point to Worker script or to
assets directory`, precedido de un aviso de que se estaba usando `wrangler
deploy` en un proyecto detectado como Pages.

Hoy el repositorio está escrito para el proyecto que existe:

1. `npm run build` compila el cliente con Vite a `dist/` y, con
   `wrangler pages functions build`, compila `functions/` a un único Worker en
   `.worker/index.js`.
2. `wrangler deploy` publica ese Worker y sube `dist/` como assets estáticos
   (binding `env.ASSETS`). El Worker resuelve `/api/*` y deja el resto a los
   assets.
3. D1 se enlaza como binding `DB` cuando exista la base. Hasta entonces el bloque
   va comentado en `wrangler.toml` y `/api/health` responde 503 diciendo la
   verdad.

`functions/` sigue siendo el origen del servidor; lo que cambia respecto de un
proyecto Pages es que no hay enrutado por ficheros en la plataforma: el Worker
compilado lleva dentro las rutas. El juego sigue siendo un solo origen: sin CORS
y con `SameSite=Lax` suficiente para la cookie de sesión. No se pide
`nodejs_compat`, porque el servidor solo usa funciones web estándar (`fetch`,
`crypto.subtle`, `TextEncoder`, `URL`).

## Verificación antes de publicar

```text
npm ci
npm run verify
```

`npm run verify` incluye typecheck, lint, cobertura, build —que ahora también
compila el Worker de `functions/`— y la comprobación de presupuestos de bundle.
La publicación debe usar un commit que haya pasado esa barrera completa.

## Integración Git en Cloudflare

El proyecto se conecta una vez y a partir de ahí Cloudflare compila y publica en
cada `push` a `main`:

1. Publicar el repositorio en el proveedor elegido, que puede ser privado.
2. En Cloudflare Dashboard, abrir **Workers & Pages** y crear un Worker conectado
   a Git (Workers Builds).
3. Seleccionar el repositorio y la rama de producción `main`.
4. Usar estos valores:
   - directorio raíz: `/` o el repositorio raíz;
   - comando de build: `npm run build`;
   - comando de deploy: `npx wrangler deploy` (el valor por defecto).
5. Guardar y desplegar.

Cloudflare construirá el proyecto y publicará una URL con la forma
`https://<project-name>.<subdominio>.workers.dev`. Los commits posteriores
provocarán despliegues automáticos y las ramas distintas de producción pueden
obtener vistas previas.

El archivo `.node-version` fija Node.js `24.19.0`. Cloudflare usa una versión de
Node.js predeterminada y su build image no la deduce desde
`package.json#engines`; el archivo evita que una versión futura del build image
rompa el rango de Node del proyecto.

## Alternativa: publicación manual

Si hiciera falta publicar sin pasar por la integración Git:

```text
npm run deploy
```

`npm run deploy` compila y después llama a `wrangler deploy` con la configuración
de `wrangler.toml`. Requiere una sesión iniciada en Cloudflare
(`wrangler login`).

Wrangler es una herramienta de mantenimiento, no una dependencia del juego ni un
requisito para la persona que juega. Este camino no es el elegido para la
primera publicación: el proyecto `the-last-turn` usa integración Git.

## Rutas y caché

Vite genera rutas relativas mediante `base: './'`, por lo que el mismo build
funciona en la raíz de un dominio y en directorios de alojamiento. El favicon
también usa una ruta relativa. La aplicación no tiene rutas de navegación interna
que requieran una regla SPA de reescritura.

Este comportamiento se comprobó sirviendo `dist/` desde `/juego/` en un host
estático sin fallback de SPA: el documento, el script, la hoja de estilos y el
favicon resolvieron bajo ese prefijo y la aplicación fue interactiva. El Worker
sirve los assets en la raíz del dominio, de modo que las rutas relativas se
resuelven igual y no hace falta añadir reglas de reescritura.

## Aceptación tras publicar

1. Abrir la URL HTTPS en una ventana privada.
2. Completar Inicio → Dificultad → Partida → Fin → Reinicio.
3. Confirmar que recargar vuelve a Inicio.
4. Revisar la consola y el panel de red:
   - cero errores;
   - cero peticiones a terceros;
   - solo recursos del propio origen.
5. Comprobar que los botones mantienen foco visible, contraste y objetivos táctiles.
6. Verificar que no aparece ninguna instalación, descarga o registro de usuario.

Cloudflare conserva los despliegues anteriores; desde el dashboard se puede
volver a una implementación de producción conocida si una versión publicada
regresiona. Para una actualización se debe repetir la verificación completa
antes de integrar el cambio en la rama que dispara producción.

## Fuentes oficiales

- Vite, `base`: https://vite.dev/config/shared-options.html#base
- Cloudflare Workers, Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Workers, integración Git (Workers Builds): https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Workers, `wrangler deploy`: https://developers.cloudflare.com/workers/wrangler/commands/#deploy
- Cloudflare, `wrangler pages functions build`: https://developers.cloudflare.com/workers/wrangler/commands/pages/
- Cloudflare, migrar de Pages a Workers: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- Cloudflare Workers, rollback: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
