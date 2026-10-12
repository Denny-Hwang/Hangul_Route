import { z } from 'zod';
import { EPISODE_ID_RE } from './episode';
import { CARD_ID_RE, StageKeySchema } from './heritage-card';
import { LECTURE_JAMO_ID_RE, LECTURE_REVISIT_CHAR_RE, LECTURE_VOCAB_TOPIC_ID_RE } from './lecture';
import { UiLocaleSchema } from './locale';
import { QUEST_ID_RE } from './quest';
import { StoryIdSchema } from './story';
import type { TelemetryEventName } from './telemetry';

/**
 * All lessons (F-BROWSE-001 §4.3, §4.4, §5.1): the deep-link targets, the URL
 * fragment codec and the pass a grown-up carries into the `/browse` root.
 * Pure and shared by the console (writes links and the account pass) and the
 * learner build (reads them). A link carries content ids only: no learner id,
 * name, alias or summary value can be part of a target, and the pass schemas
 * are strict, so no account id, email, space or learner field can ride along.
 */

/** Longest fragment (after the `#`) the decoder reads. */
export const BROWSE_FRAGMENT_MAX = 256;
/** `sessionStorage` key on the app origin, per tab (§4.3). */
export const BROWSE_PASS_SESSION_KEY = 'hr:browse:pass';
/** A gate pass ends after 15 idle minutes (`PARENT_SESSION_MS`) ... */
export const BROWSE_GATE_IDLE_MS = 15 * 60_000;
/** ... and 60 minutes after it was issued at most. */
export const BROWSE_GATE_MAX_MS = 60 * 60_000;
/** An account pass lives 12 hours in its tab. */
export const BROWSE_ACCOUNT_MAX_MS = 12 * 60 * 60_000;
/** A fallback pass (the scope check failed; sampler only) lives 1 hour. */
export const BROWSE_FALLBACK_MAX_MS = 60 * 60_000;
/** A kept pass (the keep switch, OD-4) lives 7 days on the device. */
export const BROWSE_KEEP_MS = 7 * 24 * 60 * 60_000;

/** The five `browse.*` telemetry names (§9); the browse root's telemetry fence allows only these. */
export const BROWSE_EVENT_NAMES = [
  'browse.opened',
  'browse.item_viewed',
  'browse.preview_started',
  'browse.preview_ended',
  'browse.plans_tapped',
] as const satisfies readonly TelemetryEventName[];
export type BrowseEventName = (typeof BROWSE_EVENT_NAMES)[number];

export const BrowseScopeSchema = z.enum(['full', 'sampler', 'none']);
export type BrowseScope = z.infer<typeof BrowseScopeSchema>;

export const BrowseSourceSchema = z.enum(['nav', 'report', 'route', 'plan', 'roster', 'gate', 'direct']);
export type BrowseSource = z.infer<typeof BrowseSourceSchema>;

/** A deep-link target: a stage key, one content id, or one compatibility jamo character (§4.4). */
export const BrowseTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stage'), stage: StageKeySchema }).strict(),
  z.object({ kind: z.literal('episode'), id: z.string().regex(EPISODE_ID_RE) }).strict(),
  z.object({ kind: z.literal('quest'), id: z.string().regex(QUEST_ID_RE) }).strict(),
  z.object({ kind: z.literal('story'), id: StoryIdSchema }).strict(),
  z.object({ kind: z.literal('vocab-topic'), id: z.string().regex(LECTURE_VOCAB_TOPIC_ID_RE) }).strict(),
  z.object({ kind: z.literal('card'), id: z.string().regex(CARD_ID_RE) }).strict(),
  z.object({ kind: z.literal('jamo'), id: z.string().regex(LECTURE_JAMO_ID_RE) }).strict(),
  /** One compatibility jamo, as `ProgressSummary.needsPractice` holds it. */
  z.object({ kind: z.literal('char'), char: z.string().regex(LECTURE_REVISIT_CHAR_RE) }).strict(),
]);
export type BrowseTarget = z.infer<typeof BrowseTargetSchema>;

const PASS_SCOPE = z.enum(['full', 'sampler']);
const EPOCH_MS = z.number().int().nonnegative();

/** The pass in `sessionStorage[BROWSE_PASS_SESSION_KEY]` (§4.3). Strict: person data cannot ride along. */
export const BrowsePassSchema = z
  .object({
    v: z.literal(1),
    scope: PASS_SCOPE,
    source: z.enum(['account', 'gate']),
    /** ms epoch */
    issuedAt: EPOCH_MS,
    /** Last browse navigation (the gate idle rule). */
    seen: EPOCH_MS,
    /** The account scope check failed: sampler for at most 1 hour, never kept. */
    fallback: z.literal(true).optional(),
    uiLocale: UiLocaleSchema.optional(),
  })
  .strict()
  // `seen` only ever moves forward from `issuedAt`; a pass edited to say otherwise is not a pass.
  // A future `issuedAt` is the resolver's to reject (`passActive`, at most 1 minute ahead, §4.3).
  .refine((p) => p.seen >= p.issuedAt, { message: 'seen must not be before issuedAt', path: ['seen'] });
export type BrowsePass = z.infer<typeof BrowsePassSchema>;

/** IndexedDB `browse:pass`, written only while the keep switch is on (§4.3, §5.3). */
export const BrowseKeptPassSchema = z.object({ v: z.literal(1), scope: PASS_SCOPE, keptAt: EPOCH_MS }).strict();
export type BrowseKeptPass = z.infer<typeof BrowseKeptPassSchema>;

