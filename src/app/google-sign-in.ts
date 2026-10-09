/**
 * El acceso con Google desde la interfaz.
 *
 * Google Identity Services no viene con el proyecto: es un script externo que
 * hay que pedir y esperar, y que solo tiene sentido pedir cuando el despliegue
 * tiene `VITE_GOOGLE_CLIENT_ID`. Sin esa variable no se pide el script ni se
 * pinta el botón, y por eso la variable se lee en tiempo de ejecución y no al
 * empaquetar: qué acceso hay es cosa del despliegue, no del build.
 *
 * El script devuelve un identificador firmado por Google. Este módulo no lo
 * abre: solo lo entrega. Abrirlo le corresponde al servidor, que es donde está
 * la clave pública de Google y donde se decide en qué cuenta se acaba entrando.
 */

/**
 * Lo que Google Identity Services devuelve al firmar: un JWT en `credential`.
 *
 * El tipo es abierto a propósito. Este módulo no mira dentro del identificador,
 * y mirar dentro sería reimplementar en el navegador lo que ya hace el servidor,
 * con la diferencia de que aquí no habría con qué verificar la firma.
 */
interface GoogleCredentialResponse {
  readonly credential?: unknown;
}

interface GoogleInitializeOptions {
  readonly client_id: string;
  readonly callback: (response: GoogleCredentialResponse) => void;
}

/**
 * Las opciones del botón. Van como cadenas y no como unión de literales porque
 * las que no se usen no rompen nada, y enumerarlas todas obligaría a seguirle el
 * ritmo a un API que cambia sin que este proyecto se entere.
 */
interface GoogleButtonOptions {
  readonly theme: string;
  readonly size: string;
  readonly text: string;
  readonly shape: string;
  readonly width: number;
}

interface GoogleIdApi {
  initialize(options: GoogleInitializeOptions): void;
  renderButton(container: HTMLElement, options: GoogleButtonOptions): void;
}

interface GoogleApi {
  readonly accounts: {
    readonly id: GoogleIdApi;
  };
}

declare global {
  interface Window {
    /** Lo que el script de Google deja en la página cuando ya ha cargado. */
    google?: GoogleApi;
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * La petición del script que está en curso, o el error del intento anterior.
 *
 * Vive en el módulo y no en cada llamante: dos componentes montados a la vez
 * tendrían que compartir un solo `<script>`, no dos. Si la petición fracasa se
 * pone a `null` para que el siguiente intento vuelva a crearla; quedarse con la
 * promesa rechazada convertiría un fallo momentáneo de red en un fallo para
 * siempre.
 */
let peticion: Promise<void> | null = null;

/**
 * El `client_id` de Google de este despliegue, o `undefined` si no lo hay.
 *
 * Se lee en cada llamada y no en la carga del módulo para que la variable se
 * pueda cambiar entre una petición y otra, que es como se comporta `process.env`
 * en las pruebas y como se comporta `.env` en un despliegue que se renueva.
 * Una cadena vacía cuenta como ausente: una configuración a medias no es una
 * configuración, y un `client_id` de longitud cero no lo verifica nadie. El
 * `typeof` cubre además el caso de que el valor llegue por otro camino que no
 * sea un `.env`, que es donde un `12345` escrito sin comillas sería un número y
 * no el texto con que Google identifica a un cliente.
 */
export function googleClientId(): string | undefined {
  const env = import.meta.env as Record<string, unknown>;
  const value = env['VITE_GOOGLE_CLIENT_ID'];

  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Carga el script de Google Identity Services y espera a que esté.
 *
 * Resuelve ya mismo si el script ya está en la página. Mientras la petición
 * dura, todas las llamadas comparten la misma promesa: sin eso, un doble montaje
 * mandaría dos `<script>` y Google respondería dos veces a la misma página.
 */
export function loadGoogleIdentity(): Promise<void> {
  if (window.google !== undefined) {
    return Promise.resolve();
  }

  if (peticion !== null) {
    return peticion;
  }

  const nueva = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      // Se retira para que el siguiente intento cree uno nuevo. Un `<script>`
      // fallido que se quedara en la página seguiría ahí, y la petición
      // siguiente lo encontraría y no volvería a intentar cargar nada.
      script.remove();
      peticion = null;
      reject(new Error('No se ha podido cargar el acceso con Google.'));
    });
    document.head.append(script);
  });

  peticion = nueva;
  return nueva;
}

/**
 * Pinta el botón de Google dentro de `container`.
 *
 * El contenedor se vacía antes de pintar. `initialize` deja una configuración
 * global en la página, así que volver a entrar con Google —después de cerrar la
 * sesión, por ejemplo— tiene que rehacer el botón entero y no apilar uno encima
 * de otro.
 *
 * Si el script no está, no hace falta que falle: el componente ya encarga de
 * avisar cuando la carga del script no va. Aquí solo se pinta si hay con qué.
 */
export function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
): void {
  const google = window.google;
  if (google === undefined) {
    return;
  }

  container.replaceChildren();

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      const credential = response.credential;
      if (typeof credential === 'string' && credential !== '') {
        onCredential(credential);
      }
    },
  });
  google.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    width: 260,
  });
}
