import { describe, expect, it } from 'vitest';
import {
  APP_ORIGIN,
  APP_ROUTES,
  AdultPersonaSchema,
  CONSOLE_SESSION_KEY,
  DEVICE_GATE_KEY,
  DeviceGateMarkerSchema,
  GROWN_UP_FRESH_PIN_MS,
  GROWN_UP_IDLE_MS,
  GROWN_UP_PREFIXES,
  GrownUpUnlockSchema,
  JOIN_HANDOFF_KEY,
  JOIN_HANDOFF_MS,
  JoinHandoffSchema,
  LEARNER_ROOTS,
  LastPersonaSchema,
  PIN_SET_AT_KEY,
  PersonaSchema,
  SHELL_DB,
  SHELL_KEYS,
  SHELL_STORE,
  SITE_ORIGIN,
  UNLOCK_SESSION_KEY,
  homeFor,
  isGrownUpPath,
  isLearnerRoot,
  legacyAppTarget,
  parseLenient,
  personaHint,
  personasFor,
  safeNextPath,
  unlockActive,
  type AdultPersona,
  type GrownUpUnlock,
  type SpaceKind,
  type SpaceRole,
} from '../index';

describe('origins, prefixes and routes (F-APP-001 section 3.14)', () => {
  it('names the two hosts once', () => {
    expect(APP_ORIGIN).toBe('https://app.hangulroute.com');
    expect(SITE_ORIGIN).toBe('https://hangulroute.com');
  });

  it('lists the grown-up prefixes and the learner roots of section 3.2', () => {
    expect(GROWN_UP_PREFIXES).toEqual(['/signin', '/start', '/teach', '/parent', '/account']);
    expect(LEARNER_ROOTS).toEqual(['/present', '/browse']);
  });

  it('keeps billing under /account, never a /billing prefix (R-1)', () => {
    expect(APP_ROUTES).toEqual({
      signIn: '/signin',
      start: '/start',
      parentHome: '/parent',
      teacherIndex: '/teach',
      teacherHome: '/teach/home',
      billing: '/account/billing',
      learn: '/',
    });
    expect(GROWN_UP_PREFIXES).not.toContain('/billing');
  });

  it('every grown-up route except learn is a grown-up path', () => {
    for (const [key, path] of Object.entries(APP_ROUTES)) {
      expect(isGrownUpPath(path)).toBe(key !== 'learn');
    }
  });
});

describe('personas', () => {
  it('has three personas, two of them adult', () => {
    expect(PersonaSchema.options).toEqual(['learner', 'parent', 'teacher']);
    expect(AdultPersonaSchema.options).toEqual(['parent', 'teacher']);
    expect(AdultPersonaSchema.safeParse('learner').success).toBe(false);
  });
});

describe('isGrownUpPath (R-1 boundaries)', () => {
  it.each([
    '/teach',
    '/teach/',
    '/teach?x=1',
    '/teach.html',
    '/teach.txt',
    '/teach/home',
    '/teach/space?id=space:abc',
    '/signin',
    '/signin?persona=parent',
    '/start',
    '/parent',
    '/parent/space/notes?id=space:a',
    '/account',
    '/account/billing',
    '/account/billing/receipts?id=space:a',
  ])('%s is a grown-up path', (path) => {
    expect(isGrownUpPath(path)).toBe(true);
  });

  it.each([
    '/',
    '',
    '/teacher',
    '/teaching/x',
    '/parentx',
    '/parents',
    '/signing',
    '/starter',
    '/accounts',
    '/billing',
    '/present',
    '/browse',
    '/Teach',
    '/TEACH/home',
    'teach',
    '/x/teach',
    '#/teach',
  ])('%s is not a grown-up path', (path) => {
    expect(isGrownUpPath(path)).toBe(false);
  });
});

describe('isLearnerRoot', () => {
  it.each(['/present', '/present/', '/present?deck=1', '/present.html', '/browse', '/browse/x'])('%s is a learner root', (p) => {
    expect(isLearnerRoot(p)).toBe(true);
  });

  it.each(['/', '/presenter', '/browser', '/teach', '/Present', ''])('%s is not a learner root', (p) => {
    expect(isLearnerRoot(p)).toBe(false);
  });

  it('never overlaps the grown-up prefixes (the denylist never lists a learner root)', () => {
    for (const root of LEARNER_ROOTS) expect(isGrownUpPath(root)).toBe(false);
    for (const prefix of GROWN_UP_PREFIXES) expect(isLearnerRoot(prefix)).toBe(false);
  });
});

