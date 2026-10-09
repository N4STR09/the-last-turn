import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountPanel } from '../components/AccountPanel';

const CLIENTE = 'cliente-de-pruebas.apps.googleusercontent.com';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CORREO = 'alguien@example.com';
const SIGN_IN_ERROR =
  'No se ha podido abrir la sesión con Google. Inténtalo otra vez.';
const LOGIN_ERROR = 'No se ha podido abrir la sesión. Inténtalo otra vez.';
const REGISTER_ERROR = 'No se ha podido crear la cuenta. Inténtalo otra vez.';
const SIGN_OUT_ERROR = 'No se ha podido cerrar la sesión.';
const GOOGLE_LOAD_ERROR = 'No se ha podido cargar el acceso con Google.';
const CONTRASENA = 'contrasena-de-pruebas';

/**
 * El panel se prueba con el servidor simulado en la frontera de `fetch`, que es
 * donde empieza lo que es de la interfaz y acaba lo que es del servidor. El
 * motor de cuentas ya está probado contra SQLite de verdad en `functions/_lib`;
 * aquí lo que importa es qué pide la interfaz, qué hace con cada respuesta y,
 * sobre todo, qué no hace: sin cliente de Google no pide nada, y sin sesión no
 * le pone una cara de error a una pantalla que funciona.
 *
 * El botón de Google también se simula. Se pinta dentro del contenedor igual que
 * lo pinta Google —un botón que entrega el identificador— para que las pruebas
 * entren por el mismo sitio por el que entraria alguien de verdad y no por el
 * interior de los callbacks.
 */
type Responder = (ruta: string) => Response;

function cuerpo(status: number, valor: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => valor,
  } as unknown as Response;
}

let responder: Responder;
let peticiones: string[];
let cuerpos: unknown[];
let pintadoEn: HTMLElement | null;
let callbacks: Array<(respuesta: { credential?: unknown }) => void>;

/** Espera a que pase un turno de la cola de mensajes, no solo de microtareas. */
function despuesDeUnPaso(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Espera al `<script>` que el panel pide cuando no hay API de Google todavía. */
function esperarScript(): Promise<HTMLScriptElement> {
  return waitFor(() => {
    const found = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (found === null) {
      throw new Error('el script todavía no está');
    }
    return found as HTMLScriptElement;
  });
}

/**
 * Rellena el formulario y lo envía.
 *
 * Se escribe campo a campo con `userEvent` y no se dispara el `submit` a mano
 * para entrar por donde entra alguien de verdad: así el `required`, el
 * `type=email` y el `minLength` de los campos siguen en pie, y una prueba que se
 * los saltara no probaría el formulario que hay.
 */
async function enviarFormulario(
  user: ReturnType<typeof userEvent.setup>,
  boton: string,
): Promise<void> {
  await user.type(await screen.findByLabelText('Correo'), CORREO);
  await user.type(screen.getByLabelText('Contraseña'), CONTRASENA);
  await user.click(screen.getByRole('button', { name: boton }));
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENTE);

  responder = () => cuerpo(200, { autenticado: false });
  peticiones = [];
  cuerpos = [];
  pintadoEn = null;
  callbacks = [];

  vi.stubGlobal('google', {
    accounts: {
      id: {
        initialize: (opciones: {
          callback: (respuesta: { credential?: unknown }) => void;
        }) => {
          callbacks.push(opciones.callback);
        },
        renderButton: (container: HTMLElement) => {
          pintadoEn = container;
          const boton = document.createElement('button');
          boton.type = 'button';
          boton.textContent = 'Entrar con Google';
          boton.addEventListener('click', () => {
            callbacks.at(-1)?.({ credential: 'identificador-firmado' });
          });
          container.append(boton);
        },
      },
    },
  });

  vi.stubGlobal('fetch', async (input: unknown, init?: { body?: string }) => {
    const ruta = String(input);
    peticiones.push(ruta);
    if (init?.body !== undefined) {
      cuerpos.push(JSON.parse(init.body) as unknown);
    }
    return responder(ruta);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const script of document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)) {
    script.remove();
  }
});

