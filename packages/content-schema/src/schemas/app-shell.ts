import { z } from 'zod';
import { JOIN_CODE_RE, type SpaceKind, type SpaceRole } from './space';

/**
 * Persona app shell on app.hangulroute.com (F-APP-001 section 3.14). One
 * place for the route map, the grown-up path rules, persona derivation and
 * the small hand-off records that the learner app and the console exchange
 * on the same origin. Pure: no storage, no DOM. Every reader of a hand-off
 * record is lenient (invalid or corrupt means absent).
 */

export const APP_ORIGIN = 'https://app.hangulroute.com';
export const SITE_ORIGIN = 'https://hangulroute.com';

export const PersonaSchema = z.enum(['learner', 'parent', 'teacher']);
export type Persona = z.infer<typeof PersonaSchema>;

/** `parent` is shown as "Family" in every label (OD-14). */
export const AdultPersonaSchema = z.enum(['parent', 'teacher']);
export type AdultPersona = z.infer<typeof AdultPersonaSchema>;

/**
 * Grown-up path prefixes on the app host (section 3.2, R-1). `/billing` is
 * deliberately absent: billing lives under `/account`. A new prefix needs an
 * amendment of section 3.2 (R-3).
 */
export const GROWN_UP_PREFIXES = ['/signin', '/start', '/teach', '/parent', '/account'] as const;
export type GrownUpPrefix = (typeof GROWN_UP_PREFIXES)[number];

/** Extra roots of the learner bundle (F-TCH-004, F-BROWSE-001); never denied by the service worker. */
export const LEARNER_ROOTS = ['/present', '/browse'] as const;

export const APP_ROUTES = {
  signIn: '/signin',
  start: '/start',
  parentHome: '/parent',
  teacherIndex: '/teach',
  teacherHome: '/teach/home',
  billing: '/account/billing',
  learn: '/',
} as const;

const PERSONA_HOME: Readonly<Record<AdultPersona, string>> = {
  parent: APP_ROUTES.parentHome,
  teacher: APP_ROUTES.teacherHome,
};

/** A prefix matches when it is followed by end of path, `/`, `?` or `.` (so `/teach.html` matches, `/teacher` does not). */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) return false;
  const next = pathname.charAt(prefix.length);
  return next === '' || next === '/' || next === '?' || next === '.';
}

