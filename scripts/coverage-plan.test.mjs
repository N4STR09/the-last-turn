import { describe, expect, it } from 'vitest';

import { coverageArgsFor, scopeFor } from './coverage-plan.mjs';

describe('coverage plan', () => {
  it('uses 100% thresholds for the game engine', () => {
    expect(coverageArgsFor(['src/game'])).toEqual([
      '--coverage.include=src/game/**/*.{ts,tsx}',
      '--coverage.thresholds.100',
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
});
