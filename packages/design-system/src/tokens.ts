/**
 * Design tokens placeholder.
 * Real values land once the Claude Design pass (Week 1) is complete.
 * Consumers MUST import from `@hangul-route/design-system/tokens` — never hardcode.
 */

export const colors = {} as const;

export const spacing = {} as const;

export const typography = {} as const;

export const radii = {} as const;

export const shadows = {} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radii,
  shadows,
} as const;

export type Tokens = typeof tokens;
