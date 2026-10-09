import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as googleSignIn from '../google-sign-in';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CLIENTE = 'cliente-de-pruebas.apps.googleusercontent.com';

/**
 * El módulo se vuelve a importar en cada prueba porque guarda en el módulo la
 * petición de script que está en curso. Con la misma instancia, una prueba que
 * empezara a cargar el script dejaria la promesa sin resolver colgada de la
 * siguiente, que veria una petición en curso que no es suya y no volveria a
 * pedir nada.
 */
let google: typeof googleSignIn;

beforeEach(async () => {
  vi.resetModules();
  google = await import('../google-sign-in');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const script of document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)) {
    script.remove();
  }
});

function buscarScript(): HTMLScriptElement | null {
  return document.querySelector(`script[src="${SCRIPT_SRC}"]`);
}

describe('googleClientId', () => {
  it('no da nada si la variable no está puesta', () => {
    expect(google.googleClientId()).toBeUndefined();
  });

  it('devuelve el cliente cuando la variable tiene valor', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENTE);

    expect(google.googleClientId()).toBe(CLIENTE);
  });

  it('trata una cadena vacía como si no estuviera', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    expect(google.googleClientId()).toBeUndefined();
  });
});

describe('loadGoogleIdentity', () => {
  it('no pide el script si la página ya lo tiene', async () => {
    vi.stubGlobal('google', { accounts: { id: {} } });

    await expect(google.loadGoogleIdentity()).resolves.toBeUndefined();

    expect(buscarScript()).toBeNull();
  });

  it('pide el script una sola vez mientras carga', async () => {
    const primero = google.loadGoogleIdentity();
    const segundo = google.loadGoogleIdentity();

    expect(document.querySelectorAll('script')).toHaveLength(1);
    const script = buscarScript();
    expect(script).not.toBeNull();

    const resultado = Promise.all([primero, segundo]).then(
      () => 'cargado',
      () => 'fallido',
    );
    script?.dispatchEvent(new Event('load'));

    expect(await resultado).toBe('cargado');
  });

  it('retira el script que ha fallado y permite volver a intentarlo', async () => {
    const primero = google.loadGoogleIdentity();
    const resultado = primero.then(
      () => 'cargado',
      () => 'fallido',
    );
    const script = buscarScript();
    expect(script).not.toBeNull();

    script?.dispatchEvent(new Event('error'));

    // Dos cosas y las dos hacen falta: el fallo se propaga a quien lo pidió, y
    // la página no se queda con un `<script>` muerto que haría creer a la
    // siguiente petición que ya se había intentado.
    expect(await resultado).toBe('fallido');
    expect(buscarScript()).toBeNull();

    const segundo = google.loadGoogleIdentity();
    expect(document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)).toHaveLength(1);

    const reintento = segundo.then(
      () => 'cargado',
      () => 'fallido',
    );
    buscarScript()?.dispatchEvent(new Event('load'));

    expect(await reintento).toBe('cargado');
  });
});

describe('renderGoogleButton', () => {
  it('no hace nada si el script no ha dejado su API', () => {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = '<span>lo que hubiera</span>';
    const alRecibir = vi.fn();

    google.renderGoogleButton(contenedor, CLIENTE, alRecibir);

    expect(contenedor.innerHTML).toBe('<span>lo que hubiera</span>');
    expect(alRecibir).not.toHaveBeenCalled();
  });

  it('inicializa con el cliente, vacía el contenedor y pinta', () => {
    const alRecibir = vi.fn();
    const inicializar = vi.fn();
    const pintar = vi.fn();
    vi.stubGlobal('google', {
      accounts: { id: { initialize: inicializar, renderButton: pintar } },
    });
    const contenedor = document.createElement('div');
    contenedor.innerHTML = '<span>lo de otro montaje</span>';

    google.renderGoogleButton(contenedor, CLIENTE, alRecibir);

    expect(inicializar).toHaveBeenCalledWith({
      client_id: CLIENTE,
      callback: expect.any(Function),
    });
    expect(pintar).toHaveBeenCalledWith(contenedor, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 260,
    });
    // Volver a entrar con Google vuelve a pasar por aquí. Si no se vaciara, cada
    // salida y cada entrada dejaría un botón encima del anterior.
    expect(contenedor.querySelector('span')).toBeNull();
  });

  it('entrega la credencial al llamante solo si es texto y no vacío', () => {
    const recibidas: string[] = [];
    const callbacks: Array<(respuesta: { credential?: unknown }) => void> = [];
    vi.stubGlobal('google', {
      accounts: {
        id: {
          initialize: (opciones: { callback: (r: { credential?: unknown }) => void }) => {
            callbacks.push(opciones.callback);
          },
          renderButton: vi.fn(),
        },
      },
    });
    const contenedor = document.createElement('div');

    google.renderGoogleButton(contenedor, CLIENTE, (credential) => {
      recibidas.push(credential);
    });

    expect(callbacks).toHaveLength(1);
    const callback = callbacks[0];
    expect(callback).toBeDefined();

    callback?.({ credential: 'identificador-firmado' });
    callback?.({ credential: '' });
    callback?.({ credential: 7 });
    callback?.({});

    expect(recibidas).toEqual(['identificador-firmado']);
  });
});
