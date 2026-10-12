import { levelLabel } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SchoolAdminView } from '@/components/console/SchoolAdmin';
import { SettingsSections, type SettingsSectionsProps } from '@/components/console/SettingsParts';
import { LoadErrorPanel } from '@/components/console/ui';
import { mockFamily } from '@/data/mock-family';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import type { EntitlementView, MemberView, Roster, SchoolView } from '@/lib/console/api';
import { expectAllPseudo, wordsOf } from './pseudo-text';
// The pages are imported here, once, not inside each test: a page load counted against the 5 s test timeout on a
// busy CI runner. The mocks above are hoisted above these imports, and the pages read the env flags when they render.
import * as parentChildPage from '@/app/(console)/parent/[childId]/page';
import * as parentLayout from '@/app/(console)/parent/layout';
import * as parentPage from '@/app/(console)/parent/page';
import * as settingsPage from '@/app/(console)/teach/space/settings/page';

/**
 * F-I18N-001 PR 10c, §3.11: the space settings page, the school admin view and the /parent demo
 * take every word from the dictionary. Rendered in the pseudo-locale (en-XA), every text node and
 * every labelled attribute is bracketed pseudo text once the data is removed; an English literal
 * left in a part would show up unbracketed. Effects do not run in a server render, so the loaded
 * states render the parts (`SettingsSections`, `SchoolAdminView`) with data.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined, LocaleProvider: ({ children }: { children: unknown }) => children };
});

// The formatters take UI locales only (en-XA is a dictionary test locale): dates render in English.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, useRouter: () => ({ replace: () => undefined, push: () => undefined }), useSearchParams: () => new URLSearchParams('id=space%3Ac1') };
});

vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({ mode: 'dev', ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, getToken: async () => 'teacher-kim', signOut: async () => undefined, devSignIn: () => undefined }),
}));

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.test');
  vi.stubEnv('NEXT_PUBLIC_CONSOLE_DEV_AUTH', 'true');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const now = new Date('2026-10-11T12:00:00.000Z');
const noop = (): void => undefined;

const roster = (kind: Roster['space']['kind'], over: Partial<Roster['space']> = {}, joinCode: string | null = 'K7Q2MX'): Roster => ({
  space: { id: 'space:c1', kind, name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'school', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z', ...over },
  learners: [],
  joinCode,
  joinCodeExpiresAt: joinCode ? '2026-10-20T00:00:00.000Z' : null,
});
const member = (over: Partial<MemberView>): MemberView => ({ memberKind: 'account', memberId: 'teacher-kim', role: 'owner', joinedAt: '2026-10-11T08:00:00.000Z', name: 'Ms Kim', isOwner: true, ...over });
const members: MemberView[] = [
  member({}),
  member({ memberId: 'ms-park', role: 'teacher', name: 'Ms Park', isOwner: false }),
  member({ memberKind: 'learner', memberId: 'profile:mina', role: 'student', name: 'Mina', isOwner: false }),
  member({ memberKind: 'learner', memberId: 'profile:jun', role: 'student', name: 'Jun', isOwner: false, joinedAt: '2026-10-10T08:00:00.000Z' }),
];
const settingsData = ['K7Q2MX', 'Ms Kim', 'Ms Park', 'Mina', 'Jun'];

const sections = (over: Partial<SettingsSectionsProps>): string =>
  renderToStaticMarkup(
    <SettingsSections
      roster={roster('class')}
      members={members}
      accountId="teacher-kim"
      now={now}
      busy={false}
      schoolConsent={false}
      deleteTarget=""
      typedName=""
      onRegenerate={noop}
      onConsent={noop}
      onAnonymize={noop}
      onRemoveAdult={noop}
      onRemoveLearner={noop}
      onArchive={noop}
      onDeleteTarget={noop}
      onTypedName={noop}
      onDelete={noop}
      {...over}
    />,
  );

describe('space settings render only dictionary text (en-XA)', () => {
  it('the pseudo-locale is on for this test', () => {
    expect(getMessages(PSEUDO).console.settings.title).toMatch(/^\[/);
  });

  it('a class in school consent mode, a learner chosen for deletion', () => {
    const html = sections({ deleteTarget: 'profile:mina', typedName: 'Mi' });
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="typedName"');
    expectAllPseudo(html, settingsData);
  });

  it('a class with school consent selectable and no code yet', () => {
    expectAllPseudo(sections({ roster: roster('class', {}, null), schoolConsent: true }), settingsData);
  });

  it('a family (no consent section, delete asks a parent) and an archived school, with nobody joined', () => {
    const family = sections({ roster: roster('family', { settings: { consentMode: 'parent', anonymizeRoster: true } }) });
    expect(family).not.toContain('type="radio"');
    expectAllPseudo(family, settingsData);
    expectAllPseudo(sections({ roster: roster('school', { archivedAt: '2026-10-01T00:00:00.000Z' }), members: [member({})] }), settingsData);
  });

  it('the page, before the roster loads', () => {
    const Page = settingsPage.default;
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expectAllPseudo(html, [], 3);
  });
});

const license = (over: Partial<EntitlementView & { active: boolean }> = {}): EntitlementView & { active: boolean } => ({
  id: 'ent:1',
  subjectKind: 'space',
  subjectId: 'space:sch',
  planKey: 'group_license',
  status: 'active',
  provider: 'manual',
  providerRef: null,
  customerRef: null,
  seats: 300,
  expiresAt: null,
  promoCode: null,
  updatedAt: '2026-09-20T00:00:00.000Z',
  subjectName: 'Seoul school',
  active: true,
  ...over,
});
const school = (over: Partial<SchoolView> = {}): SchoolView => ({
  school: { id: 'space:sch', kind: 'school', name: 'Seoul school', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  invite: { joinCode: 'T3ACH9', joinCodeExpiresAt: '2026-10-20T00:00:00.000Z' },
  license: license(),
  limits: { licensed: true, students: 300, teachers: 10 },
  usage: { students: 280, teachers: 4 },
  thisWeek: { students: 38, practiced: 31, classes: 2, classesWithPlan: 1 },
  classes: [
    { space: { id: 'space:ca', kind: 'class', name: 'Sunday Class A', parentSpaceId: 'space:sch', settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: null, createdAt: 't' }, teacher: { accountId: 'ms-park', name: 'Ms Park' }, students: 12, practiced: 9, lastActiveAt: '2026-10-11T08:00:00.000Z', hasPublishedPlan: true },
    { space: { id: 'space:cb', kind: 'class', name: 'Sunday Class B', parentSpaceId: 'space:sch', settings: { consentMode: 'parent', anonymizeRoster: true }, archivedAt: '2026-10-01T00:00:00.000Z', createdAt: 't' }, teacher: null, students: 1, practiced: 0, lastActiveAt: null, hasPublishedPlan: false },
  ],
  ...over,
});
const schoolMembers: MemberView[] = [member({ name: 'Principal Lee' }), member({ memberId: 'ms-park', role: 'teacher', name: 'Ms Park', isOwner: false })];
const schoolData = ['T3ACH9', 'Seoul school', 'Sunday Class A', 'Sunday Class B', 'Ms Park', 'Principal Lee', 'New class name'];

// Inline links are unwrapped, so the footer sentence the settings link sits in (aroundSlot) reads as one text node.
const schoolView = (over: Partial<Parameters<typeof SchoolAdminView>[0]> = {}, raw = false): string =>
  (raw ? (html: string) => html : unwrapLinks)(renderToStaticMarkup(
    <SchoolAdminView
      view={school()}
      members={schoolMembers}
      spaceId="space:sch"
      now={now}
      busy={false}
      copied={false}
      assigning={null}
      newClass=""
      onCopy={noop}
      onRegenerate={noop}
      onAssigning={noop}
      onAssign={noop}
      onNewClass={noop}
      onCreateClass={noop}
      {...over}
    />,
  ));
const unwrapLinks = (html: string): string => html.replace(/<a [^>]*>|<\/a>/g, '');

describe('school admin renders only dictionary text (en-XA)', () => {
  it('a licensed school near its limit, with an active and an archived class', () => {
    const html = schoolView({});
    expect(html.match(/data-testid="class-row"/g)).toHaveLength(2);
    expect(schoolView({}, true)).toContain('href="/teach/space/settings?id=space%3Asch"');
    expectAllPseudo(html, schoolData);
  });

  it('the teacher picker open, the code copied, a class name typed', () => {
    const html = schoolView({ assigning: 'space:ca', copied: true, newClass: 'New class name' });
    expect(html).toContain('<select');
    expectAllPseudo(html, schoolData);
  });

  it('an empty, unlicensed school with no code, and a lapsed licence', () => {
    expectAllPseudo(schoolView({ view: school({ classes: [], license: null, limits: { licensed: false, students: null, teachers: null }, invite: { joinCode: null, joinCodeExpiresAt: null } }), members: [member({})] }), schoolData);
    expectAllPseudo(schoolView({ view: school({ license: license({ status: 'past_due', active: false }), usage: { students: 300, teachers: 4 } }) }), schoolData);
  });
});

describe('/parent demo renders only dictionary text (en-XA)', () => {
  const family = mockFamily();
  // The demo family is sample data: names, level labels (content-schema), quest titles, times, day letters, cards.
  const demoData = family.profiles.flatMap((p) => [
    p.displayName,
    levelLabel(p.ageGroup) ?? '',
    ...p.recentQuests.flatMap((q) => [q.title, q.completedAt]),
    ...p.weekly.map((w) => w.day),
    ...p.recentCards.flatMap((card) => [card.title, card.romanization, card.ko]),
  ]).filter((d) => d.length > 1)
    // Longest first, so a card gloss inside a quest title ("Kite") does not cut the title apart.
    .sort((a, b) => b.length - a.length);

  it('the family dashboard', () => {
    const Page = parentPage.default;
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain(`href="/parent/${family.profiles[0]!.slug}"`);
    expectAllPseudo(html, demoData);
  });

  it('each child page', () => {
    const Page = parentChildPage.default;
    for (const p of family.profiles) {
      // Day letters are one-letter sample data: drop them from the text nodes before the check.
      const html = renderToStaticMarkup(<Page params={{ childId: p.slug }} />).replace(/>[A-Z]<\/span>/g, '></span>');
      expectAllPseudo(html, demoData);
    }
  });

  it('the layout wraps the demo in the console locale provider', () => {
    const child = <p>x</p>;
    const el = parentLayout.default({ children: child });
    // The element itself, not its markup: a provider renders nothing of its own, so markup alone would pass without one.
    expect(el.type).toBe(LocaleProvider);
    expect((el.props as { children: unknown }).children).toBe(child);
  });
});

describe('the load-error panel of settings and school admin (en-XA)', () => {
  // Read inside each test: the pseudo-locale is switched on in beforeAll.
  const msgs = () => getMessages(PSEUDO).console;
  const words = (error: 'forbidden' | 'cantReach', forbidden: string): string[] => {
    const html = renderToStaticMarkup(<LoadErrorPanel error={error} forbidden={forbidden} onRetry={noop} />);
    expectAllPseudo(html, [], 2);
    return wordsOf(html, []);
  };

  it("a forbidden space shows the page's own words, with Try again", () => {
    const m = msgs();
    for (const forbidden of [m.settings.forbidden, m.school.forbidden]) expect(words('forbidden', forbidden)).toEqual([forbidden, m.tryAgain]);
  });

  it("anything else reads can't reach", () => {
    const m = msgs();
    expect(words('cantReach', m.settings.forbidden)).toEqual([m.cantReach, m.tryAgain]);
  });
});
