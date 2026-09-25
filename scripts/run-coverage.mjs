import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { coverageArgsFor, scopedDirectories, unrecognizedScopesFor } from './coverage-plan.mjs';

const args = process.argv.slice(2);
const vitestEntry = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
);

const unrecognized = unrecognizedScopesFor(args);

if (unrecognized.length > 0) {
  console.error(
    `Ambito de cobertura no reconocido: ${unrecognized.join(', ')}`,
  );
  console.error(`Ambitos admitidos: ${scopedDirectories.join(', ')}`);
  console.error(
    'Sin argumentos se mide todo src/ con los umbrales globales de vite.config.ts.',
  );
  process.exit(1);
}

const coverageArgs = coverageArgsFor(args);
const result = spawnSync(
  process.execPath,
  [vitestEntry, 'run', '--coverage', ...args, ...coverageArgs],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
