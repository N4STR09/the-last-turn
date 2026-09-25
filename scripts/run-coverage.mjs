import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const scopedDirectories = ['src/app', 'src/game', 'src/ui'];
const scope = scopedDirectories.find(
  (directory) =>
    args.some(
      (argument) =>
        argument === directory || argument.startsWith(`${directory}/`),
    ),
);

const vitestEntry = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
);
const coverageArgs =
  scope === undefined
    ? []
    : [`--coverage.include=${scope}/**/*.{ts,tsx}`];
const result = spawnSync(
  process.execPath,
  [vitestEntry, 'run', '--coverage', ...args, ...coverageArgs],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
