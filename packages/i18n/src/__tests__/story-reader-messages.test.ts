import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-STORY-002 PR 2.6a: the story reader and its end page read the dictionary. The wording is
// the one PR 2.5 shipped in `logic/story/story-reader-copy.ts` (moved, unchanged); buttons and
// pills are keyed `cta` / `pill` so the length budgets (F-I18N-001 §3.11) cover them.
const m = getMessages('en');
const r = m.learner.story.reader;
const end = m.learner.story.end;
const NO_AGE_OR_FAILURE = /\b(kids?|child(ren)?|ages?|fail\w*|wrong|incorrect|error|mistake|oops)\b|\p{Extended_Pictographic}/iu;
const HANGUL = /[ㄱ-ㆎ가-힣]/;

describe('learner.story.reader (English wording as shipped in PR 2.5)', () => {
  it('names the controls of the top and bottom bars', () => {
    expect(r.close).toBe('Close');
    expect(r.back.cta).toBe('Back');
    expect(r.next.cta).toBe('Next');
    expect(r.finish.cta).toBe('Finish');
    expect(r.sources.cta).toBe('Sources');
    expect(r.readToMe).toBe('Read to me');
  });

  it('keeps the page number a position and the announcement position-then-picture', () => {
    expect(r.position.pill(3, 8)).toBe('3 / 8');
    expect(r.sceneOf(3, 8)).toBe('Scene 3 of 8');
    expect(r.announce(1, 8, 'A king sits.')).toBe('Scene 1 of 8. A king sits.');
  });

  it('keeps the listening and Korean labels', () => {
    expect(r.hearStory).toBe('Hear this scene');
    expect(r.hearKorean).toBe('Hear the Korean');
    expect(r.hearTerm('sagwan')).toBe('Hear sagwan');
    expect(r.termLabel('sagwan', 'royal historian')).toBe('Korean word sagwan, royal historian. Double tap to hear.');
    expect(r.closeGloss.cta).toBe('Close');
    expect(r.showRomanization.cta).toBe('Show how to say it');
    expect(r.sayItYourself.pill).toBe('Say it yourself');
    expect(r.tapToHear).toBe('Tap to hear');
    expect(r.inEnglish).toBe('In English');
    expect(r.traditionalTale.pill).toBe('Traditional tale');
  });

  it('keeps the fallback, advisory, culture-note and checkpoint lines for the later PRs', () => {
    expect(r.unavailable).toBe('This story is not ready to read yet.');
    expect(r.continue.cta).toBe('Continue');
    expect(r.advisory('Mentions a war.')).toBe('A note for grown-ups: Mentions a war.');
    expect(r.dismiss.cta).toBe('Dismiss');
    expect(r.didYouKnow.cta).toBe('Did you know?');
    expect(r.cultureNote.moreInCultureNotes.cta).toBe('More in Culture notes');
    expect(r.cultureNote.close.cta).toBe('Close');
    expect(r.checkpoint.tryIt).toBe('Try it');
    expect(r.checkpoint.quickQuestion).toBe('Quick question');
    expect(r.checkpoint.skip.cta).toBe('Skip');
  });
});

describe('learner.story.end', () => {
  it('has one heading and the four buttons of the end page', () => {
    expect(end.title).toBe('The End');
    expect(end.continue.cta).toBe('Continue');
    expect(end.done.cta).toBe('Done');
    expect(end.readAgain.cta).toBe('Read again');
    expect(end.sources.cta).toBe('Sources');
  });
});

describe('reader copy rules (D1, D2, D3)', () => {
  const paths = leafPaths(m).filter((p) => p.startsWith('learner.story.reader.') || p.startsWith('learner.story.end.'));
  const rendered = paths.flatMap((path) => {
    const value = lookup(m, path);
    if (typeof value === 'string') return [value];
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    return (samples ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
  });

  it('finds the reader leaves', () => {
    expect(paths.length).toBeGreaterThan(30);
  });

  it('never names an age, never shames, never shows an emoji', () => {
    for (const s of rendered) expect(s, s).not.toMatch(NO_AGE_OR_FAILURE);
  });

  it('never embeds taught Korean: Hangul is drawn by KoreanText from the story data', () => {
    for (const s of rendered) expect(s, s).not.toMatch(HANGUL);
  });
});

describe('every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: has the reader keys`, () => {
      const messages = getMessages(locale);
      expect(typeof messages.learner.story.reader.next.cta).toBe('string');
      expect(typeof messages.learner.story.reader.position.pill).toBe('function');
      expect(typeof messages.learner.story.end.title).toBe('string');
    });
  }
});
