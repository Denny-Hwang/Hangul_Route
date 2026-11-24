import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors, layout, presenter, spacing, typography, z } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { Roster, SpaceListItem } from '../api';
import {
  addressNamesClassPage,
  codeOverlayFlagged,
  forgetCodeOverlay,
  rememberCodeOverlay,
  CLASS_CODE_OVERLAY_CSS,
  CODE_LETTER_SPACING_EM,
  CODE_OVERLAY_ATTR,
  CODE_OVERLAY_FLAG,
  CODE_WIDTH_EM,
  QR_CAPTION_LINES,
  codeOverlayShown,
  codeOverlayView,
  returnFocusTarget,
  spokenCode,
  type CodeOverlaySource,
} from '../class-code-overlay';
import { codeExpiry } from '../rollup';
import { rosterJoinLink } from '../join-link';
import { isCaregiverSafe } from '../banned-text';

/**
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-1 (section 3.1, 3.2, 3.4, 3.6; tests section 6 item 1 and 8): when the class page
 * offers Show the code, what the overlay's model holds (the class name, the code and the join link, never a learner),
 * and the layout constants the one-line fit and the print rule depend on.
 */
const NOW = new Date('2026-11-24T09:00:00.000Z');
const ORIGIN = 'https://app.hangulroute.com';
const space = (over: Partial<CodeOverlaySource['space']> = {}): CodeOverlaySource['space'] => ({ name: 'Sunday Class A', kind: 'class', archivedAt: null, ...over });
const source = (over: Partial<CodeOverlaySource> = {}): CodeOverlaySource => ({ space: space(), joinCode: 'SUN234', joinCodeExpiresAt: '2026-12-12T09:00:00.000Z', ...over });

