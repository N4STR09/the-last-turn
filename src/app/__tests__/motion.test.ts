import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  motionPreferences,
  setMotionFast,
  setMotionReduced,
  subscribeMotionPreferences,
  useMotionPreferences,
} from '../motion';

/** La raíz, para leer las clases que se le ponen. */
function raiz(): HTMLElement {
  return document.documentElement;
}

afterEach(() => {
  setMotionReduced(false);
  setMotionFast(false);
});

describe('las preferencias de movimiento', () => {
  it('empiezan en normal y sin ninguna clase puesta', () => {
    expect(motionPreferences()).toEqual({ reduced: false, fast: false });
    expect(raiz().classList.contains('motion-reduced')).toBe(false);
    expect(raiz().classList.contains('motion-fast')).toBe(false);
  });

  it('pone y quita la clase de movimiento reducido en la raíz', () => {
    setMotionReduced(true);

    expect(motionPreferences()).toEqual({ reduced: true, fast: false });
    expect(raiz().classList.contains('motion-reduced')).toBe(true);

    setMotionReduced(false);

    expect(motionPreferences()).toEqual({ reduced: false, fast: false });
    expect(raiz().classList.contains('motion-reduced')).toBe(false);
  });

  it('la doble velocidad va por su cuenta y no se toca con la otra', () => {
    setMotionReduced(true);
    setMotionFast(true);

    expect(motionPreferences()).toEqual({ reduced: true, fast: true });
    expect(raiz().classList.contains('motion-reduced')).toBe(true);
    expect(raiz().classList.contains('motion-fast')).toBe(true);

    setMotionFast(false);

    expect(motionPreferences()).toEqual({ reduced: true, fast: false });
    expect(raiz().classList.contains('motion-reduced')).toBe(true);
    expect(raiz().classList.contains('motion-fast')).toBe(false);
  });

  it('avisa a quien escuche y deja de avisar al darse de baja', () => {
    const listener = vi.fn();
    const baja = subscribeMotionPreferences(listener);

    setMotionReduced(true);
    expect(listener).toHaveBeenCalledOnce();

    baja();
    setMotionFast(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('no avisa cuando no cambia nada', () => {
    const listener = vi.fn();
    const baja = subscribeMotionPreferences(listener);

    setMotionReduced(false);

    expect(listener).not.toHaveBeenCalled();
    baja();
  });

  it('el hook sigue los cambios mientras esté suscrito', () => {
    const { result } = renderHook(() => useMotionPreferences());

    expect(result.current).toEqual({ reduced: false, fast: false });

    act(() => {
      setMotionReduced(true);
    });

    expect(result.current).toEqual({ reduced: true, fast: false });
  });
});
