import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIDS_ONLY_FRAMING } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { stage1Cards } from '../../data/stage1-cards';

/**
 * Audience copy guard — owner decision 2026-10-09 (audit UF-01..UF-04):
 * Hangul Route is for anyone learning Hangul, at any age. Public surfaces
 * must not frame the product as kids-only or as "ages 5–11".
 *
 * Caregiver-only screens (/parent, /teach) are out of scope: they address
 * parents and teachers, not the learner.
 */
const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..', '..');

const landingComponents = readdirSync(join(webSrc, 'components', 'landing'))
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => join('components', 'landing', name));

// The site's words live in the UI dictionary (F-I18N-001 PR 11a, §3.8): every locale's landing file is a public surface.
const messagesDir = join(webSrc, '..', '..', '..', 'packages', 'i18n', 'src', 'messages');
const landingMessages = readdirSync(messagesDir)
  .filter((locale) => existsSync(join(messagesDir, locale, 'landing.ts')))
  .map((locale) => join('..', '..', '..', 'packages', 'i18n', 'src', 'messages', locale, 'landing.ts'));

const PUBLIC_SURFACES = [
  ...landingMessages,
  // The site's route groups (F-I18N-001 PR 11b): the page bodies are components/landing/*Page.tsx, scanned below.
  join('components', 'SiteDocument.tsx'),
  ...['(en)', join('(loc)', '[locale]')].flatMap((group) => [
    join('app', group, 'layout.tsx'),
    join('app', group, 'page.tsx'),
    join('app', group, 'about', 'page.tsx'),
    join('app', group, 'privacy', 'page.tsx'),
    join('app', group, 'terms', 'page.tsx'),
    join('app', group, 'learners', 'page.tsx'),
    join('app', group, 'parents', 'page.tsx'),
    join('app', group, 'teachers', 'page.tsx'),
  ]),
  join('data', 'landing-copy.ts'),
  // The Stage 1 card blurbs `/learners` shows (F-SITE-002 §3.12, OD-9).
  join('data', 'stage1-cards.ts'),
  ...landingComponents,
];

// One list, shared with the dictionary guard (packages/i18n landing-messages.test.ts), with the
// per-locale equivalents of F-I18N-001 §3.8 for the es / ko landing overlays.

function read(rel: string): string {
  return readFileSync(join(webSrc, rel), 'utf8');
}

describe('public surfaces speak to anyone learning Hangul (UF-01..UF-03, UF-09)', () => {
  it('scans every landing component', () => {
    expect(landingComponents.length).toBeGreaterThanOrEqual(3);
  });

  it('scans the shared page bodies the English and locale routes render', () => {
    for (const body of ['HomePage', 'AboutPage', 'PrivacyPage', 'TermsPage', 'LearnersPage', 'ParentsPage', 'TeachersPage', 'SiteHeader', 'SiteFooter']) {
      expect(PUBLIC_SURFACES).toContain(join('components', 'landing', `${body}.tsx`));
    }
  });

  it('the Stage 1 card blurbs shown on the site name no audience: no kids or children (OD-9)', () => {
    expect(PUBLIC_SURFACES).toContain(join('data', 'stage1-cards.ts'));
    for (const card of stage1Cards) expect(card.blurb, card.id).not.toMatch(/\b(kids?|kid’s|kids’|child|children)\b/i);
  });

  it('scans the English landing messages, where the site copy lives', () => {
    expect(landingMessages.some((rel) => rel.endsWith(join('en', 'landing.ts')))).toBe(true);
    expect(read(join('..', '..', '..', 'packages', 'i18n', 'src', 'messages', 'en', 'landing.ts'))).toContain('Learn Hangul from zero');
  });

  it('the per-locale patterns catch kids-only framing and age ranges (self-check)', () => {
    for (const sample of ['Coreano para niños', 'de 5 a 11 años', '어린이용 한글', '5~11세 어린이']) {
      expect(KIDS_ONLY_FRAMING.some(({ re }) => re.test(sample)), sample).toBe(true);
    }
  });

  for (const rel of PUBLIC_SURFACES) {
    it(`${rel} has no kids-only framing`, () => {
      const source = read(rel);
      const hits = KIDS_ONLY_FRAMING.filter(({ re }) => re.test(source)).map(({ name }) => name);
      expect(hits).toEqual([]);
    });
  }
});

