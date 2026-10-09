import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { AppButton } from './AppButton';
import { accountsEnabled } from '../../app/accounts';
import {
  googleClientId,
  loadGoogleIdentity,
  renderGoogleButton,
} from '../../app/google-sign-in';

/**
 * La cuenta en la pantalla de inicio.
 *
 * Se lleva su estado a propósito: la cuenta no forma
 * parte de la partida, y meterla en el estado de la partida obligaría a que una
 * sesión abierta o cerrada arrastrara un cambio de pantalla, que es justo lo que
 * no tiene por qué pasar. La partida sigue sin tocarse, y sigue sin guardarse.
 *
 * Sin cuentas no devuelve nada y no hace ninguna petición. No es solo estética:
 * el acceso es opcional, y un despliegue que no las tiene no debería ni
 * preguntar si hay sesión. Una cosa es que haya cuentas —correo y contraseña,
 * con o sin Google— y otra que haya cliente de Google, que solo añade el botón.
 *
 * Tres estados y ninguno más. `cargando` es la consulta de sesión al arrancar, y
 * no se enseña para que la cuenta aparezca ya dicha y no crezca debajo del
 * texto. `fuera` es lo que se puede hacer sin cuenta: el formulario de correo y
 * contraseña y, si hay cliente, el botón de Google. `dentro` es el correo y la
 * salida. El formulario sirve para las dos cosas que se pueden hacer estando
 * fuera, entrar y crear la cuenta, porque el servidor tiene una ruta para cada
 * una y la diferencia es un solo campo; separarlas en dos pantallas obligaría a
 * adivinar cuál de las dos quiere quien todavía no ha escrito nada.
 *
 * La única cosa que comparte con el resto de la página es `onSessionChange`, y
 * la comparte como un aviso y no como estado: un aviso de «ahora hay sesión» o
 * «ahora no la hay», del que el que lo recibe hace lo que le venga con sus
 * propias cosas. El panel no sabe ni tiene por qué saber si hay estadísticas
 * que subir; solo sabe quién está dentro, que es lo que le hace falta para
 * dibujarse.
 *
 * El aviso dice lo que el panel cree, que es exactamente lo que enseña. Si la
 * consulta de sesión no responde, el panel se comporta como si no hubiera nadie
 * dentro —ya lo hace: enseña el botón— y avisa de eso, porque es lo único que
 * sabe. Lo que no avisa es de una entrada o una salida que no llegan a
 * completarse: ahí no cambia quién está dentro, y avisar de un cambio que no ha
 * habido sí sería mentirle.
 */
type AccountState = 'cargando' | 'fuera' | 'dentro';

/** Las dos cosas que se pueden hacer estando fuera, con el mismo formulario. */
type AuthMode = 'entrar' | 'crear';

/**
 * Lo que hay que llamar cuando cambia quién está dentro.
 *
 * Debe ser estable entre renderizaciones. La consulta de sesión se hace una vez
 * al montar y su efecto depende de esta función: si el que la pasa redeclarara
 * la suya en cada render, cada render volvería a preguntar al servidor quién
 * está dentro. La que pasa `App` viene de un `useCallback` y lo es.
 */
type SessionChange = (autenticado: boolean) => void;

const SESSION_URL = '/api/auth/session';
const GOOGLE_URL = '/api/auth/google';
const LOGIN_URL = '/api/auth/login';
const REGISTER_URL = '/api/auth/register';
const LOGOUT_URL = '/api/auth/logout';

const SIGN_IN_ERROR =
  'No se ha podido abrir la sesión con Google. Inténtalo otra vez.';
const LOGIN_ERROR = 'No se ha podido abrir la sesión. Inténtalo otra vez.';
const REGISTER_ERROR = 'No se ha podido crear la cuenta. Inténtalo otra vez.';
const SIGN_OUT_ERROR = 'No se ha podido cerrar la sesión.';
const GOOGLE_LOAD_ERROR = 'No se ha podido cargar el acceso con Google.';

/**
 * El correo de la sesión abierta, o `null` si no la hay.
 *
 * Los tres motivos que acaban en `null` significan lo mismo para la interfaz:
 * no hay sesión que enseñar. Sin red, con el servidor caído o con un cuerpo que
 * no se entiende se juega sin cuenta, igual que se juega sin cuenta en una
 * página que no tiene cuentas. Enseñarlo como un error rojo en una pantalla que
 * funciona sería pedirle al visitante que arreglara el servidor.
 */
async function readSession(): Promise<string | null> {
  try {
    const response = await fetch(SESSION_URL);
    const payload = (await response.json()) as {
      autenticado?: unknown;
      email?: unknown;
    };
    if (payload.autenticado !== true || typeof payload.email !== 'string') {
      return null;
    }
    return payload.email;
  } catch {
    return null;
  }
}

