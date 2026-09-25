import { describe, expect, it } from 'vitest';

import {
  createThreatNoticeViewModel,
  threatMessageFor,
} from '../threat-copy';

describe('threatMessageFor', () => {
  it('usa un mensaje propio para los primeros niveles', () => {
    const messages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
      threatMessageFor,
    );

    expect(new Set(messages).size).toBe(12);
  });

  it('repite el ciclo annotando el nivel a partir del segundo paso', () => {
    expect(threatMessageFor(13)).toBe(`${threatMessageFor(1)} (Nivel 13)`);
    expect(threatMessageFor(25)).toBe(`${threatMessageFor(1)} (Nivel 25)`);
  });

  it.each([0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'cae al primer mensaje con el nivel no utilizable %s',
    (threat) => {
      expect(threatMessageFor(threat)).toBe(threatMessageFor(1));
    },
  );

  it('habla siempre en español y el texto base termina en punto', () => {
    for (let level = 1; level <= 30; level += 1) {
      const message = threatMessageFor(level);

      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/[\u0400-\u04FF\u4E00-\u9FFF]/u);
      // Del segundo ciclo en adelante el mensaje lleva el sufijo de nivel.
      const base = message.replace(/ \(Nivel \d+\)$/, '');
      expect(/[.]$/.test(base)).toBe(true);
    }
  });

  it('no promete que la partida termine en una victoria', () => {
    for (let level = 1; level <= 30; level += 1) {
      expect(threatMessageFor(level).toLowerCase()).not.toContain('ganas');
      expect(threatMessageFor(level).toLowerCase()).not.toContain('victoria');
    }
  });
});

describe('createThreatNoticeViewModel', () => {
  it('expone el nivel, la carga, el mensaje y la pista', () => {
    const model = createThreatNoticeViewModel({ threat: 2, load: 2 });

    expect(model).toEqual({
      threat: 2,
      load: 2,
      level: 'Nivel de amenaza 2',
      message: threatMessageFor(2),
      hint: 'Haz click para continuar...',
    });
  });

  it('no filtra salud ni otros recursos en el aviso', () => {
    const model = createThreatNoticeViewModel({ threat: 4, load: 4 });
    const serialized = JSON.stringify(model).toLowerCase();

    expect(serialized).not.toContain('salud');
    expect(serialized).not.toContain('health');
  });
});
