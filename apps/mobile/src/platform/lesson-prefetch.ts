/**
 * Background load of every lesson chunk (F-CURR-002 §10): native no-op. A native build keeps every
 * chunk in its one bundle, so a lesson opens from it at once, with or without a network.
 */
export function prefetchWhenIdle(_load: () => Promise<void>): () => void {
  return () => {};
}
