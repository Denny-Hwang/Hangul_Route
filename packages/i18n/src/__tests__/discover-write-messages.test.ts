import { describe, expect, it } from 'vitest';
import { getMessages } from '../index';

/**
 * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE §3.6 (row TC-1b): the trace page's strings of Discover, in the three locales.
 * One verb ("trace") on the page, the keep-going lines name the way on, and the letter row's summary says "traced of total".
 */
describe('Discover trace page strings (TC-1b)', () => {
  it('en: the six strings of the spec', () => {
    const m = getMessages('en');
    const write = m.learner.quest.discover.write;
    expect(write.title).toBe('Trace the new letters');
    expect(write.idle).toBe('Trace each line slowly.');
    expect(write.keepGoing).toBe('Keep going, or tap Next letter.');
    expect(write.keepGoingLast).toBe('Keep going, or tap Continue.');
    expect(write.next.cta).toBe('Next letter');
    expect(m.a11y.discoverWriteProgress(2, 4)).toBe('2 of 4 letters traced');
    expect(m.a11y.discoverWriteProgress(0, 1)).toBe('0 of 1 letter traced');
  });

  it('the last-letter keep-going line names the Continue button of its own locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      expect(m.learner.quest.discover.write.keepGoingLast, locale).toContain(m.learner.quest.discover.continue.cta);
      expect(m.learner.quest.discover.write.keepGoing, locale).toContain(m.learner.quest.discover.write.next.cta);
    }
  });

  it('es and ko say the same count in their own words, and es agrees in number', () => {
    expect(getMessages('es').a11y.discoverWriteProgress(2, 4)).toBe('2 de 4 letras trazadas');
    expect(getMessages('es').a11y.discoverWriteProgress(0, 1)).toBe('0 de 1 letra trazada');
    expect(getMessages('ko').a11y.discoverWriteProgress(2, 4)).toBe('글자 4개 중 2개를 따라 썼어요');
  });

  it('is plain: no Hangul in the English, no age word anywhere', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      const text = JSON.stringify(m.learner.quest.discover.write) + m.a11y.discoverWriteProgress(1, 3);
      expect(text, locale).not.toMatch(/\b(kids?|child(ren)?|ni[ñn]os?|ages?)\b|어린이/i);
    }
    expect(JSON.stringify(getMessages('en').learner.quest.discover.write)).not.toMatch(/[가-힣]/);
  });
});
