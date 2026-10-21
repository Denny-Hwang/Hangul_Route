/**
 * Give up a lesson chunk's pending load after its timeout (F-CURR-002 §10): native no-op. A native build
 * keeps every lesson chunk in its one bundle, so no load is ever left pending on the network.
 */
export function abandonPendingChunk(_bundleName?: string): number {
  return 0;
}
