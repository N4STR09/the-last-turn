// @vitest-environment node
//
// Node y no jsdom, que es el que pone el proyecto por defecto. El servidor no
// se ejecuta en un navegador y probarlo en uno miente: en jsdom, `TextEncoder`
// devuelve un `Uint8Array` del reino de jsdom y el esperado es del reino de
// Node, así que dos arrays con los mismos bytes no son iguales y la prueba
// falla sin que haya ningún fallo. En el entorno de Node no hay dos reinos.
import { describe, expect, it } from 'vitest';

import {
  constantTimeEqual,
  fromBase64Url,
  fromHex,
  toBase64Url,
  toHex,
  utf8Bytes,
} from '../bytes';

describe('toHex', () => {
  it('escribe dos caracteres por byte en minúscula', () => {
    expect(toHex(new Uint8Array([0x00, 0x0f, 0x10, 0xff]))).toBe('000f10ff');
  });

  it('devuelve vacío para una entrada vacía', () => {
    expect(toHex(new Uint8Array(0))).toBe('');
  });

  it('usa siempre minúsculas, porque el hash guardado se compara con eso', () => {
    // 0xab en mayúsculas sería 'AB'. Si el formato de guardado cambiara a
    // mayúsculas, un hash ya escrito en minúsculas no coincidiría consigo mismo
    // y el fallo parecería una contraseña mal escrita.
    expect(toHex(new Uint8Array([0xab, 0xcd, 0xef]))).toBe('abcdef');
    expect(toHex(new Uint8Array([0xab, 0xcd, 0xef]))).not.toBe('ABCDEF');
  });

  it('recorre los 256 valores posibles sin perder ninguno', () => {
    const all = new Uint8Array(256);
    for (let value = 0; value < 256; value += 1) {
      all[value] = value;
    }
    const hex = toHex(all);
    expect(hex).toHaveLength(512);
    expect(fromHex(hex)).toEqual(all);
  });
});

describe('fromHex', () => {
  it('es la inversa de toHex', () => {
    const bytes = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('acepta mayúsculas, porque un hash puede llegar de una herramienta', () => {
    expect(fromHex('ABCDEF')).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
  });

  it('lanza con longitud impar, en vez de descartar el carácter suelto', () => {
    // Descartarlo daría un byte de más o de menos y un hash que no
    // corresponde a nada, sin ningún error que lo dijera.
    expect(() => fromHex('abc')).toThrow(/par/);
  });

  it('lanza con un dígito que no es hexadecimal, y dice cuál era', () => {
    expect(() => fromHex('zz')).toThrow(/0 al f/);
  });
});

describe('toBase64Url', () => {
  it('no deja ni +, ni /, ni =', () => {
    // Los tres salen con bytes altos y es la razón de que exista el formato:
    // en una cookie, + y / dan problemas y = corta el valor.
    const tricky = new Uint8Array([0xfb, 0xff, 0xbf, 0xef, 0xbe]);
    const encoded = toBase64Url(tricky);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('usa - y _ donde el base64 normal usa + y /', () => {
    // 0xfb 0xff 0x00 en base64 es "+/8A", que en base64url es "-_8A".
    expect(toBase64Url(new Uint8Array([0xfb, 0xff, 0x00]))).toBe('-_8A');
  });

  it('no añade relleno, aunque la longitud lo pida', () => {
    expect(toBase64Url(new Uint8Array([0x01]))).toBe('AQ');
    expect(toBase64Url(new Uint8Array([0x01]))).not.toContain('=');
  });
});

describe('fromBase64Url', () => {
  it('es la inversa de toBase64Url', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('acepta el relleno, que es lo que llega si alguien copió el token', () => {
    // Cinco bytes son siete caracteres base64 y un `=`. Los tokens de sesión
    // son de 32 bytes y no llevan relleno, así que esto solo pasa si el valor
    // viene de una herramienta en lugar de de la cookie.
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const withoutPadding = toBase64Url(bytes);

    expect(withoutPadding).toHaveLength(7);
    expect(fromBase64Url(`${withoutPadding}=`)).toEqual(bytes);
  });

  it('acepta también el base64 normal, no solo el url', () => {
    expect(fromBase64Url('+/8A')).toEqual(new Uint8Array([0xfb, 0xff, 0x00]));
  });
});

describe('constantTimeEqual', () => {
  it('dice que sí cuando los bytes son los mismos', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(
      true,
    );
  });

  it('dice que no en cuanto un byte se aparta', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(
      false,
    );
  });

  it('dice que no ante longitudes distintas, sin leer los bytes', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(
      false,
    );
  });

  it('no se adelanta en el primer byte que coincide', () => {
    // La razón de existir: si cortara en el primer byte distinto, dos hashes
    // que coinciden en 63 de 64 bytes tardarían mediblemente menos que dos que
    // difieren en el primero, y eso mediría el prefijo común. Aquí el bucle no
    // tiene salida temprana, así que ambos casos recorren los 64 bytes.
    const reference = new Uint8Array(64).fill(7);
    const almostSame = new Uint8Array(64).fill(7);
    almostSame[63] = 8;
    const completelyDifferent = new Uint8Array(64).fill(9);

    expect(constantTimeEqual(reference, almostSame)).toBe(false);
    expect(constantTimeEqual(reference, completelyDifferent)).toBe(false);
  });

  it('trata dos vacíos como iguales', () => {
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it('compara los bytes de una vista, no los del búfer que la envuelve', () => {
    // `subarray` devuelve una vista que empieza más allá del principio del
    // búfer. Si la comparación leyera desde el byte cero, dos vistas iguales de
    // dos búferes distintos darían que sí siempre, y un hash se compararía con
    // el principio del búfer en lugar de consigo mismo.
    const backing = new Uint8Array([9, 9, 9, 0xaa, 0xbb, 0xcc, 9, 9, 9]);
    const view = backing.subarray(3, 6);
    const same = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const other = new Uint8Array([0xaa, 0xbb, 0xcd]);

    expect(constantTimeEqual(view, same)).toBe(true);
    expect(constantTimeEqual(view, other)).toBe(false);
  });
});

describe('utf8Bytes', () => {
  it('codifica el texto en UTF-8 y no en Latin1', () => {
    // 'ñ' es un byte en Latin1 y dos en UTF-8. Si se codificara con la regla
    // equivocada, una contraseña con ñ tendría un hash que no coincide con el
    // que se calculó al registrarla.
    expect(utf8Bytes('ñ')).toEqual(new Uint8Array([0xc3, 0xb1]));
  });

  it('codifica los emojis, que son cuatro bytes', () => {
    expect(utf8Bytes('🜂')).toEqual(new Uint8Array([0xf0, 0x9f, 0x9c, 0x82]));
  });
});
