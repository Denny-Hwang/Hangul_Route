import { z } from 'zod';
import { ONBOARDING_TELEMETRY_PAYLOADS } from './onboarding-telemetry';
import { ProfileSchema } from './profile';
import { JOIN_CODE_RE, normalizeJoinCode, type SpaceKind, type SpaceRole } from './space';
import type { TelemetryEventName } from './telemetry';

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
  /** [SA] AMENDMENTS-SEATS-ADMINS section 6.6: the administrator invite page (`ADMIN_INVITE_PATH`). */
  adminInvite: '/account/invite',
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

/**
 * The class join link (owner decision 2026-10-17): `https://app.hangulroute.com/join#c=<code>`. The code rides only in
 * the address fragment, which a browser never sends to a server, and the link never holds a learner's name. The
 * learner app reads it once at boot, takes it out of the address and opens Join a class with the code filled in;
 * every F-SPACE-001 step after that is unchanged. `/join` is a path of the learner app, never a grown-up path.
 */
export const JOIN_LINK_PATH = '/join';
/** The fragment key of the join link's code. */
export const JOIN_LINK_CODE_KEY = 'c';

/** The join link of a join code on an app origin (`https://app.hangulroute.com`); null when it is not a join code. */
export function joinLinkUrl(origin: string, code: string): string | null {
  const normalized = normalizeJoinCode(code);
  if (normalized === null) return null;
  return `${origin.replace(/\/+$/, '')}${JOIN_LINK_PATH}#${JOIN_LINK_CODE_KEY}=${normalized}`;
}

/**
 * Reads the address the learner app opened on: null when the path is not the join link's (`/join`, with or without
 * a trailing slash or `.html`); else `{ code }`, the fragment's join code upper-cased, or `null` when the fragment
 * holds none that is valid (the Join screen then opens empty). Anything else in the fragment is ignored.
 */
export function parseJoinLink(location: { pathname: string; hash: string }): { code: string | null } | null {
  const path = location.pathname;
  if (path !== JOIN_LINK_PATH && path !== `${JOIN_LINK_PATH}/` && path !== `${JOIN_LINK_PATH}.html`) return null;
  const fragment = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  // URLSearchParams never throws: a broken escape stays as typed and fails the code check.
  const raw = new URLSearchParams(fragment).get(JOIN_LINK_CODE_KEY);
  return { code: raw === null ? null : normalizeJoinCode(raw) };
}

/**
 * [SA] The school administrator invite link (AMENDMENTS-SEATS-ADMINS section 6.3):
 * `https://app.hangulroute.com/account/invite#t=<token>`. The token is 32 random bytes in base64url (43 characters,
 * no padding) and rides only in the address fragment, which a browser never sends to a server or in a `Referer`.
 * Nothing else is in the link: no school name, no email, no id. The Worker stores only the token's SHA-256 hash.
 */
export const ADMIN_INVITE_PATH = '/account/invite';
/** The fragment key of the invite token. */
export const ADMIN_INVITE_TOKEN_KEY = 't';
/** 43 base64url characters: 32 bytes with no padding. */
export const ADMIN_INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The invite link of a token on an app origin; null when it is not an invite token. */
export function adminInviteUrl(appUrl: string, token: string): string | null {
  if (!ADMIN_INVITE_TOKEN_RE.test(token)) return null;
  return `${appUrl.replace(/\/+$/, '')}${ADMIN_INVITE_PATH}#${ADMIN_INVITE_TOKEN_KEY}=${token}`;
}

/** The token of an invite link's fragment (`#t=<token>`, the `#` optional), or null when it holds none that is valid. */
export function parseAdminInvite(hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  // URLSearchParams never throws; a token holds no character it would decode.
  const raw = new URLSearchParams(fragment).get(ADMIN_INVITE_TOKEN_KEY);
  return raw !== null && ADMIN_INVITE_TOKEN_RE.test(raw) ? raw : null;
}

/** POST /api/admin-invites/preview and /accept body: the token travels only here, never in a path or a query. */
export const AdminInviteBodySchema = z.object({ token: z.string().regex(ADMIN_INVITE_TOKEN_RE) });
export type AdminInviteBody = z.infer<typeof AdminInviteBodySchema>;

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
/** `shell.grown_up_handoff` `via`: the entry that asked for the PIN; [OA] section 13.4 appends `chooser`. */
export const GROWN_UP_HANDOFF_VIAS = ['profile', 'dashboard', 'plan', 'lock', 'chooser'] as const;
/** `shell.grown_up_handoff` `target`. */
export const GROWN_UP_HANDOFF_TARGETS = ['router', 'billing', 'next'] as const;
export const SHELL_TELEMETRY_PAYLOADS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  'shell.persona_chosen': { persona: PersonaSchema.options, from: ['welcome', 'welcome-continue'] },
  'shell.grown_up_handoff': { via: GROWN_UP_HANDOFF_VIAS, target: GROWN_UP_HANDOFF_TARGETS },
  'shell.path_bounced': { prefix: GROWN_UP_PREFIXES.map((prefix) => prefix.slice(1)) },
};

