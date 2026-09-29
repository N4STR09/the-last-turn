import { describe, expect, it } from 'vitest';

import {
  createRandomSeed,
  createSeededRandomInt,
  decodeActionLog,
  decodeDifficulty,
  decodeSeed,
  encodeActionLog,
  encodeDifficulty,
  encodeReplayQuery,
  encodeSeed,
  isReplayLink,
  parseReplayQuery,
  type ReplayLink,
} from '../seed';

describe('createSeededRandomInt', () => {
  it('devuelve la misma secuencia para la misma semilla', () => {
    const a = createSeededRandomInt(12345);
    const b = createSeededRandomInt(12345);

    const first = Array.from({ length: 20 }, () => a(1, 100));
    const second = Array.from({ length: 20 }, () => b(1, 100));

    expect(first).toEqual(second);
  });

  it('da secuencias distintas para semillas distintas', () => {
    const a = createSeededRandomInt(1);
    const b = createSeededRandomInt(2);

    const first = Array.from({ length: 20 }, () => a(1, 1000));
    const second = Array.from({ length: 20 }, () => b(1, 1000));

    expect(first).not.toEqual(second);
  });

  it('respeta el intervalo que le piden, incluidos los extremos', () => {
    const random = createSeededRandomInt(99);

    for (let index = 0; index < 500; index += 1) {
      const value = random(3, 9);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('no se queda siempre en un extremo', () => {
    // Un generador roto que devolviera siempre el maximo pasaria la prueba del
    // intervalo y no seria un generador.
    const random = createSeededRandomInt(4242);
    const values = new Set(
      Array.from({ length: 300 }, () => random(1, 6)),
    );

    expect(values.size).toBe(6);
  });

  it('cubre los dos valores de un intervalo de uno', () => {
    const random = createSeededRandomInt(7);
    const values = new Set(Array.from({ length: 60 }, () => random(0, 1)));

    expect(values).toEqual(new Set([0, 1]));
  });
});

describe('encodeSeed y decodeSeed', () => {
  it('ida y vuelta exacta en el rango de 32 bits', () => {
    const seeds = [0, 1, 35, 36, 123456789, 0xffffffff];

    for (const seed of seeds) {
      expect(decodeSeed(encodeSeed(seed))).toBe(seed);
    }
  });

  it('escribe en base 36, que es lo que cabe corto en una URL', () => {
    expect(encodeSeed(35)).toBe('z');
    expect(encodeSeed(36)).toBe('10');
    expect(encodeSeed(0xffffffff)).toBe('1z141z3');
  });

  it('rechaza lo que no es una semilla en vez de partirse', () => {
    // Un enlace corrupto tiene que arrancar una partida normal, no romper la
    // pagina. Devolver `null` es lo que permite esa caida.
    expect(decodeSeed('')).toBeNull();
    expect(decodeSeed('no-es-una-semilla')).toBeNull();
    expect(decodeSeed('-1')).toBeNull();
    expect(decodeSeed('1.5')).toBeNull();
    expect(decodeSeed('zzzzzzzz')).toBeNull();
    expect(decodeSeed(' 1')).toBeNull();
  });
});

describe('createRandomSeed', () => {
  it('cae siempre dentro del rango de 32 bits sin signo', () => {
    for (let index = 0; index < 200; index += 1) {
      const seed = createRandomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('el registro de acciones', () => {
  it('usa las mismas letras que los atajos de teclado', () => {
    // explorar, comer, curar, descansar, reparar. Si estas letras cambian, los
    // enlaces viejos dejan de significar lo que significaban.
    expect(encodeActionLog(['explore', 'eat', 'cure', 'rest', 'repair'])).toBe(
      'ecsdr',
    );
  });

  it('ida y vuelta exacta', () => {
    const log = [
      'explore',
      'rest',
      'explore',
      'eat',
      'repair',
      'rest',
    ] as const;

    expect(decodeActionLog(encodeActionLog(log))).toEqual(log);
  });

  it('acepta un registro vacio', () => {
    expect(decodeActionLog('')).toEqual([]);
  });

  it('rechaza una letra que no es ninguna accion', () => {
    expect(decodeActionLog('ecx')).toBeNull();
    expect(decodeActionLog('EC')).toBeNull();
    expect(decodeActionLog('e c')).toBeNull();
  });
});

describe('encodeDifficulty y decodeDifficulty', () => {
  it('ida y vuelta exacta', () => {
    expect(encodeDifficulty('normal')).toBe('n');
    expect(encodeDifficulty('agony')).toBe('a');
    expect(decodeDifficulty('n')).toBe('normal');
    expect(decodeDifficulty('a')).toBe('agony');
  });

  it('rechaza una dificultad desconocida', () => {
    expect(decodeDifficulty('x')).toBeNull();
    expect(decodeDifficulty('')).toBeNull();
  });
});

describe('encodeReplayQuery y parseReplayQuery', () => {
  const link = {
    seed: 4294967295,
    difficulty: 'agony' as const,
    actions: ['explore', 'rest', 'eat', 'repair'] as const,
  };

  it('ida y vuelta exacta del enlace completo', () => {
    const query = encodeReplayQuery(link);
    const parsed = parseReplayQuery(`?${query}`);

    expect(parsed).toEqual({
      seed: link.seed,
      difficulty: 'agony',
      actions: ['explore', 'rest', 'eat', 'repair'],
    });
  });

  it('es un enlace corto, del orden de 150 caracteres', () => {
    // Una partida larga son unas 150 acciones de una letra. Con la ruta y el
    // dominio de verdad, el enlace completo sigue siendo manejable.
    const long: ReplayLink = {
      ...link,
      actions: Array.from({ length: 200 }, () => 'explore' as const),
    };
    const url = `https://the-last-turn.example/${encodeReplayQuery(long)}`;

    expect(url.length).toBeLessThan(260);
  });

  it('devuelve null si falta cualquiera de las tres piezas', () => {
    expect(parseReplayQuery('')).toBeNull();
    expect(parseReplayQuery('?seed=1z141z3&d=a')).toBeNull();
    expect(parseReplayQuery('?seed=1z141z3&a=ee')).toBeNull();
    expect(parseReplayQuery('?d=a&a=ee')).toBeNull();
  });

  it('devuelve null si alguna pieza esta corrupta', () => {
    expect(parseReplayQuery('?seed=!!!&d=a&a=ee')).toBeNull();
    expect(parseReplayQuery('?seed=1z141z3&d=z&a=ee')).toBeNull();
    expect(parseReplayQuery('?seed=1z141z3&d=a&a=zz')).toBeNull();
  });

  it('toma el primer valor de un parametro repetido', () => {
    // Un enlace con `?seed=a&seed=b` es raro, pero si aparece tiene que
    // comportarse como se leería a ojo. `URLSearchParams` se queda con el
    // primero, y eso es lo que se documenta aquí para que no parezca un descuido.
    expect(parseReplayQuery('?seed=1z141z3&seed=z&d=a&a=ee')).toEqual({
      seed: 0xffffffff,
      difficulty: 'agony',
      actions: ['explore', 'explore'],
    });
  });
});

describe('isReplayLink', () => {
  it('distingue un enlace de partida de una semilla suelta', () => {
    // Sin acciones hay una semilla que abrir, que es otra cosa. Con acciones hay
    // una partida que reproducir.
    const base = { seed: 1, difficulty: 'normal' as const };

    expect(isReplayLink({ ...base, actions: [] })).toBe(false);
    expect(isReplayLink({ ...base, actions: ['explore'] })).toBe(true);
    expect(isReplayLink(null)).toBe(false);
  });
});
