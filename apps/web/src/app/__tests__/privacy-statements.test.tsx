import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages, retiredDataPromises } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { siteLocaleParams } from '@/lib/site-locales';
// The pages are imported here, once, not inside each test: a page load pulls in the whole landing graph (i18n
// dictionaries, content schema, design-system art), and inside a test body it counted against the 5 s test
// timeout, which a busy CI runner came close to. Imported at the top, they load while the file is collected.
import * as enAboutPage from '../(en)/about/page';
import * as enLandingPage from '../(en)/page';
import * as enPrivacyPage from '../(en)/privacy/page';
import * as enTermsPage from '../(en)/terms/page';
import * as enLearnersPage from '../(en)/learners/page';
import * as enParentsPage from '../(en)/parents/page';
import * as enTeachersPage from '../(en)/teachers/page';
import * as locAboutPage from '../(loc)/[locale]/about/page';
import * as locLandingPage from '../(loc)/[locale]/page';
import * as locPrivacyPage from '../(loc)/[locale]/privacy/page';
import * as locTermsPage from '../(loc)/[locale]/terms/page';
import * as locLearnersPage from '../(loc)/[locale]/learners/page';
import * as locParentsPage from '../(loc)/[locale]/parents/page';
import * as locTeachersPage from '../(loc)/[locale]/teachers/page';

/**
 * What a visitor reads about where learning data lives, on the pages that are live today: the site
 * (home, About, Privacy, Terms, in English and under every site locale) and the paste-ready launch text
 * (the `/parent` demo left with F-APP-001 A-5b, OD-4).
 *
 * With no sign-in, the learner app sends each learner's nickname, level and avatar to our servers the
 * first time it saves them and backs up their progress when it starts and after each change (F-SYNC-002),
 * and a Rescue Code restores them (F-RESTORE-001). No page may still promise that data stays on the
 * device until someone signs in (the #353 review); the retired wordings are `RETIRED_DATA_PROMISES` in
 * @hangul-route/i18n, and the true sentence is `landing.persona.parents.safe.bullets.backup`
 * (packages/i18n privacy-statements.test.ts ties every message to it).
 */
const BLOCK_END = /<\/(p|li|h[1-6]|td|th|dt|dd|div|section|header|footer|nav|ul|ol|blockquote|figcaption|summary|details|button)>/g;