/** Learner storage key, stored as `hr:device:gate` by `platform/storage`. */
export const DEVICE_GATE_KEY = 'device:gate';
/** Learner storage key: epoch ms of the current PIN (absent for a PIN set before A-6, read as `0`). */
export const PIN_SET_AT_KEY = 'account:pinSetAt';
/** Shell store: its own IndexedDB database, outside the learner `hr:` namespace. */
export const SHELL_DB = 'hr-shell';
export const SHELL_STORE = 'kv';
export const SHELL_KEYS = {
  lastPersona: 'lastPersona',
  pinEpoch: 'pinEpoch',
  /** [OA] section 7.1: `DeviceUsesSchema`, written by the adult frame, read by the learner app (web). */
  deviceUses: 'deviceUses',
  /** [OA] section 7.2: `PinOwnerSchema`, local only, never sent. */
  pinOwner: 'pinOwner',
  /** [OA] section 7.6: `true` once the set-a-PIN card was shown on a `nopin` browser. */
  pinPromptSeen: 'pinPromptSeen',
} as const;
export const UNLOCK_SESSION_KEY = 'hr:grownup:unlock';
/** The console's existing session key, named once. */
export const CONSOLE_SESSION_KEY = 'hr:console:session';
export const JOIN_HANDOFF_KEY = 'hr:shell:joinCode';


// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-1) ----

/** [OA] Section 5.2: a grown-up use of the signed-in account. The device's own Grown-up area (`area`) is not one. */
export const GrownUpUseSchema = z.enum(['family', 'teacher', 'school']);
export type GrownUpUse = z.infer<typeof GrownUpUseSchema>;

const FAMILY_USE_ROLES: ReadonlySet<SpaceRole> = new Set(['owner', 'caregiver']);
const CLASS_TEACHER_ROLES: ReadonlySet<SpaceRole> = new Set(['owner', 'teacher']);
const SCHOOL_USE_ROLES: ReadonlySet<SpaceRole> = new Set(['owner', 'admin']);

/**
 * [OA] Grown-up uses of an account, in this fixed order: family, teacher, school (section 5.2). `family` for a
 * family owner or caregiver; `teacher` for a class owner or teacher, or a school teacher; `school` for a school
 * owner or admin. Archived spaces count, `student` rows are ignored, and a kind this bundle does not know is
 * skipped. `family` holds exactly when `personasFor` holds `parent`, `teacher` or `school` exactly when it holds
 * `teacher`.
 */
export function usesFor(memberships: readonly { kind: SpaceKind; role: SpaceRole }[]): GrownUpUse[] {
  let family = false;
  let teacher = false;
  let school = false;
  for (const { kind, role } of memberships) {
    if (kind === 'family') family = family || FAMILY_USE_ROLES.has(role);
    else if (kind === 'class') teacher = teacher || CLASS_TEACHER_ROLES.has(role);
    else if (kind === 'school') {
      teacher = teacher || role === 'teacher';
      school = school || SCHOOL_USE_ROLES.has(role);
    }
  }
  return GrownUpUseSchema.options.filter((use) => (use === 'family' ? family : use === 'teacher' ? teacher : school));
}

const noRepeats = (values: readonly string[]): boolean => new Set(values).size === values.length;

/**
 * [OA] Section 7.1: shell store `deviceUses`, the account's uses known on this device and when they were seen.
 * Holds no name, email, account id or space id (unknown keys are stripped).
 */
export const DeviceUsesSchema = z.object({
  v: z.literal(1),
  uses: z.array(GrownUpUseSchema).max(GrownUpUseSchema.options.length).refine(noRepeats),
  at: Time,
});
export type DeviceUses = z.infer<typeof DeviceUsesSchema>;

/** A PIN epoch that names a real PIN (the marker's `pinEpoch`; `0`, a PIN set before A-6, never qualifies). */
const PinEpoch = z.number().finite().positive();