describe('codeOverlayShown (3.1)', () => {
  it('a class with a live code shows the entry', () => {
    expect(codeOverlayShown(source(), NOW)).toBe(true);
  });

  it('a family and a school never do', () => {
    expect(codeOverlayShown(source({ space: space({ kind: 'family' }) }), NOW)).toBe(false);
    expect(codeOverlayShown(source({ space: space({ kind: 'school' }) }), NOW)).toBe(false);
  });

  it('no code, no expiry, an expiry equal to now and one in the past: no entry', () => {
    expect(codeOverlayShown(source({ joinCode: null }), NOW)).toBe(false);
    expect(codeOverlayShown(source({ joinCodeExpiresAt: null }), NOW)).toBe(false);
    expect(codeOverlayShown(source({ joinCodeExpiresAt: NOW.toISOString() }), NOW)).toBe(false);
    expect(codeOverlayShown(source({ joinCodeExpiresAt: '2026-11-23T09:00:00.000Z' }), NOW)).toBe(false);
    expect(codeOverlayShown(source({ joinCodeExpiresAt: 'not a date' }), NOW)).toBe(false);
  });

  it('an archived class: no entry', () => {
    expect(codeOverlayShown(source({ space: space({ archivedAt: '2026-11-01T00:00:00.000Z' }) }), NOW)).toBe(false);
  });

  it('a Roster and a SpaceListItem are both accepted as the source', () => {
    const view = { id: 'space:a', kind: 'class' as const, name: 'A', parentSpaceId: null, settings: { consentMode: 'parent' as const, anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' };
    const roster: Roster = { space: view, learners: [], joinCode: 'SUN234', joinCodeExpiresAt: '2026-12-12T09:00:00.000Z' };
    const item: SpaceListItem = { space: view, role: 'owner', counts: { learners: 0, accounts: 1, classes: 0 }, joinCode: 'SUN234', joinCodeExpiresAt: '2026-12-12T09:00:00.000Z' };
    expect(codeOverlayShown(roster, NOW)).toBe(true);
    expect(codeOverlayShown(item, NOW)).toBe(true);
    expect(codeOverlayView(roster, NOW, 'en', ORIGIN)?.code).toBe('SUN234');
    expect(codeOverlayView(item, NOW, 'en', ORIGIN)?.code).toBe('SUN234');
  });
});

describe('codeOverlayView (3.2)', () => {
  it('its keys are exactly the seven parts, and nothing else', () => {
    const view = codeOverlayView(source(), NOW, 'en', ORIGIN);
    expect(view && Object.keys(view).sort()).toEqual(['code', 'codeLabel', 'expiry', 'howToJoin', 'joinLink', 'spaceName', 'spokenCode']);
  });

  it('is null when the entry is not shown', () => {
    expect(codeOverlayView(source({ joinCode: null }), NOW, 'en', ORIGIN)).toBeNull();
    expect(codeOverlayView(source({ space: space({ kind: 'family' }) }), NOW, 'en', ORIGIN)).toBeNull();
  });

  it('the class name, the caption, the spoken code, the expiry, the join line and the join link', () => {
    for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
      const m = getMessages(locale);
      const view = codeOverlayView(source(), NOW, locale, ORIGIN);
      expect(view).toEqual({
        spaceName: 'Sunday Class A',
        codeLabel: m.console.space.codeLabel.class,
        code: 'SUN234',
        spokenCode: 'S U N 2 3 4',
        expiry: codeExpiry('2026-12-12T09:00:00.000Z', NOW, locale),
        howToJoin: m.console.space.codeOverlay.howToJoin(m.caregiver.spaces.join.cta),
        joinLink: rosterJoinLink({ kind: 'class', code: 'SUN234', origin: ORIGIN }),
      });
    }
    expect(codeOverlayView(source(), NOW, 'en', ORIGIN)?.expiry).toBe('expires in 18 days');
    expect(codeOverlayView(source(), NOW, 'en', ORIGIN)?.howToJoin).toBe('Tap “Join a class” in Hangul Route and type this code.');
    expect(codeOverlayView(source(), NOW, 'en', ORIGIN)?.joinLink).toBe('https://app.hangulroute.com/join#c=SUN234');
  });

  it('spokenCode puts a space between the characters', () => {
    expect(spokenCode('SUN234')).toBe('S U N 2 3 4');
    expect(spokenCode('')).toBe('');
  });

  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: a roster of learners with awkward names, with and without initials, reaches the view as nothing', (locale) => {
    const learners = [
      { displayName: '김민호', alias: 'ㄱ.', jamo: ['ㅂ', 'ㅅ'], vocab: 'vocab:apple' },
      { displayName: "Zoë O'Neil-Núñez", alias: 'Z. O.', jamo: ['ㄱ'], vocab: 'vocab:eye' },
      { displayName: 'Mina Kim', alias: 'M. K.', jamo: ['ㅁ'], vocab: 'vocab:rice' },
    ];
    for (const anonymizeRoster of [false, true]) {
      // The model takes the space and its code; a roster passed whole still yields only those seven parts.
      const roster = {
        space: { id: 'space:a', kind: 'class' as const, name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent' as const, anonymizeRoster }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
        learners: learners.map((l, i) => ({
          id: `profile:${i}`,
          displayName: anonymizeRoster ? l.alias : l.displayName,
          ageGroup: '5-7',
          avatar: 'tiger',
          joinedAt: '2026-09-02T00:00:00.000Z',
          lastActiveAt: null,
          lastSyncedAt: null,
          summary: { needsPractice: l.jamo, vocabRevisit: [l.vocab] },
        })),
        joinCode: 'SUN234',
        joinCodeExpiresAt: '2026-12-12T09:00:00.000Z',
      };
      const text = JSON.stringify(codeOverlayView(roster as unknown as Roster, NOW, locale, ORIGIN));
      for (const l of learners) {
        expect(text).not.toContain(l.displayName);
        expect(text).not.toContain(l.alias);
        expect(text).not.toContain(l.vocab);
        for (const jamo of l.jamo) expect(text).not.toContain(jamo);
      }
      expect(text).not.toContain('needsPractice');
      expect(text).not.toContain('displayName');
    }
  });
});

describe('the layout constants are pinned (3.4)', () => {
  it('CODE_WIDTH_EM is 4.8 and QR_CAPTION_LINES is 3', () => {
    expect(CODE_WIDTH_EM).toBe(4.8);
    expect(QR_CAPTION_LINES).toBe(3);
  });

  it('the letter spacing is spacing.xl for every presenter.size.display of code size, and six letters with seven spaces fit CODE_WIDTH_EM', () => {
    expect(CODE_LETTER_SPACING_EM).toBe(spacing.xl / presenter.size.display);
    // Six monospace characters at the 0.6 em advance of Menlo and Courier, plus seven letter spaces, rounded up to the constant.
    expect(6 * 0.6 + 7 * CODE_LETTER_SPACING_EM).toBeLessThanOrEqual(CODE_WIDTH_EM);
    expect(6 * 0.6 + 7 * CODE_LETTER_SPACING_EM).toBeGreaterThan(CODE_WIDTH_EM - 0.5);
  });

  it('the one-line fit divides the column by CODE_WIDTH_EM, and the letter spacing is that share of the size', () => {
    expect(CLASS_CODE_OVERLAY_CSS).toContain(`calc(100cqi / ${CODE_WIDTH_EM})`);
    expect(CLASS_CODE_OVERLAY_CSS).toContain(`calc(1em * ${spacing.xl} / ${presenter.size.display})`);
  });
});

