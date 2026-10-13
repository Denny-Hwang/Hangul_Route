import { findBannedWord, findWord, getMessages, LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { askAudienceOf, askFor, askGate, helpAskedEvent, isClassOnly } from '../access-copy';
import { ACCESS_BANNED, ACCESS_BANNED_PATTERNS, SELF_BANNED } from './access-banned-fixture';

const en = getMessages('en').learner.access;

describe('askFor (F-ENT-003 section 3.7 table)', () => {
  it('family device, learner with a family membership or none: Ask a grown-up', () => {
    expect(askFor('family', false, en)).toEqual({ audience: 'family', label: 'Ask a grown-up' });
  });

  it('family device, learner whose only space membership is a class or school: Ask your teacher or a grown-up', () => {
    expect(askFor('family', true, en)).toEqual({ audience: 'class', label: 'Ask your teacher or a grown-up' });
  });

  it('self-only device: See how to open it, whatever the memberships', () => {
    expect(askFor('self', false, en)).toEqual({ audience: 'self', label: 'See how to open it' });
    expect(askFor('self', true, en)).toEqual({ audience: 'self', label: 'See how to open it' });
  });

  it('askAudienceOf is the code the telemetry sends', () => {
    expect(askAudienceOf('family', false)).toBe('family');
    expect(askAudienceOf('family', true)).toBe('class');
    expect(askAudienceOf('self', true)).toBe('self');
  });
});

describe('isClassOnly', () => {
  it('is true only when every membership is a class or a school', () => {
    expect(isClassOnly([])).toBe(false);
    expect(isClassOnly([{ kind: 'class' }])).toBe(true);
    expect(isClassOnly([{ kind: 'school' }, { kind: 'class' }])).toBe(true);
    expect(isClassOnly([{ kind: 'class' }, { kind: 'family' }])).toBe(false);
    expect(isClassOnly([{ kind: 'family' }])).toBe(false);
  });
});

describe('askGate', () => {
  it('opens the Plan screen directly when the gate opens directly, else through the PIN screen, with its surface', () => {
    expect(askGate(true, 'episode')).toEqual({ route: 'Paywall', params: { from: 'episode' } });
    expect(askGate(false, 'episode')).toEqual({ route: 'PinEntry', params: { next: 'Paywall', from: 'episode' } });
    expect(askGate(false, 'home')).toEqual({ route: 'PinEntry', params: { next: 'Paywall', from: 'home' } });
    expect(askGate(true, 'results')).toEqual({ route: 'Paywall', params: { from: 'results' } });
    expect(askGate(false, 'library')).toEqual({ route: 'PinEntry', params: { next: 'Paywall', from: 'library' } });
  });
});

describe('helpAskedEvent', () => {
  it('sends codes only: the surface and the ask audience', () => {
    expect(helpAskedEvent('p1', 'episode', 'class')).toEqual({
      name: 'access.help_asked',
      profileId: 'p1',
      payload: { from: 'episode', audience: 'class' },
    });
    expect(helpAskedEvent(undefined, 'home', 'self')).toEqual({ name: 'access.help_asked', payload: { from: 'home', audience: 'self' } });
  });
});

describe('learner.access strings in every locale (section 3.11 banned fixture)', () => {
  for (const locale of LOCALES) {
    const tree = getMessages(locale).learner.access;
    const lines: readonly [string, string][] = [
      ['notOpen', tree.notOpen],
      ['preview.line', tree.preview.line],
      ['ask.family', tree.ask.family],
      ['ask.class', tree.ask.class],
      ['ask.self', tree.ask.self],
      ['back.cta', tree.back.cta],
      ['freeEnd.title', tree.freeEnd.title],
      ['openForYou', tree.openForYou],
      ['practiceWords.cta', tree.practiceWords.cta],
      ['readStory.cta', tree.readStory.cta],
      ['replay.cta', tree.replay.cta],
      ['home.cta', tree.home.cta],
      ['practice.subtitle', tree.practice.subtitle],
    ];

    it(`${locale}: no banned word, digit, count or emoji`, () => {
      for (const [path, text] of lines) {
        expect(findWord(text, ACCESS_BANNED[locale], locale), `${locale}:${path}`).toBeNull();
        expect(findBannedWord(text, locale, 'learner'), `${locale}:${path}`).toBeNull();
        for (const rule of ACCESS_BANNED_PATTERNS) expect(text, `${locale}:${path} ${rule}`).not.toMatch(rule);
        expect(text, `${locale}:${path}`).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });

    it(`${locale}: the self-only ask and the lines a self-only device reads never say grown-up`, () => {
      const selfLines = lines.filter(([path]) => path !== 'ask.family' && path !== 'ask.class');
      for (const [path, text] of selfLines) expect(findWord(text, SELF_BANNED[locale], locale), `${locale}:${path}`).toBeNull();
    });

    it(`${locale}: buttons fit the CTA budget`, () => {
      for (const [path, text] of lines) if (path.endsWith('.cta')) expect(text.length, `${locale}:${path}`).toBeLessThanOrEqual(28);
      // The ask button is a full-width secondary button; it keeps to two short lines.
      for (const text of [tree.ask.family, tree.ask.class, tree.ask.self]) expect(text.length).toBeLessThanOrEqual(40);
    });
  }
});