describe('safeNextPath (closes open redirects through next)', () => {
  it('accepts a relative grown-up path with its query', () => {
    expect(safeNextPath('/teach/space?id=space:abc')).toBe('/teach/space?id=space:abc');
    expect(safeNextPath('/parent')).toBe('/parent');
    expect(safeNextPath('/account/billing?checkout=success')).toBe('/account/billing?checkout=success');
  });

  it('decodes once', () => {
    expect(safeNextPath('%2Fteach%2Fspace%3Fid%3Dspace%3Aabc')).toBe('/teach/space?id=space:abc');
    expect(safeNextPath('%2F%2Fevil.example')).toBeNull();
    expect(safeNextPath('%252F%252Fevil.example')).toBeNull();
  });

  it('drops the fragment', () => {
    expect(safeNextPath('/teach/home#top')).toBe('/teach/home');
    expect(safeNextPath('/teach/space?id=space:a#x')).toBe('/teach/space?id=space:a');
  });

  it.each([
    'https://evil.example',
    'https://evil.example/teach',
    '//evil.example',
    '//evil.example/teach',
    '/\\evil.example',
    '/teach\\..\\x',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    'teach/home',
    '/',
    '/teacher',
    '/billing',
    '/present',
    '/teach/../present',
    '/teach/%2e%2e/present',
    '/teach/.%2E/x',
    '/teach/%2E./x',
    '/teach/x/..',
    '/teach\nx',
    '/\t/evil.example',
    '/teach\u0000',
    '/teach\u007f',
    '%E0%A4%A',
    '',
  ])('rejects %j', (raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42 as unknown as string)).toBeNull();
  });

  it('allows at most 512 characters', () => {
    const base = '/teach/space?id=';
    const ok = base + 'a'.repeat(512 - base.length);
    expect(ok).toHaveLength(512);
    expect(safeNextPath(ok)).toBe(ok);
    expect(safeNextPath(ok + 'a')).toBeNull();
  });

  it('allows dots that are not a parent segment', () => {
    expect(safeNextPath('/teach.html')).toBe('/teach.html');
    expect(safeNextPath('/teach/space?id=a..b')).toBe('/teach/space?id=a..b');
    expect(safeNextPath('/teach/...')).toBe('/teach/...');
  });
});

describe('legacyAppTarget (app-host legacy pages)', () => {
  it('maps the two legacy pages', () => {
    expect(legacyAppTarget('/teach/start')).toBe('/start');
    expect(legacyAppTarget('/teach/billing')).toBe('/account/billing');
  });

  it('tolerates a trailing slash and the exported .html name', () => {
    expect(legacyAppTarget('/teach/start/')).toBe('/start');
    expect(legacyAppTarget('/teach/billing.html')).toBe('/account/billing');
  });

  it.each(['/teach', '/teach/home', '/teach/startx', '/start', '/account/billing', '/', ''])('%s has no legacy target', (p) => {
    expect(legacyAppTarget(p)).toBeNull();
  });
});

describe('personaHint', () => {
  const params = (q: string) => new URLSearchParams(q);

  it('reads persona, then its alias as', () => {
    expect(personaHint(params('persona=parent'))).toBe('parent');
    expect(personaHint(params('persona=teacher'))).toBe('teacher');
    expect(personaHint(params('as=teacher'))).toBe('teacher');
    expect(personaHint(params('persona=parent&as=teacher'))).toBe('parent');
  });

  it('ignores unknown values', () => {
    expect(personaHint(params(''))).toBeNull();
    expect(personaHint(params('persona=learner'))).toBeNull();
    expect(personaHint(params('persona=Parent'))).toBeNull();
    expect(personaHint(params('persona=admin&as=teacher'))).toBe('teacher');
    expect(personaHint(params('as=school'))).toBeNull();
  });
});

describe('personasFor (personas come from memberships)', () => {
  const kinds: SpaceKind[] = ['family', 'class', 'school'];
  const roles: SpaceRole[] = ['owner', 'caregiver', 'teacher', 'admin', 'student'];
  const expected: Record<SpaceKind, Record<SpaceRole, AdultPersona | null>> = {
    family: { owner: 'parent', caregiver: 'parent', teacher: null, admin: null, student: null },
    class: { owner: 'teacher', caregiver: null, teacher: 'teacher', admin: null, student: null },
    school: { owner: 'teacher', caregiver: null, teacher: 'teacher', admin: 'teacher', student: null },
  };

  for (const kind of kinds) {
    for (const role of roles) {
      const want = expected[kind][role];
      it(`${kind} x ${role} -> ${want ?? 'none'}`, () => {
        expect(personasFor([{ kind, role }])).toEqual(want ? [want] : []);
      });
    }
  }

  it('returns nothing for no memberships', () => {
    expect(personasFor([])).toEqual([]);
  });

  it('orders parent before teacher and lists each once', () => {
    expect(
      personasFor([
        { kind: 'class', role: 'owner' },
        { kind: 'school', role: 'admin' },
        { kind: 'family', role: 'caregiver' },
        { kind: 'family', role: 'owner' },
      ]),
    ).toEqual(['parent', 'teacher']);
  });

  it('counts archived spaces (extra fields are ignored) and ignores student memberships', () => {
    expect(personasFor([{ kind: 'family', role: 'owner', archivedAt: '2026-10-01T00:00:00Z' } as { kind: SpaceKind; role: SpaceRole }])).toEqual(['parent']);
    expect(personasFor([{ kind: 'class', role: 'student' }, { kind: 'family', role: 'student' }])).toEqual([]);
  });
});

