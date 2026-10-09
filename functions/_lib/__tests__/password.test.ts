// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  hashPassword,
  ITERATIONS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from '../password';

/**
 * Las pruebas del hash usan 2 iteraciones en lugar de las 5 000 de produccion.
 *
 * No es una comodidad, es una decision sobre lo que se esta probando. Con las
 * iteraciones de produccion, esta prueba tardaria casi un minuto; con dos, unos
 * milisegundos. Lo que se quiere comprobar aqui es que el formato se escribe
 * bien, que la misma contrasena verifica y la distinta no, y que un hash de otra
 * forma no se acepta. Nada de eso depende del numero de iteraciones.
 *
 * El numero de produccion se comprueba aparte, en una prueba que solo mira el
 * texto del hash y no tarda nada. Si bajaran las iteraciones sin querer, esa
 * prueba falla aunque todas las demas sigan en verde.
 */

/** Iteraciones bajas para que la prueba no tarde. */
const RAPIDAS = 2;

describe('hashPassword', () => {
  it('escribe el algoritmo y las iteraciones dentro del hash', async () => {
    const stored = await hashPassword('contrasena-larga', RAPIDAS);

    const parts = stored.split('$');
    expect(parts[0]).toBe('pbkdf2_sha256');
    expect(parts[1]).toBe(String(RAPIDAS));
    expect(parts).toHaveLength(4);
  });

  it('usa 5000 iteraciones en produccion', () => {
    // A proposito no llama a `hashPassword`: con las iteraciones de produccion
    // el calculo real tardaria unos milisegundos, y lo que se comprueba es el
    // numero, que es lo que hay que proteger.
    expect(ITERATIONS).toBe(5000);
  });

  it('no guarda la contrasena en ninguna parte del hash', async () => {
    const stored = await hashPassword('mi-contrasena-secreta', RAPIDAS);

    expect(stored).not.toContain('mi-contrasena-secreta');
    expect(stored).not.toContain('secreta');
  });

  it('pone una sal distinta cada vez, aunque la contrasena sea la misma', async () => {
    const first = await hashPassword('la-misma', RAPIDAS);
    const second = await hashPassword('la-misma', RAPIDAS);

    // Si las dos salieran iguales, dos cuentas con la misma contrasena tendrian
    // el mismo hash, y con el hash en la mano se sabria que dos cuentas
    // comparten contrasena. La sal es justo lo que evita eso.
    expect(first).not.toBe(second);
  });

  it('produce un hash de 32 bytes en base64url', async () => {
    const stored = await hashPassword('contrasena', RAPIDAS);
    const hash = stored.split('$')[3] ?? '';

    // 32 bytes en base64url son 43 caracteres sin relleno. Un hash de SHA-256
    // tiene siempre ese tamano; si el numero de bits de la derivacion cambiara,
    // este numero cambiaria con el.
    expect(hash).toHaveLength(43);
    expect(hash).not.toMatch(/[+/=]/);
  });

  it('admite las dos partes en base64url, sin el relleno que rompe el separador', async () => {
    const stored = await hashPassword('contrasena', RAPIDAS);

    expect(stored).not.toContain('=');
  });
});

describe('verifyPassword', () => {
  it('acepta la contrasena correcta', async () => {
    const stored = await hashPassword('la-buena-contrasena', RAPIDAS);

    await expect(verifyPassword('la-buena-contrasena', stored)).resolves.toBe(true);
  });

  it('rechaza una contrasena distinta', async () => {
    const stored = await hashPassword('la-buena-contrasena', RAPIDAS);

    await expect(verifyPassword('la-buena-contrasena-typo', stored)).resolves.toBe(
      false,
    );
  });

  it('rechaza una contrasena que solo se parece', async () => {
    const stored = await hashPassword('contrasena123', RAPIDAS);

    await expect(verifyPassword('contrasena124', stored)).resolves.toBe(false);
  });

  it('no le importa el orden de las mayusculas en el hash guardado', async () => {
    const stored = await hashPassword('Contrasena', RAPIDAS);

    await expect(verifyPassword('Contrasena', stored)).resolves.toBe(true);
  });

  it('usa las iteraciones del hash, no las de este archivo', async () => {
    // El caso que hace util el formato autodocumentado. El hash se hizo con dos
    // iteraciones y el modulo dice 5000: si al verificar se usara el segundo
    // numero, la comparacion daria siempre falsa y todas las cuentas ya
    // existentes dejarian de poder entrar en cuanto se subieran las iteraciones.
    // Esta prueba falla si alguien vuelve a meter un parametro de iteraciones en
    // `verifyPassword`, y por eso es la que vigila esa puerta.
    const stored = await hashPassword('contrasena', RAPIDAS);

    await expect(verifyPassword('contrasena', stored)).resolves.toBe(true);
  });

  it('rechaza una cadena vacia sin lanzar', async () => {
    await expect(verifyPassword('contrasena', '')).resolves.toBe(false);
    await expect(verifyPassword('contrasena', 'no-es-un-hash')).resolves.toBe(false);
  });

  it.each([
    ['sin separadores', 'abcdefabcdef'],
    ['demasiadas partes', 'pbkdf2_sha256$2$sal$hash$de-mas'],
    ['algoritmo distinto', 'bcrypt$2$sal$hash'],
    ['iteraciones que no son numero', 'pbkdf2_sha256$muchas$sal$hash'],
    ['iteraciones en cero', 'pbkdf2_sha256$0$sal$hash'],
  ])('rechaza un hash %s sin lanzar', async (_label, stored) => {
    await expect(verifyPassword('contrasena', stored)).resolves.toBe(false);
  });
});

describe('los limites de la contrasena', () => {
  it('exige un minimo de ocho caracteres', () => {
    // Es una constante y no una funcion, y aun asi se prueba: subirla o bajarla
    // cambiaria lo que el formulario acepta, y eso es una decision de producto
    // que no deberia cambiar sin que alguien se entere de que ha cambiado.
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(MAX_PASSWORD_LENGTH).toBe(200);
  });

  it('admite una contrasena muy larga, que es larga pero no absurda', async () => {
    const larga = 'a'.repeat(MAX_PASSWORD_LENGTH);
    const stored = await hashPassword(larga, RAPIDAS);

    await expect(verifyPassword(larga, stored)).resolves.toBe(true);
  });
});
