// Las dos mitades del servidor no se miden igual. `functions/_lib` es donde
// vive el dominio —el hasheado, las sesiones, la verificación del token de
// Google, la suma de estadísticas— y está escrito como funciones puras con la
// base de datos inyectada, así que llega al 100 % sin excusas. `functions/api`
// es el cableado HTTP: rutas, cookies y códigos de estado, que se prueban
// llamando las funciones de ruta con una `Request` construida a mano.
//
// El motivo de la diferencia es que el fallo caro no está repartido por igual.
// Un error de estado en una ruta da un 500; un error en el hasheado o en la
// verificación de la firma abre la puerta.
export const scopedDirectories = [
  'src/app',
  'src/ui',
  'src/game',
  'functions/_lib',
  'functions/api',
];

// Directorios que se exigen al 100 %. Es una lista y no una comparación para que
// añadir uno más no obligue a reescribir la condición, que es exactamente donde
// un alcance se quedaría fuera por descuido.
//
// `src/ui` no está aquí y es deliberado. Mide al 100 %, pero el plan no lo exige:
// exigirlo convertiría una práctica en una regla, y esa es una decisión que
// hay que tomar a parte y decir en voz alta. Lo mismo con `src/app`, que está
// en 98,22 por práctica. Si algún día se deciden exigir, es un cambio de
// política y entra en su propio commit, no de paso con un andamiaje.
export const fullCoverageDirectories = ['src/game', 'functions/_lib'];

// `functions/api` queda por debajo del 100 % a propósito y con el listón alto.
// Cada arista sin cubrir aquí es un camino de error, y hay más caminos de error
// en el cableado HTTP que líneas de código.
export const apiCoverageThresholds = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
};

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

// Las raíces con alcance propio. Un argumento que apunta dentro de una de ellas
// pero no coincide con ningún alcance es un error de quien escribe el comando, no
// una petición de medición global. Sin esto, `npm run test:coverage -- src/ap`
// aplicaría en silencio los umbrales globales y la persona creería estar midiendo
// otra cosa.
const scopeRoots = ['src/', 'functions/'];

// Un argumento que apunta bajo una raíz con alcance pero no coincide con ningún
// alcance es un error de quien escribe el comando, no una petición de medición
// global. Sin esto, `npm run test:coverage -- src/ap` aplicaría en silencio los
// umbrales globales y la persona creería estar midiendo otra cosa.
export function unrecognizedScopesFor(args) {
  return [
    ...new Set(
      args
        .map(normalizePath)
        .filter(
          (argument) =>
            scopeRoots.some((root) => argument.includes(root)) &&
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
  if (fullCoverageDirectories.includes(scope)) {
    return [include, '--coverage.thresholds.100'];
  }

  if (scope === 'functions/api') {
    return [
      include,
      `--coverage.thresholds.statements=${apiCoverageThresholds.statements}`,
      `--coverage.thresholds.branches=${apiCoverageThresholds.branches}`,
      `--coverage.thresholds.functions=${apiCoverageThresholds.functions}`,
      `--coverage.thresholds.lines=${apiCoverageThresholds.lines}`,
    ];
  }

  return [
    include,
    '--coverage.thresholds.statements=80',
    '--coverage.thresholds.branches=70',
    '--coverage.thresholds.functions=80',
    '--coverage.thresholds.lines=80',
  ];
}
