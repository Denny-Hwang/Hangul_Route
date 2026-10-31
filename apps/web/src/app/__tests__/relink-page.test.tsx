import { radii, touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { CSSProperties, ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-GROWNUP-UX section 8 T12 and section 9 P8, row GX-12 (section 14, "relink page tests"): the re-link page,
 * rendered. Its title says "New device requests"; each card is headed by the name and what is asked, names the
 * platform, rolls the request time up, counts down once a minute even when a read fails, keeps the shipped safety
 * hint right next to Approve (and names it as Approve's description); Approve and Deny are the console's 64 px
 * buttons; a family's denial names a grown-up; "Another way" is said once; the learner picker is the console's pill
 * select. In en, es and ko.
 */
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams('id=space%3Ac1') }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  useSearchParams: () => nav.params,
  usePathname: () => '/teach/space/relink',
}));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ title, children }: { title?: string; children: ReactNode }) => (
    <main>
      {title ? <h1>{title}</h1> : null}
      {children}
    </main>
  ),
}));
vi.mock('@/components/console/LanguageSelect', () => ({ LanguageSelect: () => null }));
const lang = vi.hoisted(() => ({ locale: 'en' as UiLocale }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

const fake = vi.hoisted(() => ({ calls: [] as string[], impl: {} as Record<string, (...args: unknown[]) => unknown> }));
vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  const api = new Proxy(
    {},
    {
      get: (_target, name) =>
        typeof name !== 'string' || name === 'then'
          ? undefined
          : (...args: unknown[]) => {
              fake.calls.push(name);
              const impl = fake.impl[name];
              return impl ? Promise.resolve(impl(...args)) : Promise.resolve({ ok: false, error: 'not_found', status: 404 });
            },
    },
  );
  return { useConsole: () => ({ ready: true, session: { accountId: 'acct-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages(lang.locale), locale: lang.locale }) };
});

import RelinkPage from '@/app/(console)/teach/space/relink/page';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const T = '2026-09-01T00:00:00.000Z';
const space = (kind: string) => ({ id: 'space:c1', kind, name: 'Sunflower', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });
const learner = (id: string, displayName: string) => ({ id, displayName, avatar: 'hoya-orange', ageGroup: 'starter', joinedAt: T, lastActiveAt: T, lastSyncedAt: T, summary: null });
const roster = (kind: string) => ({ ok: true, data: { space: space(kind), learners: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], joinCode: 'SUN234', joinCodeExpiresAt: '2099-11-15T12:00:00.000Z' } });
const request = (over: Partial<{ id: string; learnerId: string; learnerName: string; platform: string | null; requestedAt: string; expiresAt: string }> = {}) => ({
  id: 'relink:one',
  learnerId: 'profile:mina',
  learnerName: 'Mina',
  platform: 'ios',
  // Asked 1 min 30 s ago; closes in 8 min 30 s ("expires in 9 min").
  requestedAt: '2026-10-31T11:58:30.000Z',
  expiresAt: '2026-10-31T12:08:30.000Z',
  status: 'pending',
  ...over,
});
const ok = (data: unknown = {}) => ({ ok: true, data });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  fake.calls = [];
  fake.impl = {};
  lang.locale = 'en';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);

async function mount(locale: UiLocale = 'en'): Promise<ReactTestInstance> {
  lang.locale = locale;
  vi.useFakeTimers({ now: NOW, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined, location: { origin: 'https://app.test', assign: () => undefined } });
  await act(async () => {
    mounted = create(<RelinkPage />, { createNodeMock: () => ({ focus: () => undefined, querySelectorAll: () => [], getBoundingClientRect: () => ({ height: 96 }) }) });
  });
  await act(async () => undefined);
  return (mounted as unknown as ReactTestRenderer).root;
}

function button(scope: ReactTestInstance, label: string): ReactTestInstance {
  const found = scope.findAll((n) => n.type === 'button' && textOf(n).trim() === label);
  if (found.length === 0) throw new Error(`no button "${label}" among ${JSON.stringify(scope.findAll((n) => n.type === 'button').map((n) => textOf(n).trim()))}`);
  return found[0]!;
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    node.props.onClick?.();
  });
  await act(async () => undefined);
}

describe('the re-link page (GX-12)', () => {
  for (const locale of ['en', 'es', 'ko'] as const) {
    const c = getMessages(locale).console;

    it(`${locale}: the title says new device requests; the card names the learner, the platform and the time`, async () => {
      fake.impl = { roster: () => roster('class'), relinkRequests: () => ok([request()]) };
      const root = await mount(locale);
      expect(textOf(root.findByType('h1'))).toBe(c.relink.titleFor('Sunflower'));
      const [card] = byTestId(root, 'relink-card');
      expect(card).toBeDefined();
      const heading = (card as ReactTestInstance).findByType('h2');
      expect(textOf(heading)).toBe(c.relink.askingToBe('Mina'));
      expect(textOf(heading.findByType('strong'))).toBe('Mina');
      expect(textOf(byTestId(root, 'relink-meta')[0]!)).toBe(`${c.relink.platform.ios} · ${c.relink.askedAgo(1)}`);
      expect(textOf(card as ReactTestInstance)).not.toMatch(/\bios\b/);
      expect(textOf(byTestId(root, 'relink-countdown')[0]!)).toBe(c.relink.expiresIn(9));
      // The countdown is not a live region: it is not announced every minute.
      expect(byTestId(root, 'relink-countdown')[0]!.props['aria-live']).toBeUndefined();
    });

    it(`${locale}: Approve and Deny are the 64 px console buttons, with the safety hint right before them and named by Approve`, async () => {
      fake.impl = { roster: () => roster('class'), relinkRequests: () => ok([request()]) };
      const root = await mount(locale);
      const [card] = byTestId(root, 'relink-card');
      const approve = button(card as ReactTestInstance, c.relink.approve.cta);
      const deny = button(card as ReactTestInstance, c.relink.deny.cta);
      for (const b of [approve, deny]) expect((b.props.style as CSSProperties).minHeight).toBe(touchTarget.min);
      const hintId = approve.props['aria-describedby'] as string;
      expect(hintId).toBeTruthy();
      const hint = (card as ReactTestInstance).find((n) => typeof n.type === 'string' && n.props.id === hintId);
      expect(textOf(hint)).toBe(c.relinkApproveHint);
      // The hint is the card's line just before the buttons' row: nothing between it and Approve.
      const lines = (card as ReactTestInstance).children.filter((n): n is ReactTestInstance => typeof n !== 'string');
      const holding = (target: ReactTestInstance): number => lines.findIndex((n) => n === target || n.findAll((m) => m === target).length > 0);
      expect(holding(approve) - holding(hint)).toBe(1);
    });
  }

  it('counts down once a minute, even while the reads fail', async () => {
    let reads = 0;
    fake.impl = { roster: () => roster('class'), relinkRequests: () => (reads++ === 0 ? ok([request()]) : { ok: false, error: 'network' }) };
    const root = await mount('en');
    const c = getMessages('en').console;
    expect(textOf(byTestId(root, 'relink-card')[0]!)).toContain(c.relink.expiresIn(9));
    // 30 s on (and a margin) the 9 turns to 8, once; the next change is a minute later.
    await act(async () => {
      vi.advanceTimersByTime(30_500);
    });
    const card = () => textOf(byTestId(root, 'relink-card')[0]!);
    expect(card()).toContain(c.relink.expiresIn(8));
    expect(card()).toContain(c.relink.askedAgo(2));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(card()).toContain(c.relink.expiresIn(7));
    expect(card()).toContain(c.relink.askedAgo(3));
    // The reads failed meanwhile: the retry panel shows, and the card stayed.
    expect(textOf(root)).toContain(c.cantReach);
  });

  it('rolls an old request time up to hours, and says "device" for a platform it does not name', async () => {
    fake.impl = {
      roster: () => roster('class'),
      relinkRequests: () => ok([request({ platform: 'windows', requestedAt: '2026-10-31T08:00:00.000Z' })]),
    };
    const root = await mount('en');
    expect(textOf(byTestId(root, 'relink-meta')[0]!)).toBe('device · asked 4 hours ago');
  });

  it("a family's Deny says the device will ask for a grown-up; a class's says a teacher (P8)", async () => {
    for (const kind of ['family', 'class'] as const) {
      fake.impl = { roster: () => roster(kind), relinkRequests: () => ok([request()]), decideRelink: () => ok(request({})) };
      const root = await mount('en');
      const c = getMessages('en').console;
      await press(button(byTestId(root, 'relink-card')[0]!, c.relink.deny.cta));
      expect(textOf(root)).toContain(kind === 'family' ? c.relink.deniedFamily('Mina') : c.relink.denied('Mina'));
      act(() => mounted?.unmount());
      mounted = null;
      vi.useRealTimers();
    }
  });

  for (const locale of ['en', 'es', 'ko'] as const) {
    it(`${locale}: a family sees "Another way" once, its sentence without the prefix, and the pill select`, async () => {
      const c = getMessages(locale).console;
      fake.impl = { roster: () => roster('family'), relinkRequests: () => ok([]) };
      const root = await mount(locale);
      const all = textOf(root);
      expect(all.split(c.relink.anotherWay).length - 1).toBe(1);
      const section = root.find((n) => n.type === 'section' && n.props['aria-labelledby'] !== undefined);
      const heading = section.find((n) => n.type === 'h2');
      expect(heading.props.id).toBe(section.props['aria-labelledby']);
      expect(textOf(heading)).toBe(c.relink.anotherWay);
      expect(textOf(section)).toContain(c.relinkAnotherWay);
      const select = section.findByType('select');
      expect(select.props['aria-label']).toBe(c.relink.learnerLabel);
      const style = select.props.style as CSSProperties;
      expect(style.minHeight).toBe(touchTarget.min);
      expect(style.borderRadius).toBe(radii.pill);
      expect(style.maxWidth).toBe('100%');
    });
  }
});