describe('the overlay CSS (3.3, 3.4)', () => {
  const css = CLASS_CODE_OVERLAY_CSS;

  it('prints the overlay only: the inert page behind leaves the print, Close is not printed', () => {
    expect(css).toContain('@media print{');
    expect(css).toContain(`html[${CODE_OVERLAY_ATTR}]{overflow:visible!important}`);
    expect(css).toContain(`html[${CODE_OVERLAY_ATTR}] [inert]{display:none!important}`);
    expect(css).toContain('position:static');
    expect(css).toContain('print-color-adjust:exact');
    expect(css).toMatch(/\.hr-co-close\{display:none/);
  });

  it('two columns on a landscape window from layout.breakpoint.regular, in px', () => {
    expect(css).toContain(`@media (orientation:landscape) and (min-width:${layout.breakpoint.regular}px)`);
    expect(css).not.toContain(`min-width:${layout.breakpoint.regular / 16}em`);
  });

  it('is opaque and over the window: fixed, inset 0, z.modal, surface.paper, no scrim, no motion', () => {
    expect(css).toContain('position:fixed;inset:0');
    expect(css).toContain(`z-index:${z.modal}`);
    expect(css).toContain(`background:${colors.surface.paper}`);
    expect(css).not.toContain('transition');
    expect(css).not.toContain('animation');
    expect(css).not.toContain('box-shadow');
  });

  it('the code is mono, bold, on one line; the text colours are primary and secondary, never muted or a feedback colour', () => {
    expect(css).toContain(`font-family:${typography.family.mono}`);
    expect(css).toContain(`font-weight:${typography.weight.bold}`);
    expect(css).toContain('white-space:nowrap');
    expect(css).toContain(colors.text.primary);
    expect(css).toContain(colors.text.secondary);
    expect(css).not.toContain(colors.text.muted);
    for (const value of Object.values(colors.feedback)) expect(css).not.toContain(String(value));
  });

  it('holds no colour literal of its own: every colour is a token value', () => {
    const tokenValues = (function leaves(node: unknown): string[] {
      if (typeof node === 'string') return [node];
      if (node && typeof node === 'object') return Object.values(node).flatMap(leaves);
      return [];
    })(colors);
    let rest = CLASS_CODE_OVERLAY_CSS;
    for (const value of tokenValues.sort((a, b) => b.length - a.length)) rest = rest.split(value).join('');
    expect(rest.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(?:white|black|red|blue|green|gray|grey)(?![-\w])/)?.[0] ?? null).toBeNull();
    const code = readFileSync(join(__dirname, '..', 'class-code-overlay.ts'), 'utf8');
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('the page behind does not scroll: the root attribute and the print rule share one name', () => {
    expect(CODE_OVERLAY_ATTR).toBe('data-hr-code-overlay');
  });
});

describe('the reopen flag (3.6)', () => {
  const store = (): { items: Record<string, string>; area: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } } => {
    const items: Record<string, string> = {};
    return { items, area: { getItem: (k) => items[k] ?? null, setItem: (k, v) => void (items[k] = v), removeItem: (k) => void delete items[k] } };
  };

  it('is one session key that holds the space id only', () => {
    expect(CODE_OVERLAY_FLAG).toBe('hr:console:codeOverlay');
    const s = store();
    rememberCodeOverlay(s.area, 'space:sunday');
    expect(s.items).toEqual({ 'hr:console:codeOverlay': 'space:sunday' });
  });

  it('reaches storage only through the guarded wrapper (CLAUDE.md section 8): no direct getItem, setItem, removeItem, localStorage or sessionStorage', () => {
    const code = readFileSync(join(__dirname, '..', 'class-code-overlay.ts'), 'utf8');
    expect(code).toContain("from '../i18n/safe-storage'");
    expect(code).not.toMatch(/\.(?:getItem|setItem|removeItem)\(|localStorage|sessionStorage/);
  });

  it('names a space only when it holds that space\'s id; forgetting removes it', () => {
    const s = store();
    expect(codeOverlayFlagged(s.area, 'space:sunday')).toBe(false);
    rememberCodeOverlay(s.area, 'space:sunday');
    expect(codeOverlayFlagged(s.area, 'space:sunday')).toBe(true);
    expect(codeOverlayFlagged(s.area, 'space:other')).toBe(false);
    expect(codeOverlayFlagged(s.area, '')).toBe(false);
    forgetCodeOverlay(s.area);
    expect(codeOverlayFlagged(s.area, 'space:sunday')).toBe(false);
  });

  it('no storage, or storage that throws, is never an error and never a reopen', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(codeOverlayFlagged(null, 'space:sunday')).toBe(false);
    expect(codeOverlayFlagged(broken, 'space:sunday')).toBe(false);
    expect(() => rememberCodeOverlay(null, 'space:sunday')).not.toThrow();
    expect(() => rememberCodeOverlay(broken, 'space:sunday')).not.toThrow();
    expect(() => forgetCodeOverlay(null)).not.toThrow();
    expect(() => forgetCodeOverlay(broken)).not.toThrow();
  });

  it('the address names this class page only on /teach/space with this id (a lock keeps it, a navigation does not)', () => {
    expect(addressNamesClassPage({ pathname: '/teach/space', search: '?id=space%3Asunday' }, 'space:sunday')).toBe(true);
    expect(addressNamesClassPage({ pathname: '/teach/space/', search: '?id=space%3Asunday' }, 'space:sunday')).toBe(true);
    expect(addressNamesClassPage({ pathname: '/teach/space.html', search: '?id=space%3Asunday' }, 'space:sunday')).toBe(true);
    expect(addressNamesClassPage({ pathname: '/teach/space', search: '?id=space%3Aother' }, 'space:sunday')).toBe(false);
    expect(addressNamesClassPage({ pathname: '/teach/space/plan', search: '?id=space%3Asunday' }, 'space:sunday')).toBe(false);
    expect(addressNamesClassPage({ pathname: '/teach/home', search: '' }, 'space:sunday')).toBe(false);
    expect(addressNamesClassPage({ pathname: '/teach/space', search: '' }, '')).toBe(false);
    expect(addressNamesClassPage(null, 'space:sunday')).toBe(false);
  });
});

describe('returnFocusTarget (3.3)', () => {
  const node = (isConnected?: boolean): { isConnected?: boolean; focus: () => void } => ({ ...(isConnected === undefined ? {} : { isConnected }), focus: () => undefined });

  it('the opener when it is connected, else the page head, else the error panel, else nothing', () => {
    const opener = node(true);
    const head = node(true);
    const error = node(true);
    expect(returnFocusTarget([opener, head, error])).toBe(opener);
    expect(returnFocusTarget([node(false), head, error])).toBe(head);
    expect(returnFocusTarget([null, head, error])).toBe(head);
    expect(returnFocusTarget([null, node(false), error])).toBe(error);
    expect(returnFocusTarget([null, null, null])).toBeNull();
    expect(returnFocusTarget([null, null, node(false)])).toBeNull();
  });

  it('a node that cannot take focus is skipped, and a node without isConnected counts as connected', () => {
    const connectedUnknown = node();
    expect(returnFocusTarget([{ isConnected: true } as never, connectedUnknown])).toBe(connectedUnknown);
    expect(returnFocusTarget([connectedUnknown])).toBe(connectedUnknown);
  });
});

describe('copy (8)', () => {
  it.each(['en', 'es', 'ko'] as UiLocale[])('%s: the new strings are caregiver-safe and inside the button budget', (locale) => {
    const words = getMessages(locale).console.space.codeOverlay;
    const join = getMessages(locale).caregiver.spaces.join.cta;
    for (const text of [words.open.cta, words.howToJoin(join)]) {
      expect(isCaregiverSafe(text, locale), text).toBe(true);
      expect(text.trim()).toBe(text);
      expect(text.length).toBeGreaterThan(0);
    }
    // The 28-character cta budget of packages/i18n length-budget.test.ts.
    expect(words.open.cta.length).toBeLessThanOrEqual(28);
  });

  it('the join line is the presenter\'s own words in every locale, so its reviewed es and ko are followed', () => {
    for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
      const m = getMessages(locale);
      const cta = m.caregiver.spaces.join.cta;
      expect(m.console.space.codeOverlay.howToJoin(cta)).toBe(m.learner.presenter.slide.end.howToJoin(cta));
    }
  });
});
