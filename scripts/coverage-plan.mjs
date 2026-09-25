export const scopedDirectories = ['src/app', 'src/ui', 'src/game'];

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function matchesScope(normalizedArgument, directory) {
  return (
    normalizedArgument === directory ||
    normalizedArgument.startsWith(`${directory}/`)
  );
}

export function scopeFor(args) {
  return scopedDirectories.find((directory) =>
    args.some((argument) =>
      matchesScope(normalizePath(argument), directory),
    ),
  );
}

// Un argumento que apunta bajo src/ pero no coincide con ninguna capacidad
// es un error de quien escribe el comando, no una peticion de medicion global.
// Sin esto, `npm run test:coverage -- src/ap` aplicaria en silencio los
// umbrales globales y la persona creeria estar midiendo otra cosa.
export function unrecognizedScopesFor(args) {
  return [
    ...new Set(
      args
        .map(normalizePath)
        .filter(
          (argument) =>
            argument.includes('src/') &&
            !scopedDirectories.some((directory) =>
              matchesScope(argument, directory),
            ),
        ),
    ),
  ];
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
