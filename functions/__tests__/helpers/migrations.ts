import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El SQL de todas las migraciones del repositorio, en orden.
 *
 * No apunta a un archivo concreto a propósito: en cuanto hay dos, apuntar a la
 * primera dejaría las pruebas de esquema leyendo un esquema viejo sin que
 * nada fallara. Los nombres se ordenan, así que `0002` siempre va después de
 * `0001` y una futura `0003` entra sin tocar este archivo.
 */
export function migrationsSql(): string {
  const directory = join(import.meta.dirname, '..', '..', '..', 'migrations');
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(directory, name), 'utf8'))
    .join('\n');
}
