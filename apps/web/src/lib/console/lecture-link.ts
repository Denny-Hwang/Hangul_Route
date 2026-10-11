import { LectureReadyMessageSchema, type LectureRosterMessage } from '@hangul-route/content-schema';

/**
 * Console -> presenter roster hand-off, the console half (F-TCH-004 §3.2 steps 1
 * and 3, TD3). Picker labels never touch a URL: [ Open presenter ] opens the
 * presenter with `window.open(url, '_blank')` (no `noopener`, so the presenter
 * keeps `window.opener`), the presenter posts `ready`, and this tab answers with
 * the `roster` message for the deck that window holds, posted to the exact app
 * origin (never `'*'`). A reload re-announces, so the labels come again while
 * this tab is open. Anything else is ignored silently.
 */

export interface MessageEventLike {
  origin: string;
  source: unknown;
  data: unknown;
}

/** What one opened presenter window holds: its deck, and the roster to answer with (null in numbers mode). */
export interface OpenedDeck {
  deckId: string;
  roster: LectureRosterMessage | null;
}

export interface ReadyContext {
  /** `new URL(APP_URL).origin`. */
  appOrigin: string;
  /** The windows this page opened, each with its deck. */
  opened: ReadonlyMap<unknown, OpenedDeck>;
}

interface PostTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

function canPost(value: unknown): value is PostTarget {
  return typeof value === 'object' && value !== null && typeof (value as { postMessage?: unknown }).postMessage === 'function';
}

export function appOriginOf(appUrl: string): string {
  return new URL(appUrl).origin;
}

/** Answers a presenter's `ready`; true when the roster was posted. */
export function answerReady(event: MessageEventLike, ctx: ReadyContext): boolean {
  if (event.origin !== ctx.appOrigin) return false;
  const entry = ctx.opened.get(event.source);
  if (entry === undefined || entry.roster === null || !canPost(event.source)) return false;
  const parsed = LectureReadyMessageSchema.safeParse(event.data);
  if (!parsed.success || parsed.data.deckId !== entry.deckId) return false;
  event.source.postMessage(entry.roster, ctx.appOrigin);
  return true;
}

export type OpenResult = { ok: true; win: unknown } | { ok: false };

/** Opens the presenter in a new tab from the click; `ok: false` when the browser blocked the pop-up. */
export function openPresenter(host: { open(url: string, target: string): unknown }, url: string): OpenResult {
  const win = host.open(url, '_blank');
  return win === null || win === undefined ? { ok: false } : { ok: true, win };
}
