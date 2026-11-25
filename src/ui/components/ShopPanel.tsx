import { useCallback, useEffect, useState } from 'react';

import { AppButton } from './AppButton';
import { accountsEnabled } from '../../app/accounts';
import { SHOP_ITEMS, fetchShopState, purchaseObject } from '../../app/shop';
import type { ShopState } from '../../app/shop';

/**
 * La tienda de objetos.
 *
 * Se monta como panel y no como pantalla: no es una etapa del flujo de partida
 * y no debería obligar a nadie a salir de donde está para comprar. Sin cuentas
 * no devuelve nada y no hace ninguna petición, con el mismo criterio que
 * `AccountPanel`: la tienda vive de la sesión, y un despliegue que no tiene
 * cuentas no debería ni preguntar si hay alguien dentro.
 *
 * Los estados son explícitos y son cuatro: `cargando` mientras se consulta,
 * `error` con su botón de reintento cuando la consulta no se puede leer,
 * `fuera` cuando no hay sesión —que no es un fallo, es la respuesta— y `dentro`
 * con el saldo, el catálogo y los objetos ya comprados. Ninguno se deduce de
 * otro: no hay una lectura que enseñe «no hay nada» cuando lo que hubo fue un
 * fallo de red.
 *
 * El aviso de compra fallida vive aparte del estado de la consulta: la tienda
 * sigue cargada y usable, y el mensaje —del servidor cuando lo mandó él— se va
 * con la siguiente compra o con una recarga, no deja la pantalla roja.
 */

/** Lo que la consulta deja pintando, incluido el tiempo que tarda. */
type View = { readonly kind: 'cargando' } | ShopState;

const LOAD_ERROR = 'No se ha podido cargar la tienda. Inténtalo otra vez.';

export function ShopPanel() {
  const enabled = accountsEnabled();
  const [view, setView] = useState<View>({ kind: 'cargando' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);

  // La consulta inicial. Se hace una vez y solo si el despliegue tiene cuentas;
  // el `vivo` es el mismo cuidado que en `AccountPanel`: si el panel se va
  // antes de que la respuesta llegue, no se escribe en una pantalla que ya no
  // está. El reintento va por su propio camino más abajo, que solo se alcanza
  // estando montado.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let vivo = true;
    void fetchShopState().then((resultado) => {
      if (vivo) {
        setView(resultado);
      }
    });

    return () => {
      vivo = false;
    };
  }, [enabled]);

  const reintentar = useCallback(() => {
    setView({ kind: 'cargando' });
    setAviso(null);
    void fetchShopState().then((resultado) => {
      setView(resultado);
    });
  }, []);

  const comprar = useCallback((objeto: string) => {
    setAviso(null);
    setPendiente(objeto);
    void purchaseObject(objeto).then((resultado) => {
      setPendiente(null);
      if (resultado.ok) {
        setView({
          kind: 'dentro',
          balance: resultado.balance,
          objects: resultado.objects,
        });
        return;
      }
      setAviso(resultado.message);
    });
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <aside
      aria-label="Tienda"
      className="shop-panel"
      hidden={view.kind === 'cargando'}
    >
      <h2 className="shop-panel__heading">Tienda</h2>
      {view.kind === 'dentro' ? (
        <>
          <p className="shop-panel__balance">
            {view.balance === 1 ? '1 moneda' : `${view.balance} monedas`}
          </p>
          <ul className="shop-panel__items">
            {SHOP_ITEMS.map((item) => {
              const enCarrito = view.objects.includes(item.id);
              const alcanza = view.balance >= item.precio;
              return (
                <li key={item.id} className="shop-panel__item">
                  <span className="shop-panel__name">{item.nombre}</span>
                  <span className="shop-panel__price">{item.precio} monedas</span>
                  {enCarrito ? (
                    <span className="shop-panel__owned">Comprado</span>
                  ) : (
                    <AppButton
                      className="shop-panel__buy"
                      variant="secondary"
                      disabled={!alcanza || pendiente !== null}
                      onClick={() => comprar(item.id)}
                    >
                      {pendiente === item.id ? 'Comprando...' : 'Comprar'}
                    </AppButton>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {view.kind === 'error' ? (
        <div className="shop-panel__error">
          <p className="shop-panel__notice" role="alert">
            {LOAD_ERROR}
          </p>
          <AppButton variant="secondary" onClick={reintentar}>
            Reintentar
          </AppButton>
        </div>
      ) : null}
      {view.kind === 'fuera' ? (
        <p className="shop-panel__hint">
          Inicia sesión en tu cuenta para comprar objetos.
        </p>
      ) : null}
      {aviso === null ? null : (
        <p className="shop-panel__notice" role="alert">
          {aviso}
        </p>
      )}
    </aside>
  );
}
