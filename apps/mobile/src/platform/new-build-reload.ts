/**
 * Reload the page for a newer build (F-CURR-002 §10, the lesson chunks): native no-op. A native build
 * keeps every lesson chunk in its one bundle, so it never runs an older build than its chunks.
 */
export function reloadForNewBuild(): boolean {
  return false;
}

/** Native: a lesson chunk never comes from the network, so a failed one never means a newer build. */
export async function isNewBuildAnswer(_error?: unknown): Promise<boolean> {
  return false;
}
