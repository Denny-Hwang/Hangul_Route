import { createContext, type ComponentType } from 'react';
import type { ScreenHeaderOptions } from './types';

/**
 * Where a surface plugs its route-aware header into every `Screen` (AMENDMENTS-DISPLAY-NAV section
 * 7.1). The learner app and All lessons provide a component that reads the route it is drawn in
 * (its leading control from the route table, `canGoBack`, `goBack`, the Display sheet) and draws
 * `ScreenHeader`; `Screen` renders it at the top of its content with the screen's own options. So
 * every state of every screen (loading, empty, an error) carries the same way back, and a screen
 * cannot leave it out. With no provider (tests, the presenter) nothing is drawn.
 */
export const ScreenHeaderSlotContext = createContext<ComponentType<ScreenHeaderSlotProps> | null>(null);

/** What `Screen` hands the slot: the screen's options, `undefined` when the screen passed none (a root then draws no header). */
export interface ScreenHeaderSlotProps {
  options?: ScreenHeaderOptions;
}
