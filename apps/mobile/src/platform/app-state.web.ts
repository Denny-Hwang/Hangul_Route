/**
 * Whether the page is in front of the learner, for the Speed Round's one
 * session clock (F-VOC-004 §3.8), on the web: `visibilitychange` to hidden
 * (the PWA sent to the background, another tab or app in front) is not
 * active and back to visible is active again. Same surface as
 * `app-state.ts`; `source` is injectable for tests (the global `document`
 * by default; none, as in a server render, is a no-op). Returns the
 * unsubscribe.
 */

export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function subscribeAppActive(
  listener: (active: boolean) => void,
  source: VisibilitySource | undefined = (globalThis as { document?: VisibilitySource }).document,
): () => void {
  if (source === undefined) return () => undefined;
  const onChange = (): void => listener(source.visibilityState !== 'hidden');
  source.addEventListener('visibilitychange', onChange);
  return () => source.removeEventListener('visibilitychange', onChange);
}
