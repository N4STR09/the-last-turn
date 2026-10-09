/**
 * Si este despliegue tiene cuentas.
 *
 * El panel de cuenta se enseña cuando el despliegue tiene con qué sostenerlas, y
 * eso no es lo mismo que tener un cliente de Google: el acceso con correo y
 * contraseña funciona sin Google, y atar la puerta del panel al cliente de
 * Google dejaba sin cuentas a un despliegue que solo quería contraseñas.
 *
 * La señal propia es `VITE_ACCOUNTS`, y vale cualquier cosa no vacía: la
 * variable no guarda una dirección ni un identificador, solo dice que este
 * despliegue quiere cuentas, y por eso no se interpreta su contenido. Una cadena
 * vacía cuenta como ausente, igual que en `googleClientId`: una configuración a
 * medias no es una configuración.
 *
 * Queda una puerta de compatibilidad hacia atrás: si hay cliente de Google, las
 * cuentas se dan por habilitadas aunque `VITE_ACCOUNTS` no esté. Un despliegue
 * que ya tenía Google antes de que existiera esta variable no debería quedarse
 * sin cuentas por añadir una señal nueva.
 */

import { googleClientId } from './google-sign-in';

/**
 * Si hay cuentas en este despliegue.
 *
 * Se lee en cada llamada y no en la carga del módulo para que la variable se
 * pueda cambiar entre una petición y otra, que es como se comporta `process.env`
 * en las pruebas y como se comporta `.env` en un despliegue que se renueva. El
 * `typeof` cubre el caso de que el valor llegue por otro camino que no sea un
 * `.env`, donde un `1` escrito sin comillas sería un número y no el texto que se
 * espera.
 */
export function accountsEnabled(): boolean {
  const env = import.meta.env as Record<string, unknown>;
  const value = env['VITE_ACCOUNTS'];

  if (typeof value === 'string' && value !== '') {
    return true;
  }

  return googleClientId() !== undefined;
}