/**
 * [OA] Section 7.2: shell store `pinOwner`. `owner` is the first 16 hex digits of SHA-256 of the Clerk user id;
 * `epoch` is the marker's `pinEpoch` it was recorded for. Local only, never sent.
 */
export const PinOwnerSchema = z.object({ v: z.literal(1), owner: z.string().regex(/^[0-9a-f]{16}$/), epoch: PinEpoch });
export type PinOwner = z.infer<typeof PinOwnerSchema>;

/** [OA] Section 8.5: `sessionStorage` key of the sign-in reset ticket, read once by the `gate=pin-reset` boot intent. */
export const PIN_RESET_TICKET_KEY = 'hr:shell:pinReset';
/** [OA] Section 8.5: the ticket written by `/account/pin-reset`; valid for `PIN_RESET_TICKET_MS` at the epoch it names. */
export const PinResetTicketSchema = z.object({ v: z.literal(1), at: Time, epoch: PinEpoch });
export type PinResetTicket = z.infer<typeof PinResetTicketSchema>;

/** [OA] OA-D9: learner key of the profile locks (stored as `hr:profiles:locks`), outside `hr:profiles`. */
export const PROFILE_LOCKS_KEY = 'profiles:locks';
/** [OA] Section 13.2: the most ids a locks record holds; far above the profiles any one device keeps. */
export const PROFILE_LOCKS_MAX_IDS = 200;
/**
 * [OA] OA-D9, section 13.2: the locked learner profiles, by id, each once. Local only, never synced. Tolerant in the
 * safe direction: a repeated id (two tabs appending the same lock) is kept once and a malformed id, which can never
 * match a profile, is dropped, so neither turns the whole record into a failed read. A record that still does not
 * parse is a failed read (fail closed), never a missing key; so is one with more than `PROFILE_LOCKS_MAX_IDS` ids,
 * which no device holds (a corrupted or hostile value is refused before any id is checked).
 */
export const ProfileLocksSchema = z.object({
  v: z.literal(1),
  ids: z.array(z.string()).max(PROFILE_LOCKS_MAX_IDS).transform((ids) => [...new Set(ids.filter((id) => ProfileSchema.shape.id.safeParse(id).success))]),
});
export type ProfileLocks = z.infer<typeof ProfileLocksSchema>;

/** [OA] Section 7.6: the BroadcastChannel that tells console tabs to drop their unlock. */
export const GROWN_UP_LOCK_CHANNEL = 'hr-grownup';
/** [OA] Section 7.6: the one message on `hr-grownup`; nothing else is ever posted. */
export const GrownUpLockMessageSchema = z.object({ v: z.literal(1), kind: z.literal('lock') }).strict();
export type GrownUpLockMessage = z.infer<typeof GrownUpLockMessageSchema>;

/** [OA] OA-D19: the BroadcastChannel that tells other learner tabs to re-read the profile list. */
export const PROFILES_CHANNEL = 'hr-profiles';
/** [OA] OA-D19: the one message on `hr-profiles`; it carries no id. */
export const ProfilesChangedMessageSchema = z.object({ v: z.literal(1), kind: z.literal('changed') }).strict();
export type ProfilesChangedMessage = z.infer<typeof ProfilesChangedMessageSchema>;

/** [OA] Section 7.6: shell store `pinPromptSeen` holds `true` and no other data. */
export const PinPromptSeenSchema = z.literal(true);

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** [OA] OA-D6: a shared device shows the chooser again after this long in the background. */
export const CHOOSER_RESUME_MS = 30 * MINUTE_MS;
/** [OA] OA-D16: a grown-up session ends after this long in the background; a locked active profile relocks. */
export const GROWN_UP_BACKGROUND_MS = 5 * MINUTE_MS;
/** [OA] OA-D7: the pause after each round of 5 misses, by strikes so far (the last step repeats). */
export const PIN_PAUSE_STEPS_MS = [30_000, MINUTE_MS, 5 * MINUTE_MS, 15 * MINUTE_MS, 60 * MINUTE_MS] as const;
/** [OA] OQ-23: one pause step falls back after this long with no miss. */
export const PIN_STRIKE_DECAY_MS = DAY_MS;
/** [OA] OQ-22: the Rescue Code's own throttle: this many wrong codes within `RESCUE_WINDOW_MS`, then `RESCUE_PAUSE_MS`. */
export const RESCUE_MAX_ATTEMPTS = 5;
export const RESCUE_WINDOW_MS = 15 * MINUTE_MS;
export const RESCUE_PAUSE_MS = 15 * MINUTE_MS;
/** [OA] Section 8.5: how long a sign-in reset ticket is accepted. */
export const PIN_RESET_TICKET_MS = 2 * MINUTE_MS;
/** [OA] Section 7.1: an older `deviceUses` record reads as "no uses". */
export const DEVICE_USES_TTL_MS = 30 * DAY_MS;
/** [OA] OA-D17: from this many learner profiles, chooser tiles are ordered by name instead of creation. */
export const CHOOSER_NAME_ORDER_FROM = 13;
/** [OA] OQ-24: days the Worker keeps the anonymous `telemetry_daily` counters. */
export const TELEMETRY_DAILY_KEEP_DAYS = 400;

