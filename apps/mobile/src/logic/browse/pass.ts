import {
  BROWSE_ACCOUNT_MAX_MS,
  BROWSE_FALLBACK_MAX_MS,
  BROWSE_GATE_IDLE_MS,
  BROWSE_GATE_MAX_MS,
  BROWSE_KEEP_MS,
  type AdultPersona,
  type BrowseKeptPass,
  type BrowsePass,
  type UiLocale,
} from '@hangul-route/content-schema';

/**
 * The browse pass rules (F-BROWSE-001 section 4.3). Pure, with an injected
 * clock: which pass is active, when `seen` is refreshed, which passes may be
 * kept on the device, and where the Access screen sends its viewer. Reading
 * and writing the pass is `platform/browse(.web).ts` and the keep switch.
 */

/** How far in the future an `issuedAt` may be (clock skew between the console and this tab). */
export const PASS_FUTURE_SKEW_MS = 60_000;
/** Browse refreshes `seen` on navigation at most once a minute (the F-APP-001 unlock rule). */
export const BROWSE_SEEN_REFRESH_MS = 60_000;

export function passActive(pass: BrowsePass, now: number): boolean {
  if (pass.issuedAt - now > PASS_FUTURE_SKEW_MS) return false;
  if (pass.source === 'gate') return now - pass.seen < BROWSE_GATE_IDLE_MS && now - pass.issuedAt < BROWSE_GATE_MAX_MS;
  return now - pass.issuedAt < (pass.fallback ? BROWSE_FALLBACK_MAX_MS : BROWSE_ACCOUNT_MAX_MS);
}

/** The pass with `seen` moved to `now`, or `null` when nothing needs writing (less than a minute, or no longer active). */
export function refreshSeen(pass: BrowsePass, now: number): BrowsePass | null {
  if (!passActive(pass, now) || now - pass.seen < BROWSE_SEEN_REFRESH_MS) return null;
  return { ...pass, seen: now };
}

/** Only an account pass that is not a fallback may be kept (a gate pass never offers the switch). */
export function canKeep(pass: BrowsePass): boolean {
  return pass.source === 'account' && pass.fallback !== true;
}

/** What the keep switch writes to `browse:pass`, or `null` when this pass may not be kept. */
export function keptPassFor(pass: BrowsePass, now: number): BrowseKeptPass | null {
  return canKeep(pass) ? { v: 1, scope: pass.scope, keptAt: now } : null;
}

export function keptPassActive(kept: BrowseKeptPass, now: number): boolean {
  return kept.keptAt - now <= PASS_FUTURE_SKEW_MS && now - kept.keptAt < BROWSE_KEEP_MS;
}

export type PassFrom = 'account' | 'gate' | 'kept';

export type ResolvedPass =
  | { status: 'active'; scope: BrowseKeptPass['scope']; from: PassFrom; fallback: boolean; uiLocale?: UiLocale; removeSession: boolean; removeKept: boolean }
  | { status: 'none'; reason: 'none' | 'expired'; expiredSource: BrowsePass['source'] | null; removeSession: boolean; removeKept: boolean };

/**
 * The pass Browse runs with. An active session pass decides (the kept pass is
 * not read). Without one, an active kept pass counts as an account pass from
 * `kept`, and an expired session pass it replaces is removed: a tab restored
 * after its pass ran out gets in exactly as a new tab would (OD-4, kept 7
 * days, also offline). Otherwise an expired session pass keeps its source for
 * the Access screen. An expired kept pass is removed on read.
 */
export function resolvePass(i: { session: BrowsePass | null; kept: BrowseKeptPass | null; now: number }): ResolvedPass {
  const { session, kept, now } = i;
  if (session && passActive(session, now)) {
    return {
      status: 'active',
      scope: session.scope,
      from: session.source,
      fallback: session.fallback === true,
      ...(session.uiLocale ? { uiLocale: session.uiLocale } : {}),
      removeSession: false,
      removeKept: false,
    };
  }
  if (kept && keptPassActive(kept, now)) {
    return { status: 'active', scope: kept.scope, from: 'kept', fallback: false, removeSession: session !== null, removeKept: false };
  }
  const removeKept = kept !== null;
  if (session) return { status: 'none', reason: 'expired', expiredSource: session.source, removeSession: false, removeKept };
  if (kept) return { status: 'none', reason: 'expired', expiredSource: 'account', removeSession: false, removeKept };
  return { status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false };
}

export type AccessSource = 'account' | 'gate' | 'unknown';

/**
 * Which way back the Access screen offers: the expired pass's source, else
 * `account` when the last grown-up persona is known (read allow-listed by the
 * caller), else `unknown`.
 */
export function accessSource(i: { expiredSource: BrowsePass['source'] | null; lastPersona: AdultPersona | null }): AccessSource {
  if (i.expiredSource) return i.expiredSource;
  return i.lastPersona ? 'account' : 'unknown';
}
