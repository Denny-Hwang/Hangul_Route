import {
  LECTURE_CONSOLE_ORIGINS,
  LECTURE_MESSAGE_NS,
  LectureRosterMessageSchema,
  type LectureDeck,
  type LectureReadyMessage,
} from '@hangul-route/content-schema';

/**
 * Console -> presenter roster hand-off, the pure half (F-TCH-004 §3.2 steps
 * 2 and 4, TD3). Picker labels never touch a URL: the presenter tells the
 * console tab that opened it (`window.opener`) that it is ready, and the
 * console answers with a `roster` message. The platform layer
 * (`platform/presenter.web.ts`, PR 6) posts and listens; this module decides
 * where to post and which message to believe.
 *
 * A roster is believed only when it comes from the opener window, from an
 * allowed console origin, parses with the strict schema, and matches the
 * open deck's id, picker mode and count. Anything else is ignored silently:
 * no error, no log of the payload.
 */

type DeckPick = Pick<LectureDeck, 'id' | 'picker'>;

export interface MessageEventLike {
  origin: string;
  source: unknown;
  data: unknown;
}

export interface RosterContext {
  /** `window.opener` (null for a copied, typed, bookmarked or resumed link). */
  opener: unknown;
  allowedOrigins: readonly string[];
  deck: DeckPick;
}

export interface AcceptedRoster {
  mode: 'names' | 'initials';
  labels: readonly string[];
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Host names a browser can report as `event.origin`: letters, digits, dots and hyphens (no `*` pattern, which would never match). */
const HOSTNAME = /^[a-z0-9.-]+$/;

/** A bare origin: https anywhere, http only on this machine; no path, query, credentials or wildcard. */
function bareOrigin(candidate: string): string | null {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.origin !== candidate || !HOSTNAME.test(url.hostname)) return null;
  return url.origin;
}

/**
 * The shared console origins plus the build-time preview list
 * (`EXPO_PUBLIC_CONSOLE_ORIGINS`, comma separated), deduplicated.
 */
export function consoleOrigins(extraCsv?: string | null): readonly string[] {
  const out: string[] = [...LECTURE_CONSOLE_ORIGINS];
  for (const raw of (extraCsv ?? '').split(',')) {
    const origin = bareOrigin(raw.trim());
    if (origin !== null && !out.includes(origin)) out.push(origin);
  }
  return out;
}

/** The deck asks for names or initials, which only a console tab can send. */
export function wantsRoster(deck: DeckPick): boolean {
  return deck.picker !== null && deck.picker.mode !== 'numbers';
}

/** Presenter -> opener; carries the deck id and nothing about a person. */
export function readyMessage(deckId: string): LectureReadyMessage {
  return { ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId };
}

/**
 * The origins to post `ready` to, one message each (a non-matching
 * targetOrigin delivers nothing). Empty without an opener or a names /
 * initials deck.
 */
export function readyTargets(deck: DeckPick, opener: unknown, origins: readonly string[]): readonly string[] {
  if (opener === null || opener === undefined || !wantsRoster(deck)) return [];
  return origins.filter((o) => o !== '*');
}

export function acceptRoster(event: MessageEventLike, ctx: RosterContext): AcceptedRoster | null {
  const { opener, allowedOrigins, deck } = ctx;
  if (opener === null || opener === undefined || event.source !== opener) return null;
  if (!allowedOrigins.includes(event.origin)) return null;
  if (deck.picker === null || deck.picker.mode === 'numbers') return null;
  const parsed = LectureRosterMessageSchema.safeParse(event.data);
  if (!parsed.success) return null;
  const message = parsed.data;
  if (message.deckId !== deck.id || message.mode !== deck.picker.mode) return null;
  if (message.labels.length !== deck.picker.count) return null;
  return { mode: message.mode, labels: message.labels };
}