describe('learner PWA manifest (UF-04)', () => {
  // The manifest ships from apps/mobile/public but is public store-facing metadata.
  const manifestPath = join(webSrc, '..', '..', 'mobile', 'public', 'manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    categories?: unknown;
    description?: unknown;
  };

  it('is listed as education only — no "kids" category', () => {
    expect(manifest.categories).toEqual(['education']);
  });

  it('description has no kids-only framing', () => {
    const description = String(manifest.description ?? '');
    const hits = KIDS_ONLY_FRAMING.filter(({ re }) => re.test(description)).map(({ name }) => name);
    expect(hits).toEqual([]);
  });

  // app-first-run (2026-10-21): "Works offline" now says "on most devices" (an in-app browser or a private window may
  // not keep the app), and the install sizes browsers ask for first (192 and 512 px, "any") sit beside the 1024 px one.
  it('says where it works offline, and lists 192, 512 and 1024 px icons that exist', () => {
    expect(manifest.description).toBe('Learn the Korean alphabet with Hoya the tiger, one heritage card at a time. Works offline on most devices.');
    const icons = (manifest as { icons?: { src: string; sizes: string; purpose?: string }[] }).icons ?? [];
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '1024x1024']);
    for (const icon of icons) {
      expect(icon.purpose).toBe('any');
      expect(existsSync(join(webSrc, '..', '..', 'mobile', 'public', icon.src.replace(/^\//, ''))), icon.src).toBe(true);
    }
  });
});

describe('learner PWA shell meta description (pwa-postbuild.mjs)', () => {
  // `expo export` writes a bare index.html; apps/mobile/scripts/pwa-postbuild.mjs injects
  // the <meta name="description"> that search engines and link previews show for
  // app.hangulroute.com. It is public metadata like the manifest above.
  const scriptPath = join(webSrc, '..', '..', 'mobile', 'scripts', 'pwa-postbuild.mjs');
  const description = /<meta name="description" content="([^"]*)"/.exec(readFileSync(scriptPath, 'utf8'))?.[1] ?? '';

  it('is found in the script (so this guard cannot pass by scanning nothing)', () => {
    expect(description.length).toBeGreaterThan(20);
  });

  it('has no kids-only framing or age range', () => {
    const hits = KIDS_ONLY_FRAMING.filter(({ re }) => re.test(description)).map(({ name }) => name);
    expect(hits).toEqual([]);
  });

  it('never says "child", "children" or "kids"', () => {
    expect(description).not.toMatch(/\bchild(ren)?\b|\bkids?\b/i);
  });
});

describe('App Store listing (UF-11, App Review 2.3.8 / 5.1.4)', () => {
  // Public store metadata: outside the Kids Category it must not suggest that
  // children are the main audience. The App Review notes (section 6) may say
  // "many learners are children" — they are not public.
  const metadataPath = join(webSrc, '..', '..', '..', 'docs', 'launch', 'app-store-metadata.md');
  const metadata = readFileSync(metadataPath, 'utf8');

  function listed(headingPrefix: string): string {
    const section = metadata.split(/^## /m).find((part) => part.startsWith(headingPrefix));
    const block = /```[^\n]*\n([\s\S]*?)```/.exec(section ?? '');
    if (!block?.[1]) throw new Error(`no code block under "## ${headingPrefix}" in app-store-metadata.md`);
    return block[1];
  }

  const PUBLIC_FIELDS: ReadonlyArray<[string, string]> = [
    ['promotional text', '2.'],
    ['description', '3.'],
    ['keywords', '4.'],
  ];

  for (const [label, prefix] of PUBLIC_FIELDS) {
    it(`the ${label} never says "child", "children" or "kids"`, () => {
      expect(listed(prefix)).not.toMatch(/\bchild(ren)?\b|\bkids?\b/i);
    });

    it(`the ${label} has no kids-only framing or age range`, () => {
      const text = listed(prefix);
      expect(KIDS_ONLY_FRAMING.filter(({ re }) => re.test(text)).map(({ name }) => name)).toEqual([]);
    });
  }

  it('the description fits the 4000-character App Store limit', () => {
    expect(listed('3.').trim().length).toBeLessThanOrEqual(4000);
  });
});