/** The only implementation of R-1. Case-sensitive; accepts a path with or without its query. */
export function isGrownUpPath(pathname: string): boolean {
  return GROWN_UP_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isLearnerRoot(pathname: string): boolean {
  return LEARNER_ROOTS.some((root) => matchesPrefix(pathname, root));
}

export const NEXT_PATH_MAX = 512;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const DOT_DOT_SEGMENTS: ReadonlySet<string> = new Set(['..', '.%2e', '%2e.', '%2e%2e']);

/**
 * `?next=` guard (section 3.11). Expects the value read with
 * `URLSearchParams.get('next')`, which is already decoded: a value that
 * starts with `/` is taken as is, so escapes such as `%3A`, `%26` or `%25`
 * inside a deep link's query survive. Any other value is percent-decoded
 * once (a caller that passed the raw query value). Accepts only a relative
 * grown-up path: starts with a single `/`, no backslash, no control
 * character, no `..` segment (plain or percent-encoded, any case), at most
 * 512 characters. Returns path and query without the fragment; anything
 * else is `null` (the caller then uses the persona home).
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw === '' || raw.length > NEXT_PATH_MAX * 3) return null;
  let decoded = raw;
  if (!raw.startsWith('/')) {
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  if (decoded.length > NEXT_PATH_MAX) return null;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  if (decoded.includes('\\') || CONTROL_CHARS.test(decoded)) return null;
  const hash = decoded.indexOf('#');
  const value = hash === -1 ? decoded : decoded.slice(0, hash);
  const query = value.indexOf('?');
  const path = query === -1 ? value : value.slice(0, query);
  if (path.split('/').some((segment) => DOT_DOT_SEGMENTS.has(segment.toLowerCase()))) return null;
  return isGrownUpPath(value) ? value : null;
}

const LEGACY_APP_TARGETS: ReadonlyMap<string, string> = new Map([
  ['/teach/start', APP_ROUTES.start],
  ['/teach/billing', APP_ROUTES.billing],
]);

/** App-host legacy pages (sections 3.7, 3.8): the redirect target, or `null`. The caller keeps the query. */
export function legacyAppTarget(pathname: string): string | null {
  const bare = pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return LEGACY_APP_TARGETS.get(bare) ?? null;
}

/** Reads `?persona=`, then its alias `?as=` (F-SITE-002); unknown values are ignored. */
export function personaHint(params: { get(name: string): string | null }): AdultPersona | null {
  for (const key of ['persona', 'as']) {
    const parsed = AdultPersonaSchema.safeParse(params.get(key));
    if (parsed.success) return parsed.data;
  }
  return null;
}

const PARENT_ROLES: ReadonlySet<SpaceRole> = new Set(['owner', 'caregiver']);
const TEACHER_ROLES: Readonly<Record<'class' | 'school', ReadonlySet<SpaceRole>>> = {
  class: new Set(['owner', 'teacher']),
  school: new Set(['owner', 'admin', 'teacher']),
};

/**
 * Adult personas from memberships (section 3.5), never from a self-declared
 * flag. Archived spaces count; `student` never maps to a persona; a kind
 * this bundle does not know is ignored. Order: `parent`, then `teacher`.
 */
export function personasFor(memberships: readonly { kind: SpaceKind; role: SpaceRole }[]): AdultPersona[] {
  let parent = false;
  let teacher = false;
  for (const { kind, role } of memberships) {
    if (kind === 'family') parent = parent || PARENT_ROLES.has(role);
    else if (kind === 'class' || kind === 'school') teacher = teacher || TEACHER_ROLES[kind].has(role);
  }
  const out: AdultPersona[] = [];
  if (parent) out.push('parent');
  if (teacher) out.push('teacher');
  return out;
}

/**
 * Persona home (section 3.5): no persona → `/start` (hint kept); a hint →
 * that home even when not held (the home shows its "not set up yet" state);
 * the last persona while still held; the only persona; else Family (OD-11).
 */
export function homeFor(input: {
  personas: readonly AdultPersona[];
  last?: AdultPersona | null;
  hint?: AdultPersona | null;
}): string {
  const { personas, last, hint } = input;
  if (personas.length === 0) return hint ? `${APP_ROUTES.start}?persona=${hint}` : APP_ROUTES.start;
  if (hint) return PERSONA_HOME[hint];
  if (last && personas.includes(last)) return PERSONA_HOME[last];
  if (personas.length === 1) return PERSONA_HOME[personas[0] as AdultPersona];
  return PERSONA_HOME.parent;
}

const Time = z.number().finite().nonnegative();

/** `hr:device:gate`, written by the learner app (section 3.9). Holds no name, count or profile data. */
export const DeviceGateMarkerSchema = z.discriminatedUnion('gate', [
  z.object({ v: z.literal(1), gate: z.literal('pin'), pinEpoch: Time }),
  z.object({ v: z.literal(1), gate: z.literal('nopin') }),
  z.object({ v: z.literal(1), gate: z.literal('none') }),
]);
export type DeviceGateMarker = z.infer<typeof DeviceGateMarkerSchema>;

/** `sessionStorage` `hr:grownup:unlock`; `pinEpoch` only on a PIN unlock (copied from the marker). */
export const GrownUpUnlockSchema = z.discriminatedUnion('src', [
  z.object({ v: z.literal(1), at: Time, seen: Time, src: z.literal('pin'), pinEpoch: Time }),
  z.object({ v: z.literal(1), at: Time, seen: Time, src: z.literal('signin') }),
]);
export type GrownUpUnlock = z.infer<typeof GrownUpUnlockSchema>;

/** Shell store `lastPersona` (section 3.5). */
export const LastPersonaSchema = z.object({ v: z.literal(1), persona: AdultPersonaSchema });
export type LastPersona = z.infer<typeof LastPersonaSchema>;

/** `sessionStorage` `hr:shell:joinCode`: a join code and a time, no name and no space id (section 3.8). */
export const JoinHandoffSchema = z.object({ v: z.literal(1), code: z.string().regex(JOIN_CODE_RE), at: Time });
export type JoinHandoff = z.infer<typeof JoinHandoffSchema>;

/** Lenient read of a stored record: a JSON string or a value; invalid or corrupt means absent (`null`). */
export function parseLenient<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Idle window of a grown-up unlock: the learner gate's 15-minute session. */
export const GROWN_UP_IDLE_MS = 15 * 60_000;
/** A PIN entered this recently counts for the hand-off without asking again. */
export const GROWN_UP_FRESH_PIN_MS = 2 * 60_000;
/** How long a join-code hand-off waits for the Join screen. */
export const JOIN_HANDOFF_MS = 30 * 60_000;

/** Active while `now - seen` is in `[0, GROWN_UP_IDLE_MS)`; a clock that runs backwards is not active. */
export function unlockActive(record: GrownUpUnlock | null | undefined, now: number): boolean {
  if (!record) return false;
  const idle = now - record.seen;
  return idle >= 0 && idle < GROWN_UP_IDLE_MS;
}

/**
 * Payload codes of the `shell.*` telemetry events (section 3.18), per event:
 * the only keys and values each one carries, and never a profile id. The
 * Worker keeps nothing else.
 */
export const SHELL_TELEMETRY_PREFIX = 'shell.';
export const SHELL_TELEMETRY_PAYLOADS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  'shell.persona_chosen': { persona: PersonaSchema.options, from: ['welcome', 'welcome-continue'] },
  'shell.grown_up_handoff': { via: ['profile', 'dashboard', 'plan', 'lock'], target: ['router', 'billing', 'next'] },
  'shell.path_bounced': { prefix: GROWN_UP_PREFIXES.map((prefix) => prefix.slice(1)) },
};

/** Learner storage key, stored as `hr:device:gate` by `platform/storage`. */
export const DEVICE_GATE_KEY = 'device:gate';
/** Learner storage key: epoch ms of the current PIN (absent for a PIN set before A-6, read as `0`). */
export const PIN_SET_AT_KEY = 'account:pinSetAt';
/** Shell store: its own IndexedDB database, outside the learner `hr:` namespace. */
export const SHELL_DB = 'hr-shell';
export const SHELL_STORE = 'kv';
export const SHELL_KEYS = { lastPersona: 'lastPersona', pinEpoch: 'pinEpoch' } as const;
export const UNLOCK_SESSION_KEY = 'hr:grownup:unlock';
/** The console's existing session key, named once. */
export const CONSOLE_SESSION_KEY = 'hr:console:session';
export const JOIN_HANDOFF_KEY = 'hr:shell:joinCode';
