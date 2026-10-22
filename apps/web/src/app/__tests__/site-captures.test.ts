import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, LOCALE_STATUS } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { ALL_CLAIMS_OFF, ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import {
  CAPTURE_CLAIMS,
  CAPTURE_NAMES,
  PAGE_CAPTURES,
  PAGE_CAPTURE_BUDGET_BYTES,
  captureFile,
  showsCapture,
  type CaptureName,
} from '../../data/site-captures';
import { SITE_CAPTURE_FILES } from '../../data/site-captures.generated';
import { SITE_CLAIMS, showsClaim, type BooleanClaimKey, type SiteClaims } from '../../data/site-claims';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { shownSiteLocales } from '../../lib/site-metadata';
import { CAPTURE_LOCALES, CAPTURE_NAMES as SCRIPT_NAMES, CAPTURE_WIDTHS, hash8, manifestSource, webpSize } from '../../../scripts/site-captures.mjs';

/**
 * [SN] AMENDMENTS-SITE-NEWUSER §3.13 and §3.11: the product captures. Every shown locale has every capture in the
 * manifest and on disk, at the size the manifest says, under the page image budgets; nothing is listed for a hidden
 * locale; and captures follow claims, so no page can draw a feature whose claim is off.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', '..', '..', 'public');
const CAPTURES = join(PUBLIC, 'site', 'captures');
const fileOf = (src: string): string => join(PUBLIC, ...src.split('/').filter(Boolean));

describe('the manifest and the files', () => {
  it('the script and the page module name the same captures, in the same order, at the §3.13 widths', () => {
    expect([...CAPTURE_NAMES]).toEqual(SCRIPT_NAMES);
    expect(CAPTURE_WIDTHS).toEqual({
      discover: 520,
      'discover-narrow': 400,
      home: 400,
      game: 400,
      card: 400,
      report: 600,
      'class-list': 720,
      'class-list-narrow': 600,
      'lecture-slide': 1080,
    });
    expect(CAPTURE_LOCALES).toEqual([...LOCALES]);
  });

  it.each(shownSiteLocales())('%s: every capture is in the manifest and on disk, at its pixel size, named by its content hash', (locale) => {
    for (const name of CAPTURE_NAMES) {
      const file = captureFile(locale, name);
      expect(file, `${locale} ${name}`).not.toBeNull();
      if (!file) continue;
      expect(file.src).toMatch(new RegExp(`^/site/captures/${locale}/${name}\\.[0-9a-f]{8}\\.webp$`));
      const buf = readFileSync(fileOf(file.src));
      expect(webpSize(buf), `${locale} ${name}`).toEqual({ width: file.width, height: file.height });
      expect(file.width, `${locale} ${name}`).toBe(CAPTURE_WIDTHS[name]);
      expect(file.src).toContain(`.${hash8(buf)}.webp`);
    }
  });

  it('no file on disk is missing from the manifest (an old hash left behind would ship for nothing)', () => {
    for (const locale of readdirSync(CAPTURES)) {
      if (!statSync(join(CAPTURES, locale)).isDirectory()) continue;
      const listed = Object.values(SITE_CAPTURE_FILES[locale as (typeof LOCALES)[number]] ?? {}).map((file) => file.src);
      for (const name of readdirSync(join(CAPTURES, locale)).filter((file) => file.endsWith('.webp'))) {
        expect(listed, `${locale}/${name}`).toContain(`/site/captures/${locale}/${name}`);
      }
    }
  });

  // `public/_headers` marks `/site/captures/*` immutable for a year, so only content-hashed files may live there: an
  // unhashed file (a share image, say) would never refresh in a browser or a link-preview cache.
  it('the immutable cache rules cover only content-hashed files', () => {
    const headers = readFileSync(join(PUBLIC, '_headers'), 'utf8').split('\n');
    const immutable = headers
      .map((line, i) => ({ path: line, next: headers[i + 1] ?? '' }))
      .filter(({ path, next }) => /^\//.test(path) && /immutable/.test(next))
      .map(({ path }) => path.trim());
    expect(immutable).toEqual(['/_next/static/*', '/site/captures/*']);
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
    const files = walk(CAPTURES);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file.slice(CAPTURES.length), file).toMatch(/^\/(en|es|ko)\/[a-z-]+\.[0-9a-f]{8}\.webp$/);
  });

  it('nothing is listed for a hidden locale', () => {
    for (const locale of Object.keys(SITE_CAPTURE_FILES)) {
      expect(LOCALES as readonly string[]).toContain(locale);
      expect(LOCALE_STATUS[locale as (typeof LOCALES)[number]], locale).toBe('shipped');
    }
  });

  it('the generated file is what the script writes for the files on disk', () => {
    const source = readFileSync(join(here, '..', '..', 'data', 'site-captures.generated.ts'), 'utf8');
    expect(source).toBe(manifestSource(SITE_CAPTURE_FILES));
  });

  it('a locale without a file renders none (never another locale’s screen)', () => {
    expect(captureFile('en', 'home', { en: {} })).toBeNull();
    expect(captureFile('es', 'home', { en: SITE_CAPTURE_FILES.en })).toBeNull();
  });
});

describe('page image budgets (§3.11: one locale, every <picture> source counted)', () => {
  it('the pages reference only known captures, each page its own', () => {
    const all = Object.values(PAGE_CAPTURES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...CAPTURE_NAMES].sort());
    expect(PAGE_CAPTURE_BUDGET_BYTES).toEqual({ '/': 40 * 1024, '/learners': 70 * 1024, '/parents': 60 * 1024, '/teachers': 80 * 1024 });
  });

  it.each(shownSiteLocales())('%s: every page is within its budget', (locale) => {
    for (const [page, names] of Object.entries(PAGE_CAPTURES) as Array<[keyof typeof PAGE_CAPTURES, readonly CaptureName[]]>) {
      const bytes = names.reduce((sum, name) => {
        const file = captureFile(locale, name);
        return sum + (file ? statSync(fileOf(file.src)).size : 0);
      }, 0);
      expect(bytes, `${locale} ${page}`).toBeLessThanOrEqual(PAGE_CAPTURE_BUDGET_BYTES[page]);
    }
  });
});

describe('captures follow claims', () => {
  it('CAPTURE_CLAIMS names every capture with the claims of what it depicts', () => {
    expect(Object.keys(CAPTURE_CLAIMS).sort()).toEqual([...CAPTURE_NAMES].sort());
    expect(CAPTURE_CLAIMS).toEqual({
      discover: [],
      'discover-narrow': [],
      home: [],
      game: [],
      card: [],
      report: ['parentReports'],
      'class-list': ['teacherReports'],
      'class-list-narrow': ['teacherReports'],
      'lecture-slide': ['lectureMode'],
    });
    expect(Object.isFrozen(CAPTURE_CLAIMS)).toBe(true);
  });

  it('no capture depicts the Learning Route while its claim is off', () => {
    const listed = new Set<BooleanClaimKey>(Object.values(CAPTURE_CLAIMS).flat());
    expect(SITE_CLAIMS.learningRoute).toBe(false);
    expect(listed.has('learningRoute')).toBe(false);
  });

  it.each(LOCALES)('%s: every claim on shows every capture; every claim off shows only the claim-free ones', (locale) => {
    for (const name of CAPTURE_NAMES) {
      expect(showsCapture(ALL_CLAIMS_ON, name, locale), `${locale} ${name}`).toBe(CAPTURE_CLAIMS[name].every((key) => showsClaim(ALL_CLAIMS_ON, key, locale)));
      expect(showsCapture(ALL_CLAIMS_OFF, name, locale), `${locale} ${name}`).toBe(CAPTURE_CLAIMS[name].length === 0);
    }
    expect(CAPTURE_NAMES.filter((name) => showsCapture(ALL_CLAIMS_ON, name, 'en'))).toEqual([...CAPTURE_NAMES]);
  });

  // One claim forced off at a time, on top of today's claims: the capture it gates leaves the rendered page too (the
  // page reads `showsCapture`, so the table above is not the only guard). persona-pages.test.tsx covers every claim
  // off and lectureMode alone.
  const PAGES = { '/parents': ParentsPage, '/teachers': TeachersPage } as const;
  const gated = (Object.entries(PAGE_CAPTURES) as Array<[keyof typeof PAGE_CAPTURES, readonly CaptureName[]]>).flatMap(([page, names]) =>
    page in PAGES ? names.filter((name) => CAPTURE_CLAIMS[name].length > 0).flatMap((name) => CAPTURE_CLAIMS[name].map((key) => ({ page, name, key }))) : [],
  );

  it('the claim-gated captures are the grown-up pages’ ones', () => {
    expect(gated.map(({ name, key }) => `${name}:${key}`)).toEqual([
      'report:parentReports',
      'class-list:teacherReports',
      'class-list-narrow:teacherReports',
      'lecture-slide:lectureMode',
    ]);
  });

  it.each(gated)('$page: with $key off, the $name capture is not shown or referenced', ({ page, name, key }) => {
    const claims: Readonly<SiteClaims> = { ...SITE_CLAIMS, [key]: false };
    for (const locale of shownSiteLocales()) {
      expect(showsCapture(claims, name, locale), `${locale} ${name}`).toBe(false);
      const src = captureFile(locale, name)?.src;
      expect(src, `${locale} ${name}`).toBeDefined();
      const on = renderToStaticMarkup(createElement(PAGES[page as keyof typeof PAGES], { locale, claims: { ...SITE_CLAIMS, [key]: true } }));
      const off = renderToStaticMarkup(createElement(PAGES[page as keyof typeof PAGES], { locale, claims }));
      expect(on, `${locale} ${page} with ${key} on`).toContain(src);
      expect(off, `${locale} ${page} with ${key} off`).not.toContain(src);
    }
  });
});
