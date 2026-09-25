import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateBudgets, failuresFor, formatKilobytes } from './budget-plan.mjs';

const distAssets = fileURLToPath(new URL('../dist/assets/', import.meta.url));

async function collectEntries(directory) {
  let names;

  try {
    names = await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'No existe dist/assets. Ejecuta `npm run build` antes de comprobar presupuestos.',
        { cause: error },
      );
    }
    throw error;
  }

  const entries = [];

  for (const name of names) {
    if (name.endsWith('.map')) {
      continue;
    }

    const extension = name.slice(name.lastIndexOf('.') + 1);
    const kind = extension === 'js' ? 'javascript' : extension === 'css' ? 'css' : null;

    if (kind === null) {
      continue;
    }

    const contents = await readFile(join(directory, name));
    // Medición propia y estable con nivel 9. Difiere en unos pocos KiB de la
    // cifra que imprime Vite porque ambos ajustan gzip de forma distinta; el
    // presupuesto se aplica siempre a esta medición, que es la de la puerta.
    entries.push({ kind, name, bytes: gzipSync(contents, { level: 9 }).byteLength });
  }

  return entries;
}

let entries;

try {
  entries = await collectEntries(distAssets);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const totals = new Map();

for (const entry of entries) {
  totals.set(entry.kind, (totals.get(entry.kind) ?? 0) + entry.bytes);
}

// Sin un archivo que medir la puerta no debe pasar en silencio: un build
// vacío o mal copiado es un fallo, no un presupuesto de 0 bytes.
if (totals.size === 0) {
  console.error('No se encontró ningún archivo .js ni .css en dist/assets.');
  process.exit(1);
}

const results = evaluateBudgets(
  [...totals.entries()].map(([kind, bytes]) => ({ kind, bytes })),
);

for (const result of results) {
  const status = result.withinBudget ? 'dentro de presupuesto' : 'FUERA DE PRESUPUESTO';
  console.log(
    `${result.kind}: ${formatKilobytes(result.bytes)} gzip, limite ${formatKilobytes(result.limit)} (${result.ratio}%) — ${status}`,
  );
}

const failures = failuresFor(results);

if (failures.length > 0) {
  console.error('\nSe incumplen los presupuestos de bundle:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nPresupuestos de bundle cumplidos.');