describe('AccountPanel', () => {
  it('no pinta nada ni pregunta nada cuando no hay cuentas', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.stubEnv('VITE_ACCOUNTS', '');

    const { container } = render(<AccountPanel />);
    await despuesDeUnPaso();

    expect(container.firstChild).toBeNull();
    expect(peticiones).toEqual([]);
    expect(pintadoEn).toBeNull();
    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
  });

  it('enseña el formulario sin cliente de Google cuando hay cuentas', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.stubEnv('VITE_ACCOUNTS', '1');

    render(<AccountPanel />);

    expect(await screen.findByLabelText('Correo')).toBeInTheDocument();
    expect(peticiones).toEqual(['/api/auth/session']);
    expect(pintadoEn).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Entrar con Google' }),
    ).toBeNull();
    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
  });

  it('ofrece entrar con Google cuando no hay sesión', async () => {
    const { container } = render(<AccountPanel />);

    await waitFor(() => expect(pintadoEn).not.toBeNull());

    expect(peticiones).toEqual(['/api/auth/session']);
    const panel = container.querySelector('.account-panel');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute('hidden');
    expect(
      container.querySelector('.account-panel__google'),
    ).not.toHaveAttribute('hidden');
    expect(
      screen.getByRole('button', { name: 'Entrar con Google' }),
    ).toBeInTheDocument();
  });

  it('no consulta la sesión ni pinta el panel sin cuentas', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', undefined);

    render(<AccountPanel />);
    await despuesDeUnPaso();

    expect(peticiones).toEqual([]);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('enseña el correo y la salida cuando ya hay sesión', async () => {
    responder = () =>
      cuerpo(200, { autenticado: true, email: CORREO, displayName: 'alguien' });

    render(<AccountPanel />);

    expect(await screen.findByText(CORREO)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
    expect(pintadoEn).toBeNull();
  });

  it('cierra la sesión y vuelve al botón de Google', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/logout'
        ? cuerpo(204, null)
        : cuerpo(200, { autenticado: true, email: CORREO });

    render(<AccountPanel />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(pintadoEn).not.toBeNull());
    expect(peticiones).toEqual([
      '/api/auth/session',
      '/api/auth/logout',
    ]);
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('entra con el identificador que le devuelve Google', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(200, { email: CORREO, displayName: 'alguien' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByText(CORREO)).toBeInTheDocument();
    expect(peticiones).toEqual(['/api/auth/session', '/api/auth/google']);
    expect(cuerpos).toEqual([{ credential: 'identificador-firmado' }]);
  });

  it('enseña el mensaje del servidor cuando ese correo ya tiene cuenta', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(409, {
            error:
              'Ya hay una cuenta con este correo y no se puede abrir con Google. Entra con tu contrasena.',
          })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Ya hay una cuenta con este correo');
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('usa su propio mensaje si el servidor rechaza sin decir nada', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(401, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_ERROR);
  });

  it('no por una cuenta a medias si el servidor devuelve 200 sin correo', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(200, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_ERROR);
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('sigue fuera si no hay red al entrar con Google', async () => {
    const user = userEvent.setup();
    responder = (ruta) => {
      if (ruta === '/api/auth/google') {
        throw new Error('sin red');
      }
      return cuerpo(200, { autenticado: false });
    };

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_ERROR);
    expect(pintadoEn).not.toBeNull();
  });

  it('trata una sesión ilegible como ausente y no como un error', async () => {
    responder = () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('cuerpo revuelto');
        },
      }) as unknown as Response;

    render(<AccountPanel />);

    await waitFor(() => expect(pintadoEn).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('trata una sesión sin correo como ausente', async () => {
    responder = () => cuerpo(200, { autenticado: true });

    render(<AccountPanel />);

    await waitFor(() => expect(pintadoEn).not.toBeNull());
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('sigue fuera si no hay red al consultar la sesión', async () => {
    responder = () => {
      throw new Error('sin red');
    };

    render(<AccountPanel />);

    await waitFor(() => expect(pintadoEn).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('se queda dentro y avisa si el cierre de sesión falla', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/logout'
        ? cuerpo(500, {})
        : cuerpo(200, { autenticado: true, email: CORREO });

    render(<AccountPanel />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_OUT_ERROR);
    expect(screen.getByText(CORREO)).toBeInTheDocument();
    expect(pintadoEn).toBeNull();
  });

  it('se queda dentro y avisa si no hay red al cerrar la sesión', async () => {
    const user = userEvent.setup();
    responder = (ruta) => {
      if (ruta === '/api/auth/logout') {
        throw new Error('sin red');
      }
      return cuerpo(200, { autenticado: true, email: CORREO });
    };

    render(<AccountPanel />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_OUT_ERROR);
    expect(screen.getByText(CORREO)).toBeInTheDocument();
  });

  it('avisa con `true` cuando al entrar ya hay alguien dentro', async () => {
    const avisos: boolean[] = [];
    responder = () => cuerpo(200, { autenticado: true, email: CORREO });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await screen.findByText(CORREO);

    expect(avisos).toEqual([true]);
  });

  it('avisa con `false` cuando al entrar no hay nadie dentro', async () => {
    const avisos: boolean[] = [];

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await waitFor(() => expect(pintadoEn).not.toBeNull());

    expect(avisos).toEqual([false]);
  });

  it('avisa con `false` cuando la consulta de sesión no se puede hacer', async () => {
    const avisos: boolean[] = [];
    responder = () => {
      throw new Error('sin red');
    };

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await waitFor(() => expect(pintadoEn).not.toBeNull());

    expect(avisos).toEqual([false]);
  });

  it('no consulta nada ni avisa si no hay cuentas', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const avisos: boolean[] = [];

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await despuesDeUnPaso();

    expect(avisos).toEqual([]);
    expect(peticiones).toEqual([]);
  });

  it('avisa con `true` cuando se entra con Google', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(200, { email: CORREO, displayName: 'alguien' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );
    await screen.findByText(CORREO);

    expect(avisos).toEqual([false, true]);
  });

  it('no añade nada al aviso si la entrada con Google no funciona', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(401, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );
    await screen.findByRole('alert');

    expect(avisos).toEqual([false]);
  });

  it('avisa con `false` cuando se cierra la sesión', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/logout'
        ? cuerpo(200, {})
        : cuerpo(200, { autenticado: true, email: CORREO });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(pintadoEn).not.toBeNull());

    expect(avisos).toEqual([true, false]);
  });

  it('no añade nada al aviso si el cierre de sesión no funciona', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/logout'
        ? cuerpo(500, {})
        : cuerpo(200, { autenticado: true, email: CORREO });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('alert');

    expect(avisos).toEqual([true]);
  });

  it('avisa si el script de Google no se puede cargar', async () => {
    vi.stubGlobal('google', undefined);

    render(<AccountPanel />);
    const script = await esperarScript();
    script.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      GOOGLE_LOAD_ERROR,
    );
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('usa su mensaje genérico si el rechazo viene sin cuerpo aprovechable', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? ({
            ok: false,
            status: 401,
            json: async () => {
              throw new Error('cuerpo revuelto');
            },
          } as unknown as Response)
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_ERROR);
  });

  it('usa su mensaje genérico si el servidor rechaza con un mensaje vacío', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/google'
        ? cuerpo(401, { error: '' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Entrar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_ERROR);
  });

  it('deja correr la consulta de sesión aunque el panel se vaya antes', async () => {
    const resolvers: Array<(valor: unknown) => void> = [];
    responder = () =>
      ({
        ok: true,
        status: 200,
        json: () =>
          new Promise<unknown>((resolve) => {
            resolvers.push(resolve);
          }),
      }) as unknown as Response;

    const { unmount } = render(<AccountPanel />);
    await despuesDeUnPaso();
    expect(resolvers).toHaveLength(1);

    unmount();
    resolvers[0]?.({ autenticado: true, email: CORREO });
    await despuesDeUnPaso();

    // Nada que enseñar: el panel ya no está, y una sesión que llega tarde no
    // escribe en una pantalla que se ha retirado.
    expect(screen.queryByText(CORREO)).toBeNull();
    expect(pintadoEn).toBeNull();
  });

  it('no avisa si el script de Google falla después de que el panel se vaya', async () => {
    vi.stubGlobal('google', undefined);

    const { unmount } = render(<AccountPanel />);
    const script = await esperarScript();

    unmount();
    script.dispatchEvent(new Event('error'));
    await despuesDeUnPaso();

    expect(pintadoEn).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Va la última de las tres que piden el script a propósito. Las dos anteriores
  // terminan con la petición a cero y permiten volver a pedir; esta deja el
  // script cargado, que es el estado en el que se quedaría la página en producción
  // y a partir del cual no habría nada más que pedir.
  it('no pinta en un panel retirado si el script de Google llega después', async () => {
    vi.stubGlobal('google', undefined);

    const { unmount } = render(<AccountPanel />);
    const script = await esperarScript();

    unmount();
    script.dispatchEvent(new Event('load'));
    await despuesDeUnPaso();

    // Pintar en un contenedor que ya no está en la página sería dejar un botón
    // huérfano que nadie puede pulsar y que React ya no gestiona.
    expect(pintadoEn).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('entra con el correo y la contraseña', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(200, { email: CORREO, displayName: 'alguien' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');

    expect(await screen.findByText(CORREO)).toBeInTheDocument();
    expect(peticiones).toEqual(['/api/auth/session', '/api/auth/login']);
    expect(cuerpos).toEqual([{ email: CORREO, password: CONTRASENA }]);
  });

  it('crea la cuenta cuando no la tiene', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/register'
        ? cuerpo(201, { email: CORREO, displayName: 'alguien' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Crear una cuenta' }),
    );
    await enviarFormulario(user, 'Crear cuenta');

    expect(await screen.findByText(CORREO)).toBeInTheDocument();
    expect(peticiones).toEqual(['/api/auth/session', '/api/auth/register']);
  });

  it('alterna entre entrar y crear sin preguntarle nada al servidor', async () => {
    const user = userEvent.setup();

    render(<AccountPanel />);
    await screen.findByLabelText('Correo');

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear una cuenta' }));
    expect(
      screen.getByRole('button', { name: 'Crear cuenta' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ya tengo cuenta' }));
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(peticiones).toEqual(['/api/auth/session']);
  });

  it('enseña el mensaje del servidor cuando las credenciales no coinciden', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(401, { error: 'El correo o la contrasena no coinciden.' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contrasena no coinciden.',
    );
    expect(screen.queryByText(CORREO)).toBeNull();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('usa su propio mensaje si el acceso no se puede hacer', async () => {
    const user = userEvent.setup();
    responder = (ruta) => {
      if (ruta === '/api/auth/login') {
        throw new Error('sin red');
      }
      return cuerpo(200, { autenticado: false });
    };

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_ERROR);
  });

  it('usa su propio mensaje si el alta falla sin decir nada', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/register'
        ? cuerpo(500, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await user.click(
      await screen.findByRole('button', { name: 'Crear una cuenta' }),
    );
    await enviarFormulario(user, 'Crear cuenta');

    expect(await screen.findByRole('alert')).toHaveTextContent(REGISTER_ERROR);
  });

  it('no da por dentro un 200 sin correo al entrar', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(200, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_ERROR);
    expect(screen.queryByText(CORREO)).toBeNull();
  });

  it('avisa con `true` cuando se entra con contraseña', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(200, { email: CORREO })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await enviarFormulario(user, 'Entrar');
    await screen.findByText(CORREO);

    expect(avisos).toEqual([false, true]);
  });

  it('no añade nada al aviso si el acceso con contraseña no funciona', async () => {
    const user = userEvent.setup();
    const avisos: boolean[] = [];
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(401, {})
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel onSessionChange={(aviso) => avisos.push(aviso)} />);
    await enviarFormulario(user, 'Entrar');
    await screen.findByRole('alert');

    expect(avisos).toEqual([false]);
  });

  it('borra la contraseña al entrar y conserva el correo para la próxima', async () => {
    const user = userEvent.setup();
    responder = (ruta) => {
      if (ruta === '/api/auth/login') {
        return cuerpo(200, { email: CORREO });
      }
      if (ruta === '/api/auth/logout') {
        return cuerpo(204, null);
      }
      return cuerpo(200, { autenticado: false });
    };

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');
    await screen.findByText(CORREO);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByLabelText('Correo')).toHaveValue(CORREO);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('borra el aviso anterior al cambiar de entrar a crear', async () => {
    const user = userEvent.setup();
    responder = (ruta) =>
      ruta === '/api/auth/login'
        ? cuerpo(401, { error: 'El correo o la contrasena no coinciden.' })
        : cuerpo(200, { autenticado: false });

    render(<AccountPanel />);
    await enviarFormulario(user, 'Entrar');
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Crear una cuenta' }));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
