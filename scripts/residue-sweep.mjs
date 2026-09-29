// Barrido de residuos: caracteres de otros alfabetos y el caracter de reemplazo
// que aparece cuando un texto se escribe en una codificacion que no lo soporta.
//
// Existe porque es un defecto que se ha repetido en varias tandas: al escribir
// rapido en comentarios en espanol se cuelan ideogramas o cirilicos, y ni el
// typecheck ni las pruebas los ven porque no son codigo. Es una puerta, no un
// recordatorio: falla con `exit=1` y senala archivo, linea y tipo.
//
// El rango se recorre una sola vez por linea en lugar de uno por rango, porque
// comparar cinco rangos por caracter se nota en un arbol grande.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RANGES = [
  { from: 0x4e00, to: 0x9fff, label: 'CJK' },
  { from: 0x3400, to: 0x4dbf, label: 'CJK' },
  { from: 0x3040, to: 0x30ff, label: 'kana' },
  { from: 0xac00, to: 0xd7af, label: 'hangul' },
  { from: 0x0400, to: 0x04ff, label: 'cirilico' },
  { from: 0xfffd, to: 0xfffd, label: 'reemplazo' },
];

const EXTENSIONS = /\.(ts|tsx|css|mjs|json|md|html|svg)$/;
const SKIP = new Set(['node_modules', '.git', 'coverage', '.vite']);

const ROOTS = ['src', 'scripts', 'docs', 'dist'];
const LOOSE_FILES = [
  'index.html',
  'CHANGELOG.md',
  'README.md',
  'SPEC-web-interface.md',
  'SPEC-game-engine.md',
  'SPEC-threat.md',
];

function walk(target, files = []) {
  for (const name of readdirSync(target)) {
    if (SKIP.has(name)) {
      continue;
    }

    const full = join(target, name);

    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.test(name)) {
      files.push(full);
    }
  }

  return files;
}

function collectTargets() {
  const targets = [];

  for (const root of ROOTS) {
    try {
      targets.push(...walk(root));
    } catch (error) {
      // `dist` solo existe despues de un build. Failing aqui por eso seria
      // castigar a quien ejecuta el barrido suelto, no al arbol.
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  for (const file of LOOSE_FILES) {
    try {
      statSync(file);
      targets.push(file);
    } catch {
      // Un archivo suelto opcional que no esta no es un fallo.
    }
  }

  return targets;
}

function offendingChar(line) {
  for (const char of line) {
    const code = char.codePointAt(0);

    for (const range of RANGES) {
      if (code >= range.from && code <= range.to) {
        return { char, code, label: range.label };
      }
    }
  }

  return null;
}

const hits = [];

for (const file of collectTargets()) {
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    const found = offendingChar(line);

    if (found !== null) {
      hits.push(
        `${file}:${index + 1} [${found.label}] U+${found.code.toString(16).toUpperCase().padStart(4, '0')} — ${line.trim()}`,
      );
    }
  });
}

if (hits.length === 0) {
  console.log('Sin residuos: ni CJK, ni kana, ni hangul, ni cirilico, ni U+FFFD.');
} else {
  console.error(`${hits.length} residuo(s):`);

  for (const hit of hits) {
    console.error(`  ${hit}`);
  }

  process.exitCode = 1;
}
