export const budgets = Object.freeze({
  javascript: 200 * 1024,
  css: 50 * 1024,
});

export function kilobytes(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

export function formatKilobytes(bytes) {
  return `${kilobytes(bytes).toFixed(2)} KiB`;
}

export function isWithinBudget(bytes, limit) {
  return bytes <= limit;
}

export function evaluateBudgets(entries) {
  return entries.map((entry) => {
    const limit = budgets[entry.kind];

    if (limit === undefined) {
      throw new Error(`Tipo de recurso sin presupuesto definido: ${entry.kind}`);
    }

    return {
      ...entry,
      limit,
      withinBudget: isWithinBudget(entry.bytes, limit),
      ratio: Math.round((entry.bytes / limit) * 1000) / 10,
    };
  });
}

export function failuresFor(results) {
  return results
    .filter((result) => !result.withinBudget)
    .map(
      (result) =>
        `${result.kind}: ${formatKilobytes(result.bytes)} supera el presupuesto de ${formatKilobytes(result.limit)}`,
    );
}
