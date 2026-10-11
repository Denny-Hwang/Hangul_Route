import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { layoutClassFor, scaleMedia, type LayoutClass } from '../../layout';

const LayoutContext = createContext<LayoutClass | null>(null);

export interface LayoutProviderProps {
  value: LayoutClass;
  children: React.ReactNode;
}

/**
 * Overrides the layout class for a subtree: a detail pane 600 wide is `regular`
 * with `panes: 1`, not `wide`, so nested screens do not try to split again.
 * Also lets `/design-preview` and tests force a class (F-LAYOUT-001 §3.2).
 */
export function LayoutProvider({ value, children }: LayoutProviderProps): React.ReactElement {
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

/**
 * The layout class for this subtree: the nearest `LayoutProvider`, else the
 * window size (react-native-web updates `useWindowDimensions` on resize and
 * rotation). Screens never read `useWindowDimensions` directly (§3.12).
 */
export function useLayoutClass(): LayoutClass {
  const forced = useContext(LayoutContext);
  const { width, height } = useWindowDimensions();
  const fromWindow = useMemo(() => layoutClassFor({ width, height }), [width, height]);
  return forced ?? fromWindow;
}

/** `Math.round(base * mediaScale)`: the only way a component scales a size. */
export function useMediaSize(base: number): number {
  return scaleMedia(base, useLayoutClass().mediaScale);
}
