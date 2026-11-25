/**
 * La tienda en el cliente: el catálogo para pintar y las peticiones de compra.
 *
 * Sigue el mismo molde que `progression.ts` y `stats.ts`: sin React, sin estado
 * de la partida y con todo fallo traducido a un resultado que la interfaz sabe
 * pintar. La diferencia está en el papel de cada mitad. Aquí el cliente manda
 * un identificador de un catálogo cerrado —nunca un precio, nunca un importe—
 * y el servidor decide si hay saldo; la copia del catálogo que vive en este
 * archivo solo sirve para enseñar nombres y precios sin una petición previa, y
 * si algún día discrepara de la del servidor, manda la del servidor: la compra
 * se rechaza en la sentencia, no en la pantalla.
 *
 * **Sin cuentas no se pinta ni se pide nada.** La puerta es `accountsEnabled()`
 * y la comprueba el componente antes de montar efecto; este módulo no la
 * conoce, igual que `progression.ts` tampoco conoce al panel que lo llama.
 */

/** Un objeto del catálogo, con el nombre con el que se enseña. */
export interface ShopItem {
  readonly id: string;
  readonly nombre: string;
  readonly precio: number;
}

/**
 * El catálogo, en el orden en que se enseña.
 *
 * Los precios son una copia de los de `_lib/unlocks.ts`, puesta aquí para pintar
 * «10 monedas» debajo de cada objeto sin esperar a una respuesta. La defensa
 * contra el gasto en exceso no es esta lista: es el saldo que comprueba el
 * servidor dentro de su propia sentencia.
 */
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'ceniza', nombre: 'Ceniza', precio: 10 },
  { id: 'superviviente', nombre: 'Superviviente', precio: 15 },
  { id: 'ambar', nombre: 'Ámbar', precio: 20 },
  { id: 'oxido', nombre: 'Óxido', precio: 25 },
  { id: 'calavera-doble', nombre: 'Calavera doble', precio: 30 },
  { id: 'nomada', nombre: 'Nómada', precio: 40 },
];

const UNLOCKS_URL = '/api/unlocks';
const PURCHASE_URL = '/api/shop/purchase';

const PURCHASE_ERROR = 'No se ha podido completar la compra. Inténtalo otra vez.';

/**
 * Lo que se sabe de la tienda tras consultarla.
 *
 * `dentro` trae saldo y objetos; `fuera` es «esta cuenta no tiene sesión»,
 * que no es un fallo sino la respuesta a «¿qué tiene mi cuenta?»; `error` es
 * lo demás —sin red, servidor caído o un cuerpo que no se entiende— y es el
 * único que la interfaz enseña como error con reintento.
 */
export type ShopState =
  | { readonly kind: 'dentro'; readonly balance: number; readonly objects: readonly string[] }
  | { readonly kind: 'fuera' }
  | { readonly kind: 'error' };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Traduce el cuerpo de `/api/unlocks` en un estado de tienda.
 *
 * Se reutiliza para la respuesta de la compra porque las dos rutas hablan de lo
 * mismo: un `autenticado` con un saldo y sus objetos. Un cuerpo que no es
 * objeto acaba en `error`, y `autenticado` distinto de `true` en `fuera`, con
 * el mismo criterio que en `progression.ts`.
 */
function stateFrom(payload: unknown): ShopState {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { kind: 'error' };
  }

  const body = payload as {
    autenticado?: unknown;
    balance?: unknown;
    objects?: unknown;
  };
  if (body.autenticado !== true) {
    return { kind: 'fuera' };
  }
  if (!isCount(body.balance) || !isStringList(body.objects)) {
    return { kind: 'error' };
  }
  return { kind: 'dentro', balance: body.balance, objects: body.objects };
}

/**
 * Lee el estado de la tienda de la cuenta que está dentro.
 *
 * Nunca lanza: cualquier fallo se traduce a `error`, que la interfaz enseña
 * con un botón de reintento en lugar de romper la pantalla.
 */
export async function fetchShopState(): Promise<ShopState> {
  try {
    const response = await fetch(UNLOCKS_URL);
    return stateFrom(await response.json());
  } catch {
    return { kind: 'error' };
  }
}

/** El resultado de intentar comprar, por el camino que sea. */
export type PurchaseOutcome =
  | { readonly ok: true; readonly balance: number; readonly objects: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** El mensaje de `error` de un cuerpo, o `null` si no trae ninguno usable. */
async function errorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' && payload.error !== ''
      ? payload.error
      : null;
  } catch {
    return null;
  }
}

/**
 * Compra un objeto del catálogo.
 *
 * La petición lleva solo el identificador: el precio lo pone el servidor y la
 * cuenta llega en la cookie. Un `false` trae el mensaje que hay que enseñar,
 * que cuando lo mandó el servidor es literalmente el que escribió él —el saldo
 * que hace falta, por ejemplo—, y cuando no hubo servidor es el mensaje propio.
 */
export async function purchaseObject(objeto: string): Promise<PurchaseOutcome> {
  try {
    const response = await fetch(PURCHASE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ objeto }),
    });

    if (response.ok) {
      const state = stateFrom(await response.json());
      if (state.kind === 'dentro') {
        return { ok: true, balance: state.balance, objects: state.objects };
      }
      // Un 2xx con un cuerpo que no se entiende no es una compra de la que se
      // pueda enseñar el saldo. No se inventa un estado: se avisa y se deja que
      // quien compra vuelva a intentarlo, que la ruta es idempotente.
      return { ok: false, message: PURCHASE_ERROR };
    }

    return { ok: false, message: (await errorMessage(response)) ?? PURCHASE_ERROR };
  } catch {
    return { ok: false, message: PURCHASE_ERROR };
  }
}
