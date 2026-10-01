import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'functions/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.mjs',
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'functions/**/*.ts'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/vite-env.d.ts',
        // Genérico a propósito: el servidor tiene sus pruebas junto al código y
        // el patrón de `src/` no las alcanzaría, así que un archivo de prueba
        // contaría como código sin probar y hundiría la cobertura por la vía
        // equivocada.
        '**/__tests__/**',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
