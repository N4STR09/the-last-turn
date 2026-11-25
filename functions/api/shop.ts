import { resolveSession } from '../_lib/accounts';
import { bindD1 } from '../_lib/database';
import { errorResponse, isSameOrigin, jsonResponse, readSessionToken } from '../_lib/http';
import { priceOf, purchaseObject, readProgression } from '../_lib/unlocks';

/**
 * La compra de un objeto de la tienda.
 *
 * Una sola acción y una sola escritura. El cuerpo lleva `{ objeto }`, que tiene
 * que ser uno de los ids del catálogo cerrado de `_lib/unlocks.ts`: no hay
 * precios en la petición, no hay importes que declarar ni un identificador que
 * mandar para saber de qué cuenta es —la cuenta viene de la cookie, como en el
 * resto de las rutas—, y un id desconocido ni siquiera llega a tocar la base de
 * datos.
 *
 * **El orden de las respuestas está elegido.** Primero quién pide —401 sin
 * sesión—, después qué pide —400 con un cuerpo que no se entiende o fuera del
 * catálogo—, después el saldo —409 con la cifra que hace falta—. Una petición
 * sin sesión no puede gastar nada, y contestarle 400 le diría que lo que falla
 * es su forma.
 *
 * **El doble gasto no se defiende aquí, se defiende en la sentencia.**
 * `purchaseObject` comprueba el saldo y escribe en una sola sentencia atómica,
 * así que dos peticiones simultáneas no pueden gastar dos veces la misma moneda
 * sin que este archivo tenga que saberlo. Lo único que hace la ruta después es
 * releer la colección: con ella distingue «escrito ahora» de «ya estaba», y los
 * dos casos responden exactamente lo mismo, que es lo que hace repetir una
 * compra indistinguible de un primer intento cuya respuesta se perdió.
 *
 * **Sin sesión no hay ninguna petición del cliente que llegar hasta aquí** en un
 * despliegue con la tienda pintada: la interfaz consulta primero y no ofrece
 * comprar si no hay cuenta. Este 401 es la red de seguridad por si la petición
 * llega de todas formas —otra pestaña, un guion—, no el camino normal.
 */

interface Env {
  readonly DB: D1Database;
}

/**
 * El id del objeto del cuerpo, o `null` si el cuerpo no trae uno usable.
 *
 * Un cuerpo que no es objeto, un campo `objeto` ausente y un campo `objeto` de
 * otro tipo acaban todos en `null`, y por el mismo motivo: los tres significan
 * «esta petición no pide ningún objeto concreto», que es exactamente lo que la
 * ruta no puede atender.
 */
function objetoFrom(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const value = (body as { objeto?: unknown }).objeto;
  return typeof value === 'string' ? value : null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOrigin(request)) {
    return errorResponse('No se puede hacer esta petición desde aquí.', 403);
  }

  const database = bindD1(env.DB);
  const token = readSessionToken(request.headers.get('cookie'));
  const player = await resolveSession(database, token);

  if (player === null) {
    return errorResponse('Inicia sesión para comprar objetos.', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('El cuerpo de la petición no es válido.', 400);
  }

  const objeto = objetoFrom(body);
  if (objeto === null) {
    return errorResponse('El cuerpo de la petición no es válido.', 400);
  }

  const price = priceOf(objeto);
  if (price === null) {
    return errorResponse('Ese objeto no está en la tienda.', 400);
  }

  await purchaseObject(database, player.playerId, objeto);
  const progression = await readProgression(database, player.playerId);

  // Escrita o no, la respuesta sale de releer la colección, que es el estado
  // real y no una suposición: si el objeto ya estaba, la compra es repetición y
  // responde igual que la primera; si no estaba, el único motivo posible es que
  // el saldo no llegaba, y entonces el mensaje lleva las dos cifras que quien
  // compra necesita para saber cuánto le falta.
  if (!progression.objects.includes(objeto)) {
    return errorResponse(
      `No tienes saldo suficiente: necesitas ${price} monedas y tienes ${progression.balance}.`,
      409,
    );
  }

  return jsonResponse({
    autenticado: true,
    objeto,
    balance: progression.balance,
    objects: progression.objects,
  });
};
