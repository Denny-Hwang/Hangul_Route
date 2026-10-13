import { describe, expect, it } from 'vitest';
import { caregiverWordsRow } from '../caregiver-row';
import { progress, state, topicRow, word } from './fixtures';

/** The parent dashboard's Words row (F-VOC-005 section 3.8, PR P-3): counts, a rate and up to three words. */

const NOW = new Date(2026, 9, 20, 15, 0, 0);
const apple = word('sagwa-apple', { ko: '사과', romanization: 'sagwa', glosses: { en: 'apple', es: 'manzana', ko: '사과' } });
const eye = word('nun-eye', { ko: '눈', romanization: 'nun', glosses: { en: 'eye' } });
const ITEMS = new Map([apple, eye].map((w) => [w.id, w]));
const itemOf = (id: string) => ITEMS.get(id);

describe('caregiverWordsRow', () => {
  it('is null for a learner with no words (no snapshot, no slice, an empty slice)', () => {
    expect(caregiverWordsRow(undefined, NOW, itemOf, 'en')).toBeNull();
    expect(caregiverWordsRow({}, NOW, itemOf, 'en')).toBeNull();
    expect(caregiverWordsRow({ vocab: progress() }, NOW, itemOf, 'en')).toBeNull();
  });

  it('counts collected and strong words and rounds the first-try rate to a whole percent', () => {
    const vocab = progress(
      [
        state('sagwa-apple', { seen: 3, right: 2, bestBox: 3, box: 3 }),
        state('bap-rice', { seen: 3, right: 1, bestBox: 1 }),
        state('mul-water'),
      ],
      [topicRow('food')],
    );
    expect(caregiverWordsRow({ vocab }, NOW, itemOf, 'en')).toEqual({ collected: 3, strong: 1, firstTryPercent: 50, together: [] });
  });

  it('has no rate before any answer', () => {
    expect(caregiverWordsRow({ vocab: progress([state('sagwa-apple')]) }, NOW, itemOf, 'en')?.firstTryPercent).toBeNull();
  });

  it('names the words to look at together with Korean, romanization and the gloss in the UI language', () => {
    const vocab = progress([
      state('sagwa-apple', { seen: 2, right: 0, box: 1, last: '2026-10-19' }),
      state('nun-eye', { seen: 3, right: 1, box: 1, last: '2026-10-18' }),
    ]);
    expect(caregiverWordsRow({ vocab }, NOW, itemOf, 'es')?.together).toEqual([
      { id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', gloss: 'manzana' },
      { id: 'vocab:nun-eye', ko: '눈', romanization: 'nun', gloss: 'eye' },
    ]);
  });

  it('leaves out a word this build does not know (an id from a newer app)', () => {
    const vocab = progress([state('from-a-newer-app', { seen: 2, right: 0, box: 1 })]);
    expect(caregiverWordsRow({ vocab }, NOW, itemOf, 'en')?.together).toEqual([]);
  });
});
