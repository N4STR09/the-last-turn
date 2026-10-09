import { ITERATIONS } from './password';

/**
 * Cuenta de iteraciones que usa el servidor.
 *
 * Vive en su propio archivo porque es el unico punto donde se decide algo que no
 * es ni logica de negocio ni logica de seguridad, sino la configuracion del
 * entorno. Esta separacion importa: `password.ts` dice cuantas iteraciones hacen
 * falta para que un hash sea serio, y este archivo dice cuantas se pueden pagar
 * aqui. No son la misma pregunta.
 *
 * ## Por que esta variable existe
 *
 * El plan gratuito de Cloudflare Workers da 10 ms de CPU por peticion. El valor
 * por defecto de `password.ts` esta puesto para caber ahi, asi que en el plan
 * gratuito lo normal es no configurar nada. Esta variable sirve para lo
 * contrario: para que un despliegue con plan de pago suba el numero sin tocar el
 * codigo, por ejemplo a los 600 000 que recomienda OWASP. El suelo coincide con
 * el valor por defecto, asi que la variable solo puede subir: no hay forma de
 * dejarlo por debajo de lo que viene escrito en el codigo.
 *
 * No es una variable que llegue del cliente: no aparece en ninguna peticion, no se
 * lee del cuerpo ni de ninguna cabecera. Se lee de la configuracion de despliegue,
 * que es donde solo puede escribir quien ya puede desplegar, que es la misma
 * persona que podria cambiar el codigo. No amplia la superficie de ataque.
 *
 * ## El fallo que tiene que evitar
 *
 * Si el valor de la configuracion es basura, hay que usar {@link ITERATIONS} y no
 * el valor leido. Un `NaN`, un cero o un negativo no deberian nunca llegar a
 * `hashPassword`: con 0 iteraciones el "hash" seria la contrasena pasada por
 * un solo HMAC, que cualquiera revierte probando el diccionario. Errar hacia el
 * valor seguro es la unica direccion en la que se puede errar.
 */

/**
 * Las iteraciones que hay que usar, segun la configuracion del entorno.
 *
 * Devuelve `undefined` si no hay configuracion, que es el caso de produccion:
 * `undefined` hace que `hashPassword` use su propio valor, que es 5 000.
 *
 * @param valor el valor leido de la configuracion, ya sea `string`, `number` o
 *   lo que sea que Cloudflare pase
 */
export function iterationsForEnvironment(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  // Solo texto y numero, nada mas. Comprobar el tipo antes de convertir no es
  // paranoid sin motivo: `Number([100000])` es 100000, porque un array de un
  // elemento se convierte a su unico elemento, y un valor asi entraria como si
  // hubiera venido escrito. La configuracion solo manda texto, asi que cualquier
  // otra cosa es algo que no deberia estar llegando.
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  // `Number('')` es 0 y no `NaN`, y `Number(null)` tambien es 0, asi que las dos
  // formas de "no hay nada" se atienden arriba antes de llegar aqui. Lo que queda
  // es comprobar que el numero es un entero positivo de un tamano razonable.
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  if (parsed < MINIMUM_ITERATIONS) {
    return undefined;
  }
  if (parsed > MAXIMUM_ITERATIONS) {
    return undefined;
  }

  return parsed;
}

/**
 * Lo mas bajo que se permite configurar.
 *
 * No es una sugerencia, es un suelo, y coincide con el valor por defecto a
 * proposito: lo que viene en el codigo es lo mas flojo que se admite, y la
 * configuracion solo puede subirlo. Un cero, que convertiria el hash en un solo
 * HMAC, se queda fuera por el mismo sitio.
 */
export const MINIMUM_ITERATIONS = 5_000;

/**
 * Lo mas alto que se permite configurar.
 *
 * El limite no es de seguridad sino de cortesia: con un millon de iteraciones un
 * acceso tarda mas de un segundo, y con diez millones la peticion se corta por
 * tiempo de espera antes de que acabe. Quien quiera un hasheo mas fuerte tiene
 * que subir de plan, no subir este numero hasta que el servidor deje de responder.
 */
export const MAXIMUM_ITERATIONS = 10_000_000;

/** El valor por defecto, expuesto para poder comprobarlo desde las pruebas. */
export const ENVIRONMENT_DEFAULT = ITERATIONS;
