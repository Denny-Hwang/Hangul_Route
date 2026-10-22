import { readFileSync, readdirSync, statSync } from 'node:fs';
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
import { SITE_CLAIMS, showsClaim, type BooleanClaimKey } from '../../data/site-claims';
import { shownSiteLocales } from '../../lib/site-metadata';
import { CAPTURE_LOCALES, CAPTURE_NAMES as SCRIPT_NAMES, CAPTURE_WIDTHS, hash8, manifestSource, webpSize } from '../../../scripts/site-captures.mjs';

/**
 * [SN] AMENDMENTS-SITE-NEWUSER §3.13 and §3.11: the product captures. Every shown locale has every capture in the
 * manifest and on disk, at the size the manifest says, under the page image budgets; nothing is listed for a hidden
 * locale; and captures follow claims, so no page can draw a feature whose claim is off.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', '..', '..', 'public');
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
      expect(file.src).toMatch(new RegExp(`^/site/${locale}/${name}\\.[0-9a-f]{8}\\.webp$`));
      const buf = readFileSync(fileOf(file.src));
      expect(webpSize(buf), `${locale} ${name}`).toEqual({ width: file.width, height: file.height });
      expect(file.width, `${locale} ${name}`).toBe(CAPTURE_WIDTHS[name]);
      expect(file.src).toContain(`.${hash8(buf)}.webp`);
    }
  });

  it('no file on disk is missing from the manifest (an old hash left behind would ship for nothing)', () => {
    for (const locale of readdirSync(join(PUBLIC, 'site'))) {
      if (!statSync(join(PUBLIC, 'site', locale)).isDirectory()) continue;
      const listed = Object.values(SITE_CAPTURE_FILES[locale as (typeof LOCALES)[number]] ?? {}).map((file) => file.src);
      for (const name of readdirSync(join(PUBLIC, 'site', locale)).filter((file) => file.endsWith('.webp'))) {
        expect(listed, `${locale}/${name}`).toContain(`/site/${locale}/${name}`);
      }
    }
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

  it.each(LOCALES)('%s: a capture shows only when every claim it lists shows (today, every claim on, every claim off)', (locale) => {
    for (const claims of [SITE_CLAIMS, ALL_CLAIMS_ON, ALL_CLAIMS_OFF]) {
      for (const name of CAPTURE_NAMES) {
        const expected = CAPTURE_CLAIMS[name].every((key) => showsClaim(claims, key, locale));
        expect(showsCapture(claims, name, locale), `${locale} ${name}`).toBe(expected);
      }
    }
    for (const name of CAPTURE_NAMES) {
      expect(showsCapture(ALL_CLAIMS_OFF, name, locale)).toBe(CAPTURE_CLAIMS[name].length === 0);
    }
  });

  it('a capture whose listed claim is false in SITE_CLAIMS is not shown with today’s claims', () => {
    for (const name of CAPTURE_NAMES) {
      const off = CAPTURE_CLAIMS[name].some((key) => !SITE_CLAIMS[key]);
      if (off) for (const locale of LOCALES) expect(showsCapture(SITE_CLAIMS, name, locale), `${locale} ${name}`).toBe(false);
    }
  });
});
