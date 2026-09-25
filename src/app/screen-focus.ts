import { useEffect, type RefObject } from 'react';

import type { AppState } from './app-state';

export function useScreenFocus(
  screen: AppState['screen'],
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const heading = containerRef.current?.querySelector<HTMLElement>(
      'h1[tabindex="-1"]',
    );
    heading?.focus();
  }, [containerRef, screen]);
}
