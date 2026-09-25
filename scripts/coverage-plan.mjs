const scopedDirectories = ['src/app', 'src/ui', 'src/game'];

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export function scopeFor(args) {
  return scopedDirectories.find((directory) =>
    args.some((argument) => {
      const normalizedArgument = normalizePath(argument);
      return (
        normalizedArgument === directory ||
        normalizedArgument.startsWith(`${directory}/`)
      );
    }),
  );
}

export function coverageArgsFor(args) {
  const scope = scopeFor(args);

  if (scope === undefined) {
    return [];
  }

  const include = `--coverage.include=${scope}/**/*.{ts,tsx}`;
  if (scope === 'src/game') {
    return [include, '--coverage.thresholds.100'];
  }

  return [
    include,
    '--coverage.thresholds.statements=80',
    '--coverage.thresholds.branches=70',
    '--coverage.thresholds.functions=80',
    '--coverage.thresholds.lines=80',
  ];
}
