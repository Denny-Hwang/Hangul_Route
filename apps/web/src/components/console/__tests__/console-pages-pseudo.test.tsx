import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * F-I18N-001 PR 10a, §3.11: the migrated console pages take every word from the
 * dictionary. Rendered in the pseudo-locale (en-XA), every text node and every
 * labelled attribute is bracketed pseudo text; an English literal left in a page
 * would show up unbracketed here. Effects do not run in a server render, so this
 * covers each page's first paint; the dictionary tests cover the rest.
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

const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Text nodes and labelled attribute values that contain a letter, data removed and edge punctuation (· ←) trimmed. */
function wordsOf(html: string, data: readonly string[]): string[] {
  const texts = html
    .replace(/<!-- -->/g, '')
    .split(/<[^>]+>/)
    .map(decode);
  const attrs = [...html.matchAll(/ (?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((match) => decode(match[1] ?? ''));
  return [...texts, ...attrs]
    .map((t) => data.reduce((acc, d) => acc.split(d).join(''), t).replace(/^[^[A-Za-z]+|[^\]A-Za-z]+$/g, ''))
    .filter((t) => /[A-Za-z]/.test(t));
}

function expectAllPseudo(html: string, data: readonly string[] = []): void {
  const words = wordsOf(html, data);
  expect(words.length).toBeGreaterThan(3);
  for (const w of words) expect(w, `"${w}" is not from the dictionary`).toMatch(/^\[[^\]]*\]$/);
}

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
});
