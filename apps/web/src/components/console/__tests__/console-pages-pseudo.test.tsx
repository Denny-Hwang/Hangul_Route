import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectAllPseudo } from './pseudo-text';

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

async function render(path: string): Promise<string> {
  const mod = (await import(path)) as { default: () => JSX.Element };
  const Page = mod.default;
  return renderToStaticMarkup(<Page />);
}

describe('console pages render only dictionary text (en-XA)', () => {
  it('the pseudo-locale is on for this test', () => {
    expect(getMessages(PSEUDO).console.shell.home).toMatch(/^\[/);
  });

  it('sign-in, dev form (signed out)', async () => {
    auth.session = null;
    const html = await render('@/app/(console)/teach/page');
    auth.session = { accountId: 'teacher-kim', displayName: 'Ms Kim' };
    expect(html).toContain('name="accountId"');
    expectAllPseudo(html);
  });

  it('start, role step', async () => {
    const html = await render('@/app/(console)/teach/start/page');
    expect(html).toContain('role="radiogroup"');
    expectAllPseudo(html);
  });

  it('home, before the list loads', async () => {
    expectAllPseudo(await render('@/app/(console)/teach/home/page'));
  });

  it('space roster, loading', async () => {
    expectAllPseudo(await render('@/app/(console)/teach/space/page'));
  });

  it('relink, loading', async () => {
    const html = await render('@/app/(console)/teach/space/relink/page');
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expectAllPseudo(html);
  });

  it('plan builder, before the plans load (quest and episode titles are content)', async () => {
    const html = await render('@/app/(console)/teach/space/plan/page');
    expect(html).toContain('href="/teach/space?id=space%3Ac1"');
    expect(html).toContain('type="date"');
    expectAllPseudo(html, [...stage1Episodes.map((e) => e.titleEn), ...stage1Quests.map((q) => q.titleEn)]);
  });

  it('billing, before the plans load', async () => {
    const html = await render('@/app/(console)/teach/billing/page');
    expect(html).toContain('name="promo"');
    expectAllPseudo(html);
  });
});
