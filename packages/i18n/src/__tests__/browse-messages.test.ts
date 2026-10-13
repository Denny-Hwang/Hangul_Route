import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.5, 4.7 and 6; OD-8; mocks
 * design/screens/browse/access.md and preview-frame.md): the All lessons root's
 * first strings. One name everywhere, "Browse" in no UI string, no price, no
 * "Premium", no age, and no Hangul in English (rule 5). BR-7 to BR-9 add the
 * rest of `caregiver.browse`.
 */
const browse = getMessages('en').caregiver.browse;

describe('caregiver.browse (BR-6)', () => {
  it('names the tab, the page and the preview strip as OD-8 says', () => {
    expect(browse.documentTitle).toBe('Hangul Route lessons');
    expect(browse.home.title).toBe('All lessons');
    expect(browse.home.close.cta).toBe('Close');
    expect(browse.home.howTo).toBe('Tap a lesson to see what it teaches, then play it. Nothing is saved.');
    expect(browse.preview.strip).toBe('Preview. Nothing is saved.');
    expect(browse.preview.leave.cta).toBe('Leave preview');
  });

  it('has the Access screen of section 4.3: title, a line per source, the pre-BR-12b gate line and every action', () => {
    expect(browse.access.title).toBe('This page is for parents and teachers.');
    expect(browse.access.line).toEqual({
      gate: 'Your time in the grown-up area ended.',
      gateUntilIntent: 'Your time in the grown-up area ended. Go back to the app, then open the grown-up area again.',
      account: 'Open lessons again from your account.',
      unknown: 'On a family device, open them from the grown-up area. Parents and teachers can also open them from their account.',
    });
    expect(browse.access.backToGrownUp.cta).toBe('Back to the grown-up area');
    expect(browse.access.backToApp.cta).toBe('Back to the app');
    expect(browse.access.openFromAccount.cta).toBe('Open lessons from my account');
    expect(browse.access.signIn.cta).toBe('Sign in');
    expect(browse.access.offline).toBe('Grown-up pages need the internet.');
  });

  it('holds exactly these keys', () => {
    expect(leafPaths(browse).sort()).toEqual(
      [
        'access.backToApp.cta',
        'access.backToGrownUp.cta',
        'access.line.account',
        'access.line.gate',
        'access.line.gateUntilIntent',
        'access.line.unknown',
        'access.offline',
        'access.openFromAccount.cta',
        'access.signIn.cta',
        'access.title',
        'documentTitle',
        'home.close.cta',
        'home.howTo',
        'home.title',
        'preview.leave.cta',
        'preview.strip',
      ].sort(),
    );
  });

  it('passes the caregiver ban list and the spec list; no "Browse", no age, no price, no Hangul', () => {
    for (const path of leafPaths(browse)) {
      const s = String(lookup(browse, path));
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s, path).not.toMatch(/browse|\bkids?\b|premium|upgrade|unlock|\bfail|wrong|behind|\$|\d+\s*[-–]\s*\d+/i);
      expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });
});

/**
 * F-BROWSE-001 BR-10 (sections 4.3, 4.11, 6): the console strings beside an entry and the deep-link buttons, in
 * English, Spanish and Korean; the navigation label is `console.shell.nav.lessons`.
 */
describe('console.browse (BR-10)', () => {
  const consoleBrowse = getMessages('en').console.browse;

  it('says what section 4.3 says: the failed check, its two actions and the blocked storage line', () => {
    expect(consoleBrowse.checkFailed).toBe('Could not check your plan.');
    expect(consoleBrowse.tryAgain.cta).toBe('Try again');
    expect(consoleBrowse.openFree.cta).toBe('Open free lessons');
    expect(consoleBrowse.storageBlocked).toBe("Your browser blocked this page's storage, so lessons cannot open here.");
    expect(consoleBrowse.preview.cta).toBe('Preview');
    expect(consoleBrowse.previewLessons.cta).toBe('Preview lessons');
    expect(getMessages('en').console.shell.nav.lessons).toBe('Lessons');
  });

  it('holds exactly these keys, each with its Spanish and Korean value', () => {
    const paths = leafPaths(consoleBrowse).sort();
    expect(paths).toEqual(['checkFailed', 'openFree.cta', 'preview.cta', 'previewLessons.cta', 'storageBlocked', 'tryAgain.cta']);
    for (const locale of ['es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of paths) expect(String(lookup(local, path)), `${locale} ${path}`).not.toBe(String(lookup(consoleBrowse, path)));
      expect(getMessages(locale).console.shell.nav.lessons, locale).not.toBe('Lessons');
    }
  });

  it('passes the caregiver ban list in every locale; no "Browse", no age, no price, no lock word, no Hangul in English', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of leafPaths(local)) {
        const s = String(lookup(local, path));
        expect(findBannedWord(s, locale, 'caregiver'), `${locale} ${path}: ${s}`).toBeNull();
        expect(s, `${locale} ${path}`).not.toMatch(/\bbrowse\b|\bkids?\b|premium|upgrade|unlock|\$|\d/i);
        if (locale === 'en') {
          for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
          expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
        }
      }
    }
  });
});
