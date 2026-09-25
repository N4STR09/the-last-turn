import { describe, expect, it } from 'vitest';

import {
  budgets,
  evaluateBudgets,
  failuresFor,
  formatKilobytes,
  isWithinBudget,
  kilobytes,
} from './budget-plan.mjs';

describe('budget plan', () => {
  it('declares the budgets from the verification spec', () => {
    expect(budgets.javascript).toBe(200 * 1024);
    expect(budgets.css).toBe(50 * 1024);
  });

  it('converts bytes to kibibytes with two decimals', () => {
    expect(kilobytes(1024)).toBe(1);
    expect(kilobytes(77 * 1024 + 512)).toBe(77.5);
    expect(formatKilobytes(200 * 1024)).toBe('200.00 KiB');
  });

  it('accepts a size exactly at the limit', () => {
    expect(isWithinBudget(50 * 1024, 50 * 1024)).toBe(true);
  });

  it('rejects a size one byte over the limit', () => {
    expect(isWithinBudget(50 * 1024 + 1, 50 * 1024)).toBe(false);
  });

  it('reports the real bundle as within budget', () => {
    const results = evaluateBudgets([
      { kind: 'javascript', bytes: 77.02 * 1024 },
      { kind: 'css', bytes: 2.83 * 1024 },
    ]);

    expect(results.every((result) => result.withinBudget)).toBe(true);
    expect(failuresFor(results)).toEqual([]);
  });

  it('names the resource that exceeds its budget', () => {
    const results = evaluateBudgets([
      { kind: 'javascript', bytes: 201 * 1024 },
      { kind: 'css', bytes: 2 * 1024 },
    ]);

    expect(results[0].withinBudget).toBe(false);
    expect(results[0].ratio).toBeCloseTo(100.5, 5);
    expect(failuresFor(results)).toEqual([
      'javascript: 201.00 KiB supera el presupuesto de 200.00 KiB',
    ]);
  });

  it('rejects a resource kind without a declared budget', () => {
    expect(() => evaluateBudgets([{ kind: 'image', bytes: 10 }])).toThrow(
      /image/,
    );
  });
});
