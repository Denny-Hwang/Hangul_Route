import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages, retiredDataPromises } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mockFamily } from '@/data/mock-family';
import { siteLocaleParams } from '@/lib/site-locales';

/**
 * What a visitor reads about where learning data lives, on the pages that are live today: the site
 * (home, About, Privacy, Terms, in English and under every site locale) and the `/parent` demo.
 *
 * The learner app backs up every learner's nickname, level, avatar and progress to our servers when it
 * starts and after each change, with no sign-in (F-SYNC-002), and a Rescue Code restores them
 * (F-RESTORE-001). No page may still promise that data stays on the device until someone signs in
 * (the #353 review); the retired wordings are `RETIRED_DATA_PROMISES` in @hangul-route/i18n, and the
 * true sentence is `landing.persona.parents.safe.bullets.backup` (packages/i18n privacy-statements.test.ts
 * ties every message to it).
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

type Params = Readonly<Record<string, string>>;

const SITE_PAGES: ReadonlyArray<readonly [string, string, Params?]> = [
  ['/', '../(en)/page'],
  ['/about', '../(en)/about/page'],
  ['/privacy', '../(en)/privacy/page'],
  ['/terms', '../(en)/terms/page'],
  ...siteLocaleParams().flatMap(({ locale }) =>
    (
      [
        ['', '../(loc)/[locale]/page'],
        ['/about', '../(loc)/[locale]/about/page'],
        ['/privacy', '../(loc)/[locale]/privacy/page'],
        ['/terms', '../(loc)/[locale]/terms/page'],
      ] as const
    ).map(([suffix, path]) => [`/${locale}${suffix}`, path, { locale }] as const),
  ),
];

const PARENT_PAGES: ReadonlyArray<readonly [string, string, Params?]> = [
  ['/parent', '../(console)/parent/page'],
  ...mockFamily().profiles.map((p) => [`/parent/${p.slug}`, '../(console)/parent/[childId]/page', { childId: p.slug }] as const),
];

async function render(path: string, params: Params = {}): Promise<string> {
  const mod = (await import(path)) as { default: (props: { params: Params }) => JSX.Element };
  const Page = mod.default;
  return textOf(renderToStaticMarkup(<Page params={params} />));
}

const BACKUP = getMessages('en').landing.persona.parents.safe.bullets.backup;
const BACKUP_FIRST = BACKUP.slice(0, BACKUP.indexOf('.') + 1);

describe('no live page promises that data stays on the device until someone signs in', () => {
  it('covers the site in every locale and the /parent demo', () => {
    expect(SITE_PAGES.map(([name]) => name)).toEqual(expect.arrayContaining(['/', '/about', '/privacy', '/es/about', '/ko/privacy']));
    expect(PARENT_PAGES.length).toBeGreaterThan(1);
  });

  for (const [name, path, params] of [...SITE_PAGES, ...PARENT_PAGES]) {
    it(name, async () => {
      expect(retiredDataPromises(await render(path, params))).toEqual([]);
    });
  }
});

describe('the pages say what the app does, in the backup sentence', () => {
  it('the backup sentence starts with the backup itself', () => {
    expect(BACKUP_FIRST).toBe(
      "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code.",
    );
  });

  it('About: the promise is the backup', async () => {
    expect(await render('../(en)/about/page')).toContain(BACKUP_FIRST);
  });

  it('home: says progress is backed up', async () => {
    expect(await render('../(en)/page')).toMatch(/backed up/);
  });

  it('Privacy Policy: the short version and "Where your data lives" say every learner is backed up with no sign-in', async () => {
    const privacy = await render('../(en)/privacy/page');
    const short = /The short version(.*?)Who creates the account/.exec(privacy)?.[1] ?? '';
    expect(short).toContain(BACKUP_FIRST);
    const where = /Where your data lives(.*?)Payments and subscriptions/.exec(privacy)?.[1] ?? '';
    expect(where).toContain("The app backs up each learner's nickname, level, avatar and progress when it starts and after each change, with no sign-in needed");
    expect(where).toContain('restored on a new device with a Rescue Code');
    expect(where).toContain("usage events, such as a finished quest, which can include the learner's id");
    expect(where).toContain('Data in transit is encrypted (HTTPS), and at rest it is access-controlled.');
  });

  it('Privacy Policy: stays a draft for counsel, with the new effective date', async () => {
    const privacy = await render('../(en)/privacy/page');
    expect(privacy).toContain('pending review by qualified legal counsel');
    expect(privacy).toContain('Effective October 12, 2026');
  });

  it('/parent demo: the privacy list leads with the backup sentence', async () => {
    expect(await render('../(console)/parent/page')).toContain(BACKUP);
  });
});

describe('public store-facing text makes no retired data promise', () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
  const metadata = readFileSync(join(repo, 'docs', 'launch', 'app-store-metadata.md'), 'utf8');

  /** The paste-ready code block under `## <prefix>` of the App Store listing. */
  function listed(prefix: string): string {
    const section = metadata.split(/^## /m).find((part) => part.startsWith(prefix));
    const block = /```[^\n]*\n([\s\S]*?)```/.exec(section ?? '');
    if (!block?.[1]) throw new Error(`no code block under "## ${prefix}" in app-store-metadata.md`);
    return block[1];
  }

  // The public listing fields. The App Review notes (section 6) describe one submission build and are not public.
  for (const [label, prefix] of [
    ['promotional text', '2.'],
    ['description', '3.'],
    ['keywords', '4.'],
    ["what's new", '7.'],
  ] as const) {
    it(`App Store ${label}`, () => {
      expect(retiredDataPromises(listed(prefix))).toEqual([]);
    });
  }

  it('the PWA manifest description', () => {
    const manifest = JSON.parse(readFileSync(join(repo, 'apps', 'mobile', 'public', 'manifest.webmanifest'), 'utf8')) as { description?: unknown };
    expect(retiredDataPromises(String(manifest.description ?? ''))).toEqual([]);
  });
});
