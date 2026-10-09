// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  ENVIRONMENT_DEFAULT,
  iterationsForEnvironment,
  MAXIMUM_ITERATIONS,
  MINIMUM_ITERATIONS,
} from '../iterations';
import { ITERATIONS } from '../password';

describe('iterationsForEnvironment', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['cadena vacia', ''],
    ['un numero fuera de rango por abajo', MINIMUM_ITERATIONS - 1],
    ['cero', 0],
    ['un negativo', -1],
    ['un decimal', 100_000.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['texto que no es numero', 'muchas'],
    ['texto con espacios que no es numero', '  '],
    ['un booleano', true],
    ['un objeto', { valor: 100_000 }],
    ['un array', [100_000]],
    ['un numero fuera de rango por arriba', MAXIMUM_ITERATIONS + 1],
    ['texto fuera de rango por arriba', String(MAXIMUM_ITERATIONS + 1)],
    ['texto fuera de rango por abajo', String(MINIMUM_ITERATIONS - 1)],
  ])('devuelve undefined con %s', (_etiqueta, valor) => {
    expect(iterationsForEnvironment(valor)).toBeUndefined();
  });

  it.each([
    ['en el suelo', MINIMUM_ITERATIONS],
    ['en el techo', MAXIMUM_ITERATIONS],
    ['en medio', 300_000],
  ])('devuelve el valor %s cuando esta dentro de rango', (_etiqueta, valor) => {
    expect(iterationsForEnvironment(valor)).toBe(valor);
  });

  it('lee tambien el valor escrito como texto, que es como llega la configuracion', () => {
    // Las variables de despliegue de Cloudflare llegan como texto, no como numero.
    // Si solo se aceptaran numeros, una configuracion correcta se ignoraria en
    // silencio y el servidor usaria 5 000 sin que nadie lo notara.
    expect(iterationsForEnvironment('150000')).toBe(150_000);
  });

  it('deja pasar el valor con puntos de miles, que es como se suele escribir', () => {
    expect(iterationsForEnvironment('100000')).toBe(100_000);
    expect(iterationsForEnvironment('1000000')).toBe(1_000_000);
  });

  it('no deja configurar un hasheo mas flojo que el suelo', () => {
    // Este es el punto del suelo. El valor por defecto ya esta puesto para caber
    // en el plan gratuito, asi que bajar de ahi no persigue nada bueno: solo
    // debilita el hash. Un cero, que convertiria el hash en un solo HMAC, se
    // queda fuera por el mismo sitio.
    expect(iterationsForEnvironment('4999')).toBeUndefined();
    expect(iterationsForEnvironment(4_999)).toBeUndefined();
    expect(iterationsForEnvironment('1')).toBeUndefined();
  });

  it('no deja configurar un hasheo tan alto que la peticion no acabe', () => {
    // Con diez millones de iteraciones un acceso tarda mas de veinte segundos y
    // la peticion se corta antes de que acabe, con la contrasena ya verificada.
    expect(iterationsForEnvironment('50000000')).toBeUndefined();
  });
});

describe('los limites que se exigen', () => {
  it('el suelo es el mismo valor que se despliega', () => {
    // Coinciden a proposito: lo que viene en el codigo es lo mas flojo que se
    // admite, y la configuracion solo puede subirlo para pagar un hash mas duro.
    expect(MINIMUM_ITERATIONS).toBe(5_000);
    expect(MINIMUM_ITERATIONS).toBe(ITERATIONS);
  });

  it('el techo es lo que cabe en una peticion sin cortarse', () => {
    expect(MAXIMUM_ITERATIONS).toBe(10_000_000);
    expect(MAXIMUM_ITERATIONS).toBeGreaterThan(ITERATIONS);
  });

  it('sin configuracion, valen las de produccion', () => {
    // `wrangler.toml` no pone ninguna variable, asi que esto es lo que pasaria al
    // desplegar: 5 000, el valor que cabe en el plan gratuito.
    expect(iterationsForEnvironment(undefined)).toBeUndefined();
    expect(ENVIRONMENT_DEFAULT).toBe(5_000);
    expect(ITERATIONS).toBe(5_000);
  });
});
