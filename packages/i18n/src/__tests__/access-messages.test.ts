import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * F-ENT-003 section 3.11 and Appendix A (PR E3-6): the words a learner of any age reads at the
 * free limit. They never count, never name a product or a price, never say "locked" or "day",
 * and the self-only ask never says "grown-up". The full es / ko banned fixture runs in the app
 * (`apps/mobile/src/logic/__tests__/access-copy.test.ts`); this file pins the English values.
 */
const BANNED: readonly RegExp[] = [
  /premium/i,
  /\bprice\b/i,
  /\bbuy\b/i,
  /\bpay\b/i,
  /\btrial\b/i,
  /\bexpired\b/i,
  /\bended\b/i,
  /\blocked\b/i,
  /\bunlock/i,
  /\bleft\b/i,
  /\bonly\b/i,
  /\bremaining\b/i,
  /\blate\b/i,
  /\bskipped\b/i,
  /\bwrong\b/i,
  /not in your plan/i,
  /family plan/i,
  /group license/i,
  /family lifetime/i,
  /\bdays?\b/i,
  /%/,
  /\d/,
];

describe('learner.access (F-ENT-003 E3-6)', () => {
  it('holds the Appendix A English values', () => {
    expect(getMessages('en').learner.access).toEqual({
      notOpen: 'Not open yet',
      preview: { line: 'This lesson is not open yet. You can still see what it teaches.' },
      ask: { family: 'Ask a grown-up', class: 'Ask your teacher or a grown-up', self: 'See how to open it' },
      back: { cta: 'Back to open lessons' },
      freeEnd: { title: 'You finished your first lessons!' },
      openForYou: 'You played every quest that is open for you.',
      practiceWords: { cta: 'Practice words' },
      readStory: { cta: 'Read a story' },
      replay: { cta: 'Play a favorite again' },
      home: { cta: 'Back home' },
      practice: { subtitle: 'Keep practicing', topicTitle: expect.any(Function) },
    });
    expect(getMessages('en').learner.access.practice.topicTitle('Food')).toBe('Food words');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every value is a line with no banned word, digit or emoji`, () => {
      const tree = getMessages(locale).learner.access;
      const paths = leafPaths(tree);
      expect(paths.length).toBe(14);
      for (const path of paths) {
        const value = lookup(tree, path);
        const text = typeof value === 'function' ? (value as (t: string) => string)('Food') : (value as string);
        expect(typeof text, path).toBe('string');
        expect(text.trim(), path).not.toBe('');
        for (const rule of BANNED) expect(text, `${path}: ${rule}`).not.toMatch(rule);
        expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      expect(tree.ask.self, 'a self-only device never reads grown-up').not.toMatch(/grown-?up/i);
    });
  }

  it('the closed-lesson word is the Learning Route word and the Library tile word (one word for the boundary)', () => {
    const m = getMessages('en').learner;
    expect(m.myRoute.state.notOpen).toBe(m.access.notOpen);
    expect(m.storyShelf.state.locked).toBe(m.access.notOpen);
    expect(m.vocab.topics.locked).toBe(m.access.notOpen);
  });

  it('a tagged lesson row reads the title, its lines and the tags in order (section 3.14)', () => {
    const a = getMessages('en').a11y.access;
    expect(a.row('Family at the Table', ['Meet the family.', '0 of 3 stars earned'], [a.next, a.inPlan])).toBe(
      'Family at the Table. Meet the family. 0 of 3 stars earned. Next. In your plan.',
    );
  });
});
