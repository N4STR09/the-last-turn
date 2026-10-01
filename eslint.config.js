import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['coverage', 'dist', 'node_modules'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // El servidor no es un navegador. Sin este bloque heredaría los globals del
    // bloque general y podría escribir `document` o `localStorage` en código que
    // en la plataforma no existen: no fallaría nada en local, y en producción
    // reventaría en la primera petición.
    files: ['functions/**/*.ts'],
    languageOptions: {
      globals: globals.serviceworker,
    },
    rules: {
      // Cierra la puerta que abre `@types/node` en `tsconfig.functions.json`.
      // La plataforma no tiene módulos de Node, así que un `import 'node:fs'`
      // en `_lib` o en `api` no falla al compilar ni al probar en local: falla
      // en la primera petición en producción, que es el peor momento para
      // descubrirlo. Las pruebas sí pueden usarlos, y por eso la regla no toca
      // `__tests__`.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'os', 'child_process', 'crypto'],
              message:
                'La plataforma no tiene módulos de Node. Usa las funciones web estándar: fetch, crypto.subtle, TextEncoder, URL.',
            },
          ],
        },
      ],
    },
  },
  {
    // Solo las pruebas pueden salirse a Node, y solo porque corren en Node.
    files: ['functions/**/__tests__/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