/**
 * [OA] Section 5.3 (row OA-4b): the query the chooser's School row adds to `/teach`; the `/teach` router carries it to
 * the teacher home, which moves focus to its first school card and then removes it. Holds no id.
 */
export const SCHOOL_FOCUS = { param: 'focus', value: 'school' } as const;
export const SCHOOL_FOCUS_QUERY = `${SCHOOL_FOCUS.param}=${SCHOOL_FOCUS.value}`;

/** [OA] Section 6.2: why the chooser opened. [GU] AMENDMENTS-GUEST-FIRST-LESSON section 12: `try`, a chooser the site opened with `?try=1`. */
export const WHO_TRIGGERS = ['launch', 'return', 'resume', 'join', 'manual', 'try'] as const;

const wholeIn = (min: number, max: number) => z.number().int().min(min).max(max);

/**
 * [OA] Section 15: the payload of every event the amendment emits or newly emits. Strict: codes, booleans and
 * bounded whole numbers only, never a profile id, a name or free text. The Worker enforces the same keys and values
 * (`OA_PAYLOAD_RULES`, packages/backend) and stores every one of these events without a profile id. The
 * `pin.reset_*` schemas are the onboarding ones, so the two lists cannot drift.
 */
export const OA_TELEMETRY_PAYLOADS = {
  'profile.switch': z
    .object({
      via: z.enum(['chooser', 'profile', 'home']),
      trigger: z.enum([...WHO_TRIGGERS, 'none']),
      locked: z.boolean(),
      minutesIn: z.enum(['0-2', '2-10', '10+']),
    })
    .strict(),
  'parent.gate.opened': z
    .object({
      dest: z.enum(['area', 'use', 'locked_profile', 'action', 'cancel_reset']),
      via: z.enum(['pin', 'biometric', 'session', 'open']),
      marker: z.enum(['none', 'pin', 'nopin']),
    })
    .strict(),
  'who.shown': z
    .object({
      trigger: z.enum(WHO_TRIGGERS),
      learners: z.enum(['1', '2', '3-4', '5-12', '13+']),
      grownUps: wholeIn(0, 4),
      anyLocked: z.boolean(),
      resetPending: z.boolean(),
    })
    .strict(),
  'who.picked': z
    .object({
      // [GU] AMENDMENTS-GUEST-FIRST-LESSON section 12: `try` (Try the first quest) and `guest` (the guest's tile).
      kind: z.enum(['learner', 'locked_learner', 'grown_up', 'add', 'cancel_reset', 'try', 'guest']),
      use: z.enum(['family', 'teacher', 'school', 'area', 'signin']).optional(),
    })
    .strict(),
  'pin.paused': z.object({ step: wholeIn(1, PIN_PAUSE_STEPS_MS.length) }).strict(),
  'pin.reset_requested': ONBOARDING_TELEMETRY_PAYLOADS['pin.reset_requested'],
  'pin.reset_completed': ONBOARDING_TELEMETRY_PAYLOADS['pin.reset_completed'],
  'pin.biometric_changed': z.object({ on: z.boolean(), reason: z.enum(['user', 'pin_changed', 'enrolment_changed']) }).strict(),
  'profile.lock_changed': z.object({ locked: z.boolean() }).strict(),
  'profile.removed': z.object({ saved: z.boolean(), wasActive: z.boolean(), anyway: z.boolean() }).strict(),
  'space.join.batch': z.object({ picked: wholeIn(0, 12), joined: wholeIn(0, 12), refused: wholeIn(0, 12) }).strict(),
  'shell.grown_up_handoff': z.object({ via: z.enum(GROWN_UP_HANDOFF_VIAS), target: z.enum(GROWN_UP_HANDOFF_TARGETS) }).strict(),
} as const satisfies Partial<Record<TelemetryEventName, z.AnyZodObject>>;
