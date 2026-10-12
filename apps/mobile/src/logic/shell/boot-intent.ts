import { safeNextPath } from '@hangul-route/content-schema';
import { grownUpPinParams } from './handoff-rules';

/**
 * Boot intents of the learner app (F-APP-001 sections 3.9 and 3.11). Pure: the root reads the
 * address once before `App` mounts (`platform/app-root.web.ts`), takes the intent, and writes
 * back the query this returns with `history.replaceState`, so a reload or a shared address never
 * repeats it.
 *
 * `gate=grown-up&next=<path>` is the grown-up lock's "Use the grown-up PIN" (A-4a `pinPathUrl`):
 * it opens the PIN screen for the grown-up area over the start screen and then returns to `next`.
 * `next` must pass `safeNextPath` (a grown-up path on this origin, section 3.11); anything else is
 * no intent, and both keys still leave the address. Every other key stays where it was, `lang`
 * included (the locale hand-off, `platform/locale.web.ts`, reads it later). An unknown `gate`
 * value is not an intent and is left alone (F-BROWSE-001 BR-12b adds `gate=browse` here).
 */
export interface GrownUpBootIntent {
  kind: 'grown-up';
  /** The grown-up page to open after the PIN: path and query, no fragment. */
  next: string;
}

export type BootIntent = GrownUpBootIntent;

export interface ParsedBootIntent {
  intent: BootIntent | null;
  /** The query to keep (`''` or `?…`): the input itself when nothing was read. */
  search: string;
  /** Whether the address must be rewritten. */
  changed: boolean;
}

const GATE = 'gate';
const NEXT = 'next';
const GROWN_UP_GATE = 'grown-up';

export function parseBootIntent(search: string): ParsedBootIntent {
  const params = new URLSearchParams(search);
  if (params.get(GATE) !== GROWN_UP_GATE) return { intent: null, search, changed: false };
  const next = safeNextPath(params.get(NEXT));
  params.delete(GATE);
  params.delete(NEXT);
  const rest = params.toString();
  return {
    intent: next === null ? null : { kind: 'grown-up', next },
    search: rest === '' ? '' : `?${rest}`,
    changed: true,
  };
}

/** What `openBootIntentWhenReady` needs of the navigation container (a subset of its ref). */
export interface BootIntentNavigator {
  isReady: () => boolean;
  navigate: (screen: 'PinEntry', params: ReturnType<typeof grownUpPinParams>) => void;
  addListener: (event: 'state', listener: () => void) => () => void;
}

export interface BootIntentSource {
  peek: () => BootIntent | null;
  consume: () => void;
}

/**
 * Opens the PIN screen for the intent the root read, exactly once (`navigation/boot-intent.tsx`):
 * at once when the navigator is ready, else on its first state change once it is, and then it
 * stops listening. Nothing happens when there is no intent, or when it was already taken (an
 * ErrorBoundary remount). Returns the cleanup for the effect.
 */
export function openBootIntentWhenReady(nav: BootIntentNavigator, source: BootIntentSource): () => void {
  const open = (): boolean => {
    const intent = source.peek();
    if (intent === null) return true;
    if (!nav.isReady()) return false;
    source.consume();
    nav.navigate('PinEntry', grownUpPinParams({ via: 'lock', target: intent.next }));
    return true;
  };
  if (open()) return () => undefined;
  let off: (() => void) | null = null;
  off = nav.addListener('state', () => {
    if (open() && off !== null) {
      off();
      off = null;
    }
  });
  return () => {
    off?.();
    off = null;
  };
}