/** El mensaje de `error` de un cuerpo, o `null` si no trae ninguno usable. */
async function readErrorMessage(response: Response): Promise<string | null> {
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
 * El resultado de intentar abrir sesión, por el camino que sea.
 *
 * Los dos caminos —Google y correo con contraseña— acaban igual: o hay un correo
 * con el que se ha entrado, o hay un mensaje que enseñar. El panel no necesita
 * saber cuál de los dos fue después, así que los dos devuelven lo mismo.
 */
type SessionOutcome =
  | { readonly ok: true; readonly email: string }
  | { readonly ok: false; readonly message: string };

/**
 * Manda el identificador de Google al servidor.
 *
 * El servidor es quien decide si eso abre una cuenta, si la enlaza con una que
 * ya existe o si no abre nada. Aquí solo se traduce su respuesta: el correo que
 * devuelve si ha ido bien, y el suyo si no ha ido bien.
 */
async function signInWithGoogle(credential: string): Promise<SessionOutcome> {
  try {
    const response = await fetch(GOOGLE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { email?: unknown };
      if (typeof payload.email !== 'string') {
        // Un 200 sin correo no es el cuerpo que este servidor manda nunca. Se
        // trata como un fallo y no como un acceso a medias: entrar en una cuenta
        // sin saber cuál es sería peor que no entrar.
        return { ok: false, message: SIGN_IN_ERROR };
      }
      return { ok: true, email: payload.email };
    }

    return {
      ok: false,
      message: (await readErrorMessage(response)) ?? SIGN_IN_ERROR,
    };
  } catch {
    return { ok: false, message: SIGN_IN_ERROR };
  }
}

/**
 * Manda el correo y la contraseña al servidor, para entrar o para crear cuenta.
 *
 * Las dos rutas contestan lo mismo cuando van bien —el correo y, de propina, un
 * nombre— y las dos ponen la cookie de sesión. Aquí no se decide nada: solo se
 * elige la ruta, se traduce la respuesta y se deja el mensaje del servidor tal
 * cual, que es donde está escrito si el correo tiene mala forma, si la
 * contraseña es corta o si las credenciales no coinciden. El mensaje propio solo
 * sale cuando no hay ninguno del servidor que enseñar: sin red o con un cuerpo
 * que no se entiende.
 */
async function submitCredentials(
  mode: AuthMode,
  email: string,
  password: string,
): Promise<SessionOutcome> {
  const fallback = mode === 'crear' ? REGISTER_ERROR : LOGIN_ERROR;
  const url = mode === 'crear' ? REGISTER_URL : LOGIN_URL;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: (await readErrorMessage(response)) ?? fallback,
      };
    }

    const payload = (await response.json()) as { email?: unknown };
    if (typeof payload.email !== 'string') {
      // Mismo criterio que con Google: un 2xx sin correo no es un acceso a
      // medias, es un fallo, porque entrar sin saber en qué cuenta es peor.
      return { ok: false, message: fallback };
    }
    return { ok: true, email: payload.email };
  } catch {
    return { ok: false, message: fallback };
  }
}

