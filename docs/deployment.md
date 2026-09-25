# Publicación web con Cloudflare Pages

## Decisión de publicación

| Aspecto | Valor |
|---|---|
| Repositorio | GitHub |
| Modo | Integración Git |
| Nombre del proyecto | `the-last-turn` |
| URL prevista | `https://the-last-turn.pages.dev` |
| Dominio propio | No en la primera publicación |

El modo de integración Git es irreversible en Cloudflare Pages, así que queda registrado aquí para que la decisión no dependa de una conversación.

## Objetivo

*The Last Turn* se distribuye como una web 100 % estática. Una persona jugará abriendo una URL HTTPS en su navegador, sin instalar la aplicación, crear una cuenta ni configurar un servidor. El proyecto no necesita Pages Functions, Workers, backend, base de datos ni variables de entorno de producto.

El resultado de `npm run build` es el directorio `dist/`. Este directorio contiene el único artefacto que Cloudflare Pages necesita publicar.

## Verificación antes de publicar

```text
npm ci
npm run verify
npm run build
```

`npm run verify` incluye typecheck, lint, cobertura, build y la comprobación de presupuestos de bundle. La publicación debe usar un commit que haya pasado esa barrera completa.

## Opción recomendada: integración Git

Cloudflare Pages puede compilar automáticamente el proyecto cuando se conecte un repositorio de GitHub o GitLab:

1. Publicar el repositorio en el proveedor elegido, que puede ser privado.
2. En Cloudflare Dashboard, abrir **Workers & Pages** y crear una aplicación Pages conectada a Git.
3. Seleccionar el repositorio y la rama de producción `main`.
4. Usar estos valores:
   - directorio raíz: `/` o el repositorio raíz;
   - comando de build: `npm run build`;
   - directorio de salida: `dist`.
5. Guardar y desplegar.

Cloudflare construirá el proyecto y publicará una URL con la forma `https://<project-name>.pages.dev`. Los commits posteriores provocarán despliegues automáticos y las ramas distintas de producción pueden obtener vistas previas.

El archivo `.node-version` fija Node.js `24.19.0`. Cloudflare Pages usa Node.js `22.16.0` de forma predeterminada y su build image v3 no deduce la versión desde `package.json#engines`; el archivo evita que una versión futura del build image rompa el rango de Node del proyecto. No hacen falta secretos ni variables de entorno propias.

## Alternativa: carga directa

Si todavía no se quiere conectar un repositorio, Cloudflare Pages permite publicar el build ya generado:

```text
npm run build
```

Después se puede subir la carpeta `dist/` desde el dashboard o usar Wrangler de forma puntual. Se fija la versión para que el comando sea reproducible y no ejecute un paquete de terceros sin versión conocida:

```text
npx wrangler@4 pages project create the-last-turn
npx wrangler@4 pages deploy dist --project-name=the-last-turn
```

Wrangler es una herramienta de mantenimiento, no una dependencia del juego ni un requisito para la persona que juega. Este camino no es el elegido para la primera publicación: el proyecto `the-last-turn` se creará con integración Git, que es irreversible.

**Decisión que conviene tomar antes del primer despliegue:** la integración Git y la carga directa son modos de proyecto distintos. Cloudflare indica que un proyecto Pages creado con uno no puede cambiar al otro; habría que crear otro proyecto.

## Rutas y caché

Vite genera rutas relativas mediante `base: './'`, por lo que el mismo build funciona en la raíz de un dominio y en directorios de alojamiento. El favicon también usa una ruta relativa. La aplicación no tiene rutas de navegación interna que requieran una regla SPA de redirección.

Este comportamiento se comprobó sirviendo `dist/` desde `/juego/` en un host estático sin fallback de SPA: el documento, el script, la hoja de estilos y el favicon resolvieron bajo ese prefijo y la aplicación fue interactiva. En Cloudflare Pages el proyecto se sirve en la raíz del dominio, de modo que las rutas relativas se resuelven igual y no es necesario añadir reglas de reescritura.

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

Cloudflare conserva los despliegues anteriores; desde el dashboard se puede volver a una implementación de producción conocida si una versión publicada regresiona. Para una actualización se debe repetir la verificación completa antes de integrar el cambio en la rama que dispara producción.

## Fuentes oficiales

- Vite, `base`: https://vite.dev/config/shared-options.html#base
- Cloudflare Pages, Vite: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- Cloudflare Pages, configuración de build: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Pages, imagen de build y `.node-version`: https://developers.cloudflare.com/pages/configuration/build-image/
- Cloudflare Pages, integración Git: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages, carga directa: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages, rollback: https://developers.cloudflare.com/pages/configuration/rollbacks/