/** `GET /api/entitlements/browse` data (§5.2). */
export const BrowseScopeResponseSchema = z.object({ scope: PASS_SCOPE }).strict();
export type BrowseScopeResponse = z.infer<typeof BrowseScopeResponseSchema>;

export interface BrowseFragment {
  target?: BrowseTarget;
  source: BrowseSource;
}

export type BrowseFragmentFailure = 'empty' | 'bad_target' | 'bad_source' | 'too_long';

export type BrowseFragmentResult =
  | { ok: true; target: BrowseTarget | null; source: BrowseSource }
  | { ok: false; reason: BrowseFragmentFailure };

/** Target kinds written as the content id itself; the id's own prefix names the kind. */
const ID_KINDS: ReadonlySet<string> = new Set(['episode', 'quest', 'story', 'vocab-topic', 'card', 'jamo']);

function targetValue(target: BrowseTarget): string {
  switch (target.kind) {
    case 'stage':
      return `stage:${target.stage}`;
    case 'char':
      return `char:${encodeURIComponent(target.char)}`;
    default:
      return target.id;
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseTarget(value: string): BrowseTarget | null {
  const decoded = safeDecode(value);
  if (decoded === null) return null;
  const colon = decoded.indexOf(':');
  if (colon < 1) return null;
  const prefix = decoded.slice(0, colon);
  const rest = decoded.slice(colon + 1);
  let candidate: unknown = null;
  if (prefix === 'stage') candidate = { kind: 'stage', stage: rest };
  else if (prefix === 'char') candidate = { kind: 'char', char: rest };
  else if (ID_KINDS.has(prefix)) candidate = { kind: prefix, id: decoded };
  const parsed = BrowseTargetSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * `t=<target>&s=<source>`, without the `#`. Total: a target that is not valid
 * (or would push the fragment past `BROWSE_FRAGMENT_MAX`) is left out, so the
 * link opens home, and an unknown source is written as `direct`. A link can
 * therefore never carry anything but a content id. The home fallback is the
 * intended behaviour for every entry (§4.4: a bad link is never a dead end); a
 * caller that must know whether its target survived checks it first with
 * `BrowseTargetSchema.safeParse`.
 */
export function encodeBrowseFragment(f: BrowseFragment): string {
  const sourceParsed = BrowseSourceSchema.safeParse(f.source);
  const sourcePart = `s=${sourceParsed.success ? sourceParsed.data : 'direct'}`;
  if (f.target === undefined) return sourcePart;
  const targetParsed = BrowseTargetSchema.safeParse(f.target);
  if (!targetParsed.success) return sourcePart;
  const full = `t=${targetValue(targetParsed.data)}&${sourcePart}`;
  return full.length > BROWSE_FRAGMENT_MAX ? sourcePart : full;
}

/**
 * Reads a fragment (with or without its `#`). Pure and total: the length is
 * checked first, then each part. `t` is optional (home) and appears once; `s`
 * is required and appears once; any other part is a bad target.
 */
export function decodeBrowseFragment(raw: string): BrowseFragmentResult {
  const body = raw.startsWith('#') ? raw.slice(1) : raw;
  if (body.length > BROWSE_FRAGMENT_MAX) return { ok: false, reason: 'too_long' };
  if (body.trim() === '') return { ok: false, reason: 'empty' };

  let targetRaw: string | undefined;
  let sourceRaw: string | undefined;
  let targetBad = false;
  let sourceBad = false;
  for (const part of body.split('&')) {
    const eq = part.indexOf('=');
    const key = eq < 0 ? part : part.slice(0, eq);
    const value = eq < 0 ? undefined : part.slice(eq + 1);
    if (key === 't' && value !== undefined && targetRaw === undefined) targetRaw = value;
    else if (key === 's' && value !== undefined && sourceRaw === undefined) sourceRaw = value;
    else if (key === 's') sourceBad = true;
    else targetBad = true;
  }

  if (targetBad) return { ok: false, reason: 'bad_target' };
  const target = targetRaw === undefined ? null : parseTarget(targetRaw);
  if (targetRaw !== undefined && target === null) return { ok: false, reason: 'bad_target' };

  if (sourceBad || sourceRaw === undefined) return { ok: false, reason: 'bad_source' };
  const source = BrowseSourceSchema.safeParse(safeDecode(sourceRaw));
  if (!source.success) return { ok: false, reason: 'bad_source' };

  return { ok: true, target, source: source.data };
}

const ORIGIN_RE = /^(https?:\/\/[^/?#\s]+)/i;

/** The origin of `url` without throwing: `URL.origin` where the runtime has it, else the scheme and host. */
function originOf(url: string): string {
  try {
    const origin = new URL(url).origin;
    if (origin !== 'null') return origin;
  } catch {
    // Not a URL, or a runtime whose `URL` has no `origin` getter (React Native): read it by hand.
  }
  return ORIGIN_RE.exec(url)?.[1] ?? '';
}

/**
 * `${origin}/browse#…`: only the origin of the given URL is kept (a path, query
 * or hash is dropped). Total: a value with no http(s) origin gives the
 * same-origin path `/browse#…`.
 */
export function buildBrowseUrl(origin: string, f: BrowseFragment): string {
  return `${originOf(origin)}/browse#${encodeBrowseFragment(f)}`;
}