/** Cierra la sesión. `false` cuando no se ha conseguido. */
async function signOut(): Promise<boolean> {
  try {
    const response = await fetch(LOGOUT_URL, { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}

export interface AccountPanelProps {
  /**
   * Aviso de que ha cambiado quien está dentro. Opcional: sin él el panel se
   * comporta igual.
   *
   * Admite `undefined` explícito porque `exactOptionalPropertyTypes` distingue
   * «no me lo han pasado» de «me lo han pasado sin valor», y aquí el que lo
   * pasa reenvía el suyo, que puede no existir.
   */
  readonly onSessionChange?: SessionChange | undefined;
}

export function AccountPanel({ onSessionChange }: AccountPanelProps) {
  // Las cuentas se deciden aparte del cliente de Google: puede haber cuentas de
  // correo y contraseña sin botón de Google, y el botón solo se pinta con
  // cliente. `clientId` se queda justo para eso, para el botón.
  const enabled = accountsEnabled();
  const clientId = googleClientId();
  const [state, setState] = useState<AccountState>('cargando');
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // El contenedor del botón va por estado y no por un `ref` para que el efecto
  // pueda mirarlo sin preguntar si es nulo. Con un `ref` habría que comprobar
  // eso en un punto que, de funcionar bien la cosa, nunca lo es, y esa
  // comprobación no se podría probar. Como estado, el `null` es verdad durante
  // el montaje y el efecto lo ve: es la misma guarda, escrita donde se puede
  // medir.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // Lo que hay escrito en el formulario. El correo y la contraseña viven aquí y
  // no en el DOM sin controlar por una razón concreta: al entrar hay que poder
  // borrar la contraseña, que si no se quedaría puesta para el siguiente que
  // abriera el formulario en la misma página.
  const [mode, setMode] = useState<AuthMode>('entrar');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // La consulta de sesión. Se hace una vez, al montar, y solo si el despliegue
  // tiene cuentas.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let alive = true;
    void readSession().then((sessionEmail) => {
      if (!alive) {
        return;
      }
      if (sessionEmail === null) {
        setState('fuera');
        onSessionChange?.(false);
        return;
      }
      setEmail(sessionEmail);
      setState('dentro');
      onSessionChange?.(true);
    });

    return () => {
      alive = false;
    };
  }, [enabled, onSessionChange]);

  const onGoogleCredential = useCallback(
    (credential: string) => {
      void signInWithGoogle(credential).then((outcome) => {
        if (outcome.ok) {
          setEmail(outcome.email);
          setNotice(null);
          setState('dentro');
          onSessionChange?.(true);
          return;
        }
        setNotice(outcome.message);
      });
    },
    [onSessionChange],
  );

  const onSignOut = useCallback(() => {
    void signOut().then((closed) => {
      if (!closed) {
        setNotice(SIGN_OUT_ERROR);
        return;
      }
      setEmail(null);
      setNotice(null);
      setState('fuera');
      onSessionChange?.(false);
    });
  }, [onSessionChange]);

  const onCredentials = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitCredentials(mode, formEmail, formPassword).then((outcome) => {
        if (outcome.ok) {
          setEmail(outcome.email);
          setNotice(null);
          setFormPassword('');
          setState('dentro');
          onSessionChange?.(true);
          return;
        }
        setNotice(outcome.message);
      });
    },
    [formEmail, formPassword, mode, onSessionChange],
  );

  // Cambiar de entrar a crear no es un envío: no hay nada que preguntarle al
  // servidor, y el aviso del intento anterior se va con el cambio porque ya no
  // habla de lo que hay en pantalla.
  const onModeChange = useCallback(() => {
    setMode((previous) => (previous === 'entrar' ? 'crear' : 'entrar'));
    setNotice(null);
  }, []);

  // El botón de Google se pinta cuando hay contenedor, hay cliente y no hay
  // nadie dentro. Las tres se comprueban en esta orden porque cada una es la
  // razón entera para no pintar, y las tres se alcanzan: el montaje llega con el
  // contenedor sin poner, un inicio de sesión correcto llega con el contenedor
  // ya puesto, y un despliegue sin cliente llega sin nada de todo.
  useEffect(() => {
    if (container === null || clientId === undefined || state !== 'fuera') {
      return;
    }

    let alive = true;
    void loadGoogleIdentity()
      .then(() => {
        if (alive) {
          renderGoogleButton(container, clientId, onGoogleCredential);
        }
      })
      .catch(() => {
        if (alive) {
          setNotice(GOOGLE_LOAD_ERROR);
        }
      });

    return () => {
      alive = false;
    };
  }, [clientId, container, onGoogleCredential, state]);

  if (!enabled) {
    return null;
  }

  return (
    <aside
      aria-label="Tu cuenta"
      className="account-panel"
      hidden={state === 'cargando'}
    >
      {state === 'dentro' ? (
        <div className="account-panel__session">
          <p className="account-panel__mail">{email}</p>
          <AppButton onClick={onSignOut} variant="quiet">
            Cerrar sesión
          </AppButton>
        </div>
      ) : (
        <form
          className="account-panel__form"
          hidden={state !== 'fuera'}
          onSubmit={onCredentials}
        >
          <label className="account-panel__field">
            <span className="account-panel__label">Correo</span>
            <input
              className="account-panel__input"
              type="email"
              name="email"
              autoComplete="email"
              maxLength={254}
              required
              value={formEmail}
              onChange={(event) => {
                setFormEmail(event.target.value);
              }}
            />
          </label>
          <label className="account-panel__field">
            <span className="account-panel__label">Contraseña</span>
            <input
              className="account-panel__input"
              type="password"
              name="password"
              autoComplete={
                mode === 'crear' ? 'new-password' : 'current-password'
              }
              minLength={8}
              maxLength={200}
              required
              value={formPassword}
              onChange={(event) => {
                setFormPassword(event.target.value);
              }}
            />
          </label>
          <AppButton type="submit" variant="secondary">
            {mode === 'crear' ? 'Crear cuenta' : 'Entrar'}
          </AppButton>
          <button
            className="account-panel__switch"
            type="button"
            onClick={onModeChange}
          >
            {mode === 'crear' ? 'Ya tengo cuenta' : 'Crear una cuenta'}
          </button>
        </form>
      )}
      <div
        className="account-panel__google"
        hidden={state !== 'fuera'}
        ref={setContainer}
      />
      {notice === null ? null : (
        <p className="account-panel__notice" role="alert">
          {notice}
        </p>
      )}
    </aside>
  );
}
