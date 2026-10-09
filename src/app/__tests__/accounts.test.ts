import { afterEach, describe, expect, it, vi } from 'vitest';

import { accountsEnabled } from '../accounts';

/**
 * `accountsEnabled` decide si el panel de cuenta se enseña. Antes esa puerta era
 * el cliente de Google, así que un despliegue que solo quería correo y
 * contraseña no tenía panel; esta prueba fija que las cuentas y el botón de
 * Google son dos cosas distintas.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('accountsEnabled', () => {
  it('no hay cuentas si no hay ninguna variable', () => {
    expect(accountsEnabled()).toBe(false);
  });

  it('una llamada vacía a las cuentas no las habilita', () => {
    vi.stubEnv('VITE_ACCOUNTS', '');

    expect(accountsEnabled()).toBe(false);
  });

  it('cualquier valor no vacío habilita las cuentas', () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');

    expect(accountsEnabled()).toBe(true);
  });

  it('un cliente de Google habilita las cuentas sin la variable propia', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente.apps.googleusercontent.com');

    expect(accountsEnabled()).toBe(true);
  });

  it('un cliente de Google vacío no habilita las cuentas', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    expect(accountsEnabled()).toBe(false);
  });

  it('con las dos variables puestas sigue habiendo cuentas', () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente.apps.googleusercontent.com');

    expect(accountsEnabled()).toBe(true);
  });
});