describe('homeFor (persona home)', () => {
  it('sends an account with no persona to /start, keeping the hint', () => {
    expect(homeFor({ personas: [], last: null, hint: null })).toBe('/start');
    expect(homeFor({ personas: [], last: 'teacher', hint: null })).toBe('/start');
    expect(homeFor({ personas: [], last: null, hint: 'parent' })).toBe('/start?persona=parent');
    expect(homeFor({ personas: [], hint: 'teacher' })).toBe('/start?persona=teacher');
  });

  it('follows a hint whether or not the account holds it', () => {
    expect(homeFor({ personas: ['parent', 'teacher'], last: 'parent', hint: 'teacher' })).toBe('/teach/home');
    expect(homeFor({ personas: ['teacher'], last: 'teacher', hint: 'parent' })).toBe('/parent');
    expect(homeFor({ personas: ['parent'], last: null, hint: 'teacher' })).toBe('/teach/home');
  });

  it('uses the last persona only while the account still holds it', () => {
    expect(homeFor({ personas: ['parent', 'teacher'], last: 'teacher', hint: null })).toBe('/teach/home');
    expect(homeFor({ personas: ['parent', 'teacher'], last: 'parent' })).toBe('/parent');
    expect(homeFor({ personas: ['teacher'], last: 'parent', hint: null })).toBe('/teach/home');
  });

  it('uses the only persona', () => {
    expect(homeFor({ personas: ['teacher'] })).toBe('/teach/home');
    expect(homeFor({ personas: ['parent'], last: null, hint: null })).toBe('/parent');
  });

  it('defaults to Family when the account holds both and has no history (OD-11)', () => {
    expect(homeFor({ personas: ['parent', 'teacher'], last: null, hint: null })).toBe('/parent');
    expect(homeFor({ personas: ['teacher', 'parent'] })).toBe('/parent');
  });
});

describe('hand-off records (lenient on read)', () => {
  it('device gate marker: pin needs a pinEpoch', () => {
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'pin', pinEpoch: 0 }).success).toBe(true);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'pin', pinEpoch: 1_760_000_000_000 }).success).toBe(true);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'pin' }).success).toBe(false);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'pin', pinEpoch: -1 }).success).toBe(false);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'pin', pinEpoch: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'nopin' }).success).toBe(true);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'none' }).success).toBe(true);
    expect(DeviceGateMarkerSchema.safeParse({ v: 2, gate: 'none' }).success).toBe(false);
    expect(DeviceGateMarkerSchema.safeParse({ v: 1, gate: 'open' }).success).toBe(false);
  });

  it('device gate marker holds no name or profile data', () => {
    const parsed = DeviceGateMarkerSchema.parse({ v: 1, gate: 'nopin', name: 'Mina', profiles: 2 });
    expect(parsed).toEqual({ v: 1, gate: 'nopin' });
  });

  it('grown-up unlock: pin unlocks carry the epoch, sign-in unlocks do not', () => {
    expect(GrownUpUnlockSchema.parse({ v: 1, at: 10, seen: 20, src: 'pin', pinEpoch: 5 })).toEqual({
      v: 1,
      at: 10,
      seen: 20,
      src: 'pin',
      pinEpoch: 5,
    });
    expect(GrownUpUnlockSchema.safeParse({ v: 1, at: 10, seen: 20, src: 'pin' }).success).toBe(false);
    expect(GrownUpUnlockSchema.parse({ v: 1, at: 10, seen: 20, src: 'signin', pinEpoch: 5 })).toEqual({
      v: 1,
      at: 10,
      seen: 20,
      src: 'signin',
    });
    expect(GrownUpUnlockSchema.safeParse({ v: 1, at: -1, seen: 20, src: 'signin' }).success).toBe(false);
    expect(GrownUpUnlockSchema.safeParse({ v: 1, at: 1, seen: Number.NaN, src: 'signin' }).success).toBe(false);
    expect(GrownUpUnlockSchema.safeParse({ v: 1, at: 1, seen: 1, src: 'oauth' }).success).toBe(false);
  });

  it('last persona is an adult persona', () => {
    expect(LastPersonaSchema.safeParse({ v: 1, persona: 'teacher' }).success).toBe(true);
    expect(LastPersonaSchema.safeParse({ v: 1, persona: 'learner' }).success).toBe(false);
    expect(LastPersonaSchema.safeParse({ v: 1 }).success).toBe(false);
  });

  it('join hand-off holds a join code and a time, nothing else', () => {
    expect(JoinHandoffSchema.parse({ v: 1, code: 'ABC234', at: 1, name: 'Mina', spaceId: 'space:a' })).toEqual({
      v: 1,
      code: 'ABC234',
      at: 1,
    });
    expect(JoinHandoffSchema.safeParse({ v: 1, code: 'abc234', at: 1 }).success).toBe(false);
    expect(JoinHandoffSchema.safeParse({ v: 1, code: 'ABC10O', at: 1 }).success).toBe(false);
    expect(JoinHandoffSchema.safeParse({ v: 1, code: 'ABC2345', at: 1 }).success).toBe(false);
  });

  it('parseLenient: invalid or corrupt means absent', () => {
    expect(parseLenient(DeviceGateMarkerSchema, '{"v":1,"gate":"none"}')).toEqual({ v: 1, gate: 'none' });
    expect(parseLenient(DeviceGateMarkerSchema, { v: 1, gate: 'nopin' })).toEqual({ v: 1, gate: 'nopin' });
    expect(parseLenient(DeviceGateMarkerSchema, '{not json')).toBeNull();
    expect(parseLenient(DeviceGateMarkerSchema, '')).toBeNull();
    expect(parseLenient(DeviceGateMarkerSchema, 'null')).toBeNull();
    expect(parseLenient(DeviceGateMarkerSchema, null)).toBeNull();
    expect(parseLenient(DeviceGateMarkerSchema, undefined)).toBeNull();
    expect(parseLenient(LastPersonaSchema, '{"v":1,"persona":"admin"}')).toBeNull();
    expect(parseLenient(GrownUpUnlockSchema, 42)).toBeNull();
    expect(parseLenient(JoinHandoffSchema, '{"v":1,"code":"ABC234","at":5}')).toEqual({ v: 1, code: 'ABC234', at: 5 });
  });
});

