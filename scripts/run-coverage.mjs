import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { coverageArgsFor } from './coverage-plan.mjs';

const args = process.argv.slice(2);
const vitestEntry = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
);
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
