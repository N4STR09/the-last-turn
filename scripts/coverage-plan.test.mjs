import { describe, expect, it } from 'vitest';

import {
  coverageArgsFor,
  fullCoverageDirectories,
  scopeFor,
  unrecognizedScopesFor,
} from './coverage-plan.mjs';

describe('coverage plan', () => {
  it('uses 100% thresholds for the game engine', () => {
    expect(coverageArgsFor(['src/game'])).toEqual([
      '--coverage.include=src/game/**/*.{ts,tsx}',
      '--coverage.thresholds.100',
    ]);
  });

  it('uses 100% thresholds for the server domain, like the game engine', () => {
    expect(scopeFor(['functions/_lib'])).toBe('functions/_lib');
    expect(coverageArgsFor(['functions/_lib'])).toEqual([
      '--coverage.include=functions/_lib/**/*.{ts,tsx}',
      '--coverage.thresholds.100',
    ]);
  });

  it('leaves src/ui on the global thresholds, because demanding 100% is a policy change', () => {
    // `src/ui` mide al 100 % y el plan no lo exige. Exigirlo sería cambiar una
    // regla del proyecto dentro de un commit de andamiaje, así que esta
    // prueba lo fija: si alguien lo mueve a la lista de 100 %, falla aquí y
    // tiene que hacerlo a propósito y por separado.
    expect(fullCoverageDirectories).not.toContain('src/ui');
  });

  it('holds the HTTP routes below 100% but well above the global bar', () => {
    expect(scopeFor(['functions/api'])).toBe('functions/api');
    expect(coverageArgsFor(['functions/api'])).toEqual([
      '--coverage.include=functions/api/**/*.{ts,tsx}',
      '--coverage.thresholds.statements=90',
      '--coverage.thresholds.branches=85',
      '--coverage.thresholds.functions=90',
      '--coverage.thresholds.lines=90',
    ]);
  });

  it.each(['src/app', 'src\\ui'])(
    'uses the application and UI thresholds for %s',
    (scope) => {
      expect(scopeFor([scope])).toBe(scope.replaceAll('\\', '/'));
      expect(coverageArgsFor([scope])).toEqual([
        `--coverage.include=${scope.replaceAll('\\', '/')}/**/*.{ts,tsx}`,
        '--coverage.thresholds.statements=80',
        '--coverage.thresholds.branches=70',
        '--coverage.thresholds.functions=80',
        '--coverage.thresholds.lines=80',
      ]);
    },
  );

  it('preserves the global thresholds when no capability is selected', () => {
    expect(coverageArgsFor([])).toEqual([]);
  });

  it('does not confuse a similar directory with a supported scope', () => {
    expect(scopeFor(['src/application'])).toBeUndefined();
  });

  it('reports nothing unrecognized for a supported scope or no scope', () => {
    expect(unrecognizedScopesFor([])).toEqual([]);
    expect(unrecognizedScopesFor(['src/game'])).toEqual([]);
    expect(unrecognizedScopesFor(['src\\ui', '--reporter=dot'])).toEqual([]);
  });

  it.each([
    ['src/ap', 'a typo that would silently fall back to global thresholds'],
    ['src/application', 'a near-miss directory'],
    ['C:/repo/src/app', 'an absolute path'],
    ['functions/_libb', 'a server typo, which must not fall open either'],
    ['functions/_libs', 'a near-miss directory under the server root'],
  ])('rejects %s instead of failing open', (argument) => {
    expect(scopeFor([argument])).toBeUndefined();
    expect(unrecognizedScopesFor([argument])).toEqual([argument]);
  });

  it('does not confuse the two server halves with each other', () => {
    expect(scopeFor(['functions/api/stats.ts'])).toBe('functions/api');
    expect(scopeFor(['functions/_lib/password.ts'])).toBe('functions/_lib');
  });
});