function decode(text: string): string {
  return text
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function textOf(html: string): string {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

/** The page's text one block per line, so the guard reads each paragraph, item and heading on its own. */
function blocksOf(html: string): string {
  return decode(html.replace(BLOCK_END, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/** A page module, typed by the params its route gives it. */
type PageModule<P> = { default: (props: { params: P }) => JSX.Element };

function html<P>(page: PageModule<P>, params: P): string {
  const Page = page.default;
  return renderToStaticMarkup(<Page params={params} />);
}

/** A page bound to its params, so a list can hold pages whose params differ and the type checker still pairs them. */
const at =
  <P,>(page: PageModule<P>, params: P) =>
  (): string =>
    html(page, params);

const SITE_PAGES: ReadonlyArray<readonly [string, () => string]> = [
  ['/', at(enLandingPage, {})],
  ['/about', at(enAboutPage, {})],
  ['/privacy', at(enPrivacyPage, {})],
  ['/terms', at(enTermsPage, {})],
  ['/learners', at(enLearnersPage, {})],
  ['/parents', at(enParentsPage, {})],
  ['/teachers', at(enTeachersPage, {})],
  ...siteLocaleParams().flatMap(({ locale }) => [
    [`/${locale}`, at(locLandingPage, { locale })] as const,
    [`/${locale}/about`, at(locAboutPage, { locale })] as const,
    [`/${locale}/privacy`, at(locPrivacyPage, { locale })] as const,
    [`/${locale}/terms`, at(locTermsPage, { locale })] as const,
    [`/${locale}/learners`, at(locLearnersPage, { locale })] as const,
    [`/${locale}/parents`, at(locParentsPage, { locale })] as const,
    [`/${locale}/teachers`, at(locTeachersPage, { locale })] as const,
  ]),
];

/** The text of a page that takes no params. */
function render(page: PageModule<Record<string, never>>): string {
  return textOf(html(page, {}));
}

const BACKUP = getMessages('en').landing.persona.parents.safe.bullets.backup;
const BACKUP_FIRST = BACKUP.slice(0, BACKUP.indexOf('.') + 1);

describe('no live page promises that data stays on the device until someone signs in', () => {
  it('covers the site in every locale', () => {
    expect(SITE_PAGES.map(([name]) => name)).toEqual(expect.arrayContaining(['/', '/about', '/privacy', '/es/about', '/ko/privacy']));
  });

  for (const [name, markup] of SITE_PAGES) {
    it(name, () => {
      expect(retiredDataPromises(blocksOf(markup()))).toEqual([]);
    });
  }

  it('reads each block on its own: "backed up" in one paragraph does not excuse a device-only promise in another', () => {
    const page = '<p>Progress is backed up.</p><ul><li>Your progress is saved on your device</li></ul>';
    expect(retiredDataPromises(blocksOf(page))).toEqual(['progress "saved on the device" with no word of the backup']);
    expect(blocksOf(page)).toBe('Progress is backed up.\nYour progress is saved on your device');
  });
});

describe('the pages say what the app does, in the backup sentence', () => {
  it('the backup sentence starts with the backup itself', () => {
    expect(BACKUP_FIRST).toBe(
      "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code.",
    );
  });

  it('About: the promise is the backup', () => {
    expect(render(enAboutPage)).toContain(BACKUP_FIRST);
  });

  it('home: says progress is backed up', () => {
    expect(render(enLandingPage)).toMatch(/backed up/);
  });

  it('Privacy Policy: the short version and "Where your data lives" say every learner is backed up with no sign-in', () => {
    const privacy = render(enPrivacyPage);
    const short = /The short version(.*?)Who creates the account/.exec(privacy)?.[1] ?? '';
    expect(short).toContain(BACKUP_FIRST);
    const where = /Where your data lives(.*?)Payments and subscriptions/.exec(privacy)?.[1] ?? '';
    expect(where).toContain('backed up to our servers (Cloudflare), with no sign-in needed');
    // The profile goes up once; only progress is backed up after each change (no profile-update route, F-LEARN-001 §3.11).
    expect(where).toContain('The first time the app saves a learner, it sends their nickname, level and avatar.');
    expect(where).toContain('It backs up their progress when it starts and after each change');
    expect(where).toContain('If you later change the nickname, level or avatar, the backup keeps the old ones for now');
    expect(where).toContain('restored on a new device with a Rescue Code');
    expect(where).toContain("usage events, such as a finished quest, which can include the learner's id");
    expect(where).toContain('Data in transit is encrypted (HTTPS), and at rest it is access-controlled.');
  });

  it('Privacy Policy: no draft banner (owner decision 2026-10-21 (c)), with the new effective date', () => {
    const privacy = render(enPrivacyPage);
    expect(privacy).not.toContain('pending review by qualified legal counsel');
    expect(privacy).toContain('Effective October 21, 2026');
  });

  it('old home: the trust strip says "Child safety first" (OD-4) and makes no claim about which personal data we hold', () => {
    const home = render(enLandingPage);
    expect(home).toContain('Child safety first');
    expect(home).not.toMatch(/COPPA-compliant|only PII/);
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

  /**
   * The description is pasted for every build, but backup happens only on a build with
   * EXPO_PUBLIC_API_BASE_URL set. While the App Review notes (section 6) still describe a build that sends
   * nothing, the description may not promise a backup or a Rescue Code (App Review 2.3.1).
   */
  it('the description promises no backup the review notes\' build cannot make', () => {
    const notes = listed('6.');
    const description = listed('3.');
    if (/this build sends none|stored on the device only/i.test(notes)) {
      expect(description).not.toMatch(/backed up|backs up|Rescue Code|cloud/i);
    }
    expect(description).toContain('No account needed. No ads. No data sold.');
  });

  // Paste-ready answers for launch day, one paragraph or table row at a time (wrapped lines joined).
  for (const doc of [
    ['docs', 'launch', 'faq.md'],
    ['docs', 'launch', 'maker-comment.md'],
  ] as const) {
    it(doc.join('/'), () => {
      const paragraphs = readFileSync(join(repo, ...doc), 'utf8')
        .split(/\n\s*\n|\n(?=\|)/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .join('\n');
      expect(retiredDataPromises(paragraphs)).toEqual([]);
    });
  }
});

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 6.7 (row SA-4): the Privacy Policy says what a school's administrators can see
 * and do, that accepting needs a verified email, that the owner sees that email, and how long the school history stays.
 * English in every locale (L10): the `/es` and `/ko` pages carry the same English paragraph.
 */
describe('Privacy Policy: school administrators (section 6.7)', () => {
  const PARAGRAPH = getMessages('en').landing.legal.privacy.sections.collect.bullets.schoolAdmins;

  it('names the powers, the verified email, what the owner sees and the 400 days', () => {
    const privacy = render(enPrivacyPage);
    // AMENDMENTS-SITE-NEWUSER SN-2: the owner plus two administrators, said as one number.
    expect(privacy).toContain("A school's owner can add up to two administrators with an invite link, so a school has up to three grown-ups with admin rights.");
    expect(privacy).toContain("except billing: they can open class rosters and reports, move students between the school's classes, remove students from a class, and approve a student's request to link a new device.");
    expect(privacy).toContain('To accept, an administrator needs an account with a verified email.');
    expect(privacy).toContain('The owner sees who is an administrator, with the email they sign in with, when they joined or left, and who renamed the school or one of its classes.');
    expect(privacy).toContain('We keep this history for 400 days.');
  });

  it.each(siteLocaleParams().map(({ locale }) => locale))('/%s/privacy keeps the English paragraph', (locale) => {
    expect(textOf(html(locPrivacyPage, { locale }))).toContain(PARAGRAPH);
  });

  it('says nothing of family or stand-alone class renames being kept', () => {
    expect(PARAGRAPH).not.toMatch(/famil/i);
  });
});
