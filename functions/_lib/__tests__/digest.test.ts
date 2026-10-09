// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { fromHex, toHex } from '../bytes';
import {
  randomId,
  randomToken,
  sha256Hex,
  sha256HexOfBytes,
  SHA256_HEX_LENGTH,
  TOKEN_BYTES,
} from '../digest';

describe('sha256Hex', () => {
  it('produce 64 caracteres en hexadecimal en minusculas', async () => {
    const digest = await sha256Hex('lo que sea');

    expect(digest).toHaveLength(SHA256_HEX_LENGTH);
    expect(SHA256_HEX_LENGTH).toBe(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('coincide con el resumen conocido de una cadena vacia', async () => {
    // El valor esta en todos los sitios y es el mas comprobado de SHA-256. Si
    // el algoritmo o el relleno cambiaran, esta prueba lo dira sin depender de
    // comparar contra una copia de la misma funcion.
    await expect(sha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('da el mismo resumen para el mismo texto y otro para el que cambia', async () => {
    const first = await sha256Hex('el mismo texto');
    const again = await sha256Hex('el mismo texto');
    const other = await sha256Hex('el mismo texto.');

    expect(first).toBe(again);
    expect(first).not.toBe(other);
  });

  it('trata distinto un texto con espacios delante', async () => {
    await expect(sha256Hex('con espacio')).not.resolves.toBe(await sha256Hex('conespacio'));
  });

  it('codifica en UTF-8, asi que una letra acentuada no es un byte', async () => {
    // Si se codificara en Latin1, "ñ" seria un byte y en UTF-8 son dos. El
    // resumen saldria distinto y dos textos que a simple vista parecen iguales
    // darian dos resumenes distintos, que es justo lo que haria fallar una
    // comparacion de tokens.
    const conEnie = await sha256Hex('mañana');
    const conEñe = await sha256Hex('mane');

    expect(conEnie).not.toBe(conEñe);
  });
});

describe('sha256HexOfBytes', () => {
  it('da el mismo resumen que la version de texto sobre el mismo contenido', async () => {
    // Las dos funciones tienen que coincidir byte a byte. Si una usara una
    // codificacion distinta, un token resumido con una y comparado con la otra
    // no coincidiria nunca y ninguna sesion serviria.
    const text = 'un texto con espacios y acentos: mañana';
    const bytes = new TextEncoder().encode(text);

    await expect(sha256HexOfBytes(bytes)).resolves.toBe(await sha256Hex(text));
  });

  it('resume bytes vacios sin fallar', async () => {
    const digest = await sha256HexOfBytes(new Uint8Array(0));

    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('distingue dos series de bytes que se parecen', async () => {
    const a = await sha256HexOfBytes(new Uint8Array([1, 2, 3]));
    const b = await sha256HexOfBytes(new Uint8Array([1, 2, 4]));

    expect(a).not.toBe(b);
  });

  it('resuelve un token hexadecimal a los mismos bytes que a su texto', async () => {
    // Un token en la tabla esta escrito en hexadecimal, y ahi los bytes del
    // resumen son los de las cifras, no lo que las cifras representan. La vuelta
    // `toHex` y `fromHex` es lo que hace que las dos cosas cuadren.
    const bytes = fromHex(toHex(fromHex('000f10ff')));

    expect(bytes).toEqual(fromHex('000f10ff'));
    await expect(sha256HexOfBytes(bytes)).resolves.toBe(
      await sha256HexOfBytes(new Uint8Array([0x00, 0x0f, 0x10, 0xff])),
    );
  });
});

describe('randomToken', () => {
  it('produce 32 bytes por defecto, que son 43 caracteres en base64url', () => {
    const token = randomToken();

    expect(TOKEN_BYTES).toBe(32);
    expect(token).toHaveLength(43);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('no se repite', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));

    // Con 200 muestras, una colision en 32 bytes seria un fallo del generador de
    // numeros aleatorios, no mala suerte. Es una prueba de que se esta llamando
    // al generador de la plataforma y no a algo mas debil.
    expect(tokens.size).toBe(200);
  });

  it('admite otra longitud', () => {
    expect(randomToken(8)).toHaveLength(11);
    expect(randomToken(16)).toHaveLength(22);
  });
});

describe('randomId', () => {
  it('produce 16 bytes, la mitad que un token de sesion', () => {
    // La diferencia es a proposito: un identificador de jugador viaja en las
    // respuestas JSON y no es un secreto, mientras que un token de sesion si lo
    // es. Mezclarlos haria que cualquiera pudiera adivinar identificadores.
    expect(randomId()).toHaveLength(22);
    expect(randomId()).not.toBe(randomId());
  });
});