describe('timers and unlockActive', () => {
  it('names the three windows', () => {
    expect(GROWN_UP_IDLE_MS).toBe(15 * 60_000);
    expect(GROWN_UP_FRESH_PIN_MS).toBe(2 * 60_000);
    expect(JOIN_HANDOFF_MS).toBe(30 * 60_000);
  });

  const unlock = (seen: number): GrownUpUnlock => ({ v: 1, at: seen, seen, src: 'signin' });
  const t0 = 1_760_000_000_000;

  it('is active from 0 to just under 15 idle minutes', () => {
    expect(unlockActive(unlock(t0), t0)).toBe(true);
    expect(unlockActive(unlock(t0), t0 + 14 * 60_000 + 59_000)).toBe(true);
    expect(unlockActive(unlock(t0), t0 + 15 * 60_000 - 1)).toBe(true);
  });

  it('expires at 15 idle minutes', () => {
    expect(unlockActive(unlock(t0), t0 + 15 * 60_000)).toBe(false);
    expect(unlockActive(unlock(t0), t0 + 60 * 60_000)).toBe(false);
  });

  it('is not active when the clock runs backwards or nothing is stored', () => {
    expect(unlockActive(unlock(t0), t0 - 1)).toBe(false);
    expect(unlockActive(null, t0)).toBe(false);
    expect(unlockActive(undefined, t0)).toBe(false);
    expect(unlockActive(unlock(t0), Number.NaN)).toBe(false);
  });

  it('counts idle time from seen, not from at', () => {
    expect(unlockActive({ v: 1, at: t0, seen: t0 + 20 * 60_000, src: 'pin', pinEpoch: 0 }, t0 + 21 * 60_000)).toBe(true);
  });
});

describe('storage names', () => {
  it('names every key once', () => {
    expect(DEVICE_GATE_KEY).toBe('device:gate');
    expect(PIN_SET_AT_KEY).toBe('account:pinSetAt');
    expect(SHELL_DB).toBe('hr-shell');
    expect(SHELL_STORE).toBe('kv');
    expect(SHELL_KEYS).toEqual({ lastPersona: 'lastPersona', pinEpoch: 'pinEpoch' });
    expect(UNLOCK_SESSION_KEY).toBe('hr:grownup:unlock');
    expect(CONSOLE_SESSION_KEY).toBe('hr:console:session');
    expect(JOIN_HANDOFF_KEY).toBe('hr:shell:joinCode');
  });

  it('keeps the shell store out of the learner hr: namespace', () => {
    expect(SHELL_DB.startsWith('hr:')).toBe(false);
    for (const key of Object.values(SHELL_KEYS)) expect(key.startsWith('hr:')).toBe(false);
  });
});
