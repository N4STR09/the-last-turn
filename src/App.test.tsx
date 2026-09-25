import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('muestra la pantalla provisional accesible', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Last Turn' }),
    ).toBeInTheDocument();
    expect(screen.getByText('La partida se está preparando.')).toBeVisible();
  });
});
