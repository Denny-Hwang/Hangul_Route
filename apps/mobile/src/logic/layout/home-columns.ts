import type { LayoutClass } from '@hangul-route/design-system/layout';

/**
 * Home columns (F-LAYOUT-001 §3.6, wireframe layout/wide B): two columns (today's missions left,
 * stage progress, homework, tip and recent stars right) on regular and wide windows; one column,
 * exactly as before, on a phone and on any short window (a landscape phone scrolls one column).
 */
export function homeColumns(lc: Pick<LayoutClass, 'width' | 'short'>): 1 | 2 {
  return lc.width !== 'compact' && !lc.short ? 2 : 1;
}
