// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  clearedSessionCookie,
  errorResponse,
  isSameOrigin,
  jsonResponse,
  readErrorMessage,
  readSessionToken,
  sessionCookie,
  SESSION_COOKIE,
} from '../http';

describe('sessionCookie', () => {
  it('lleva el token y los cuatro atributos de proteccion', () => {
    const cookie = sessionCookie('el-token');

    expect(cookie).toBe(
      `${SESSION_COOKIE}=el-token; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  });

  it('no lleva Max-Age si no se le pasa', () => {
    expect(sessionCookie('t')).not.toContain('Max-Age');
  });

  it('lleva Max-Age cuando se le pasa', () => {
    expect(sessionCookie('t', { maxAgeSeconds: 3600 })).toContain('Max-Age=3600');
  });

  it('escapa el token, porque un token corrupto romperia la cabecera', () => {
    // Los tokens reales son base64url y no necesitan escapado. Este escapado esta
    // para que un token manipulado no pueda inyectar un `;` que cierre la cookie
    // aqui y siga con sus propios atributos.
    const cookie = sessionCookie('con;punto=coma');

    expect(cookie).toContain(`${SESSION_COOKIE}=con%3Bpunto%3Dcoma`);
    expect(cookie.split('; ')[0]).not.toContain('punto=coma');
  });
});

describe('clearedSessionCookie', () => {
  it('borra la cookie con los mismos atributos con los que se creo', () => {
    const creada = sessionCookie('el-token');
    const borrada = clearedSessionCookie();

    // Los cuatro atributos tienen que coincidir. Si la cookie que borra tuviera
    // `Path=/api` y la que se creo `Path=/`, el navegador las contaria como dos
    // cookies distintas y solo borraria una: cerrar sesion no haria nada y el
    // fallo apareceria en un navegador y no en el resto.
    for (const atributo of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
      expect(borrada).toContain(atributo);
      expect(creada).toContain(atributo);
    }
  });

  it('pone el valor a cero y a una fecha pasada', () => {
    const borrada = clearedSessionCookie();

    expect(borrada).toContain(`${SESSION_COOKIE}=`);
    expect(borrada).toContain('Max-Age=0');
    expect(borrada).toContain('Expires=Thu, 01 Jan 1970');
  });
});

describe('readSessionToken', () => {
  it('lee el token de una cookie sola', () => {
    expect(readSessionToken(`${SESSION_COOKIE}=abc123`)).toBe('abc123');
  });

  it('lo lee de entre varias cookies', () => {
    const cabecera = `otra=1; ${SESSION_COOKIE}=abc123; otra2=2`;

    expect(readSessionToken(cabecera)).toBe('abc123');
  });

  it('tolera los espacios alrededor del igual', () => {
    expect(readSessionToken(`${SESSION_COOKIE} = abc123`)).toBe('abc123');
  });

  it('deshace el escapado del valor', () => {
    // El camino completo: lo que se escribe en la cabecera y lo que se lee
    // tienen que dar el mismo token. Si el escapado se hiciera solo al escribir
    // o solo al leer, el token volveria distinto y ninguna sesion serviria.
    const original = 'con;caracteres/especiales';
    const cookie = sessionCookie(original);

    // Solo el primer par, que es donde va el valor: el resto de la cabecera son
    // los atributos, con punto y coma y sin `=`.
    expect(readSessionToken(cookie.split('; ')[0] ?? '')).toBe(original);
  });

  it('devuelve null si no esta la cookie', () => {
    expect(readSessionToken('otra=1; otra2=2')).toBeNull();
  });

  it.each([
    ['sin cabecera', null],
    ['cabecera vacia', ''],
    ['cookie sin igual', 'solo-una-palabra'],
    ['cookie sin valor', `${SESSION_COOKIE}=`],
    ['cookie de solo espacios escapados', `${SESSION_COOKIE}=%20`],
  ])('devuelve null con %s', (_etiqueta, cabecera) => {
    expect(readSessionToken(cabecera ?? null)).toBeNull();
  });

  it('devuelve la primera si hay dos con el mismo nombre', () => {
    const cabecera = `${SESSION_COOKIE}=primero; ${SESSION_COOKIE}=segundo`;

    // El navegador no deberia mandar dos, pero si las manda, gana la primera. Es
    // la que pondria un atacante con una cookie de su propio dominio solo si el
    // `Path` estuviera mal, asi que la decision tiene que ser fija y no depender
    // del orden en que las eligio el navegador.
    expect(readSessionToken(cabecera)).toBe('primero');
  });
});

describe('jsonResponse', () => {
  it('pone el cuerpo y el tipo de contenido', async () => {
    const respuesta = jsonResponse({ hola: 'mundo' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await respuesta.json()).toEqual({ hola: 'mundo' });
  });

  it('no deja que se guarde en cache, porque lleva la sesion dentro', async () => {
    // Una respuesta con la cuenta de alguien guardada en la cache del navegador
    // se leeria despues de cerrar sesion, y en un ordenador compartido se veria
    // el nombre de la cuenta de la otra persona.
    expect(jsonResponse({}).headers.get('cache-control')).toBe('no-store');
  });

  it('acepta el codigo de estado que se le pase', () => {
    expect(jsonResponse({}, 201).status).toBe(201);
    expect(jsonResponse({}, 429).status).toBe(429);
  });
});

describe('errorResponse', () => {
  it('pone el mensaje en el campo error', async () => {
    const respuesta = errorResponse('Algo no ha ido bien.', 400);

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: 'Algo no ha ido bien.' });
  });

  it('tambien es no-store', () => {
    // Un error de inicio de sesion en la cache del navegador es un fallo de la
    // misma clase que un acierto: se leeria sin volver a preguntar.
    expect(errorResponse('x', 401).headers.get('cache-control')).toBe('no-store');
  });
});

describe('isSameOrigin', () => {
  it.each([
    ['same-origin', true],
    ['none', true],
    ['cross-site', false],
    ['same-site', false],
  ])('con Sec-Fetch-Site %s devuelve %s', (valor, esperado) => {
    const peticion = new Request('https://el-sitio.example/api/auth/login', {
      headers: { 'sec-fetch-site': valor },
    });

    expect(isSameOrigin(peticion)).toBe(esperado);
  });

  it('pasa cuando la cabecera no esta, porque no es una barrera', () => {
    // Cuando no viene, que es lo que pasa en las pruebas y en las llamadas
    // directas, no se puede saber de donde vino la peticion. Denegar aqui
    // dejaria el servidor inservible para cualquier cliente que no sea un
    // navegador, que es justo lo que se quiere evitar al poner la defensa en la
    // cookie y no aqui.
    expect(isSameOrigin(new Request('https://el-sitio.example/api/auth/login'))).toBe(true);
  });
});

describe('readErrorMessage', () => {
  it('lee el mensaje de un cuerpo de error', () => {
    expect(readErrorMessage({ error: 'El correo no coincide.' })).toBe('El correo no coincide.');
  });

  it.each([
    ['null', null],
    ['un numero', 42],
    ['sin campo error', { otro: 'x' }],
    ['con error que no es texto', { error: 42 }],
    ['una cadena suelta', 'texto'],
    ['un array', [{ error: 'x' }]],
  ])('devuelve null con %s', (_etiqueta, cuerpo) => {
    expect(readErrorMessage(cuerpo)).toBeNull();
  });
});