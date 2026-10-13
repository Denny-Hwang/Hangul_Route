import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { builderEpisodes, questsOf } from '@/data/catalog';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectAllPseudo } from './pseudo-text';
// The pages are imported here, once, not inside each test: a console page pulls in the dictionaries, the catalog and
// the console parts, and inside a test body that load counted against the 5 s test timeout on a busy CI runner. The
// mocks above are hoisted above these imports, and the pages read the env flags when they render, not when they load.
import * as billingPage from '@/app/(console)/account/billing/page';
import * as curriculumPage from '@/app/(console)/teach/space/curriculum/page';
import * as homePage from '@/app/(console)/teach/home/page';
import * as lecturePage from '@/app/(console)/teach/space/lecture/page';
import * as planPage from '@/app/(console)/teach/space/plan/page';
import * as relinkPage from '@/app/(console)/teach/space/relink/page';
import * as signInPage from '@/app/(console)/signin/page';
import * as teachRouterPage from '@/app/(console)/teach/page';
import * as teachStartPage from '@/app/(console)/teach/start/page';
import * as spacePage from '@/app/(console)/teach/space/page';
import * as startPage from '@/app/(console)/start/page';

/**
 * F-I18N-001 PRs 10a and 10b, §3.11: the migrated console pages take every word from the
 * dictionary. Rendered in the pseudo-locale (en-XA), every text node and every
 * labelled attribute is bracketed pseudo text; an English literal left in a page
 * would show up unbracketed here. Effects do not run in a server render, so this
 * covers each page's first paint; console-parts-pseudo.test.tsx renders the loaded
 * plan and billing states, and the dictionary tests cover the rest.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return {
    useConsoleLocale: view,
    useMessages: () => view().messages,
    useLocale: () => PSEUDO,
    useSetLocale: () => () => undefined,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Ac1'),
}));

const auth = { mode: 'dev', ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' } as { accountId: string; displayName: string } | null };
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({ ...auth, getToken: async () => 'teacher-kim', signOut: async () => undefined, devSignIn: () => undefined }),
}));

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.test');
  vi.stubEnv('NEXT_PUBLIC_CONSOLE_DEV_AUTH', 'true');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

function render(page: { default: () => JSX.Element }): string {
  const Page = page.default;
  return renderToStaticMarkup(<Page />);
}

describe('console pages render only dictionary text (en-XA)', () => {
  it('the pseudo-locale is on for this test', () => {
    expect(getMessages(PSEUDO).console.shell.home).toMatch(/^\[/);
  });

  it('sign-in, dev form (signed out)', () => {
    auth.session = null;
    const html = render(signInPage);
    auth.session = { accountId: 'teacher-kim', displayName: 'Ms Kim' };
    expect(html).toContain('name="accountId"');
    expectAllPseudo(html);
  });

  it('the /teach router and the /teach/start redirect: the polite line only (F-APP-001 A-4b)', () => {
    const router = render(teachRouterPage);
    expect(router).toContain('role="status"');
    expectAllPseudo(router, [], 1);
    const redirect = render(teachStartPage);
    expect(redirect).toContain('aria-live="polite"');
    expectAllPseudo(redirect, [], 1);
  });

  it('start, role step', () => {
    const html = render(startPage);
    expect(html).toContain('role="radiogroup"');
    expectAllPseudo(html);
  });

  it('home, before the list loads', () => {
    expectAllPseudo(render(homePage));
  });

  it('space roster, loading', () => {
    expectAllPseudo(render(spacePage));
  });

  it('curriculum wizard, step 1 (F-PLAN-002 section 3.8)', () => {
    const html = render(curriculumPage);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expectAllPseudo(html);
  });

  it('lecture setup while lecture mode is off: coming soon (F-TCH-004 PR 10)', () => {
    const html = render(lecturePage);
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expect(html).not.toContain('data-testid="open-presenter"');
    expectAllPseudo(html);
  });

  it('lecture setup, first paint with lecture mode on', () => {
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
    const html = render(lecturePage);
    vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', '');
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expectAllPseudo(html, [], 3);
  });

  it('relink, loading', () => {
    const html = render(relinkPage);
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expectAllPseudo(html);
  });

  it('plan builder, before the plans load (quest and episode titles are content)', () => {
    const html = render(planPage);
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expect(html).toContain('type="date"');
    expectAllPseudo(html, builderEpisodes().flatMap((e) => [e.title, ...questsOf(e.episodeId).map((q) => q.title)]));
  });

  it('billing, before the plans load', () => {
    const html = render(billingPage);
    expect(html).toContain('name="promo"');
    expectAllPseudo(html);
  });
});
