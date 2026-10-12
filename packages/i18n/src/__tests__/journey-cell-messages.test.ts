import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { SAMPLES } from './samples';

// F-STORY-005 PR 5.5a: the Journey cell label names the stage by its number and title (the old
// label read "Letters episode for stage1"), says what the cell holds and counts its heritage
// stories; the count mark, the stories caption and the explainer line come from here too.
const m = getMessages('en');

const cell = (patch: Partial<Parameters<typeof m.a11y.journeyCell>[0]> = {}): string =>
  m.a11y.journeyCell({
    stage: 1,
    stageTitle: 'Hangul',
    themeTitle: 'Letters & Books',
    kind: 'lesson',
    complete: false,
    stories: 0,
    finished: 0,
    start: false,
    placedOut: false,
    ...patch,
  });

describe('a11y.journeyCell', () => {
  it('a lesson cell names the stage number, stage title and theme', () => {
    expect(cell()).toBe('Stage 1 Hangul, Letters & Books: lesson');
    expect(cell({ complete: true })).toBe('Stage 1 Hangul, Letters & Books: lesson, complete');
  });

  it('counts the heritage stories with plural(), and the finished ones only when there are some', () => {
    expect(cell({ stories: 1 })).toBe('Stage 1 Hangul, Letters & Books: lesson, 1 heritage story');
    expect(cell({ stories: 5 })).toBe('Stage 1 Hangul, Letters & Books: lesson, 5 heritage stories');
    expect(cell({ stories: 5, finished: 2 })).toBe('Stage 1 Hangul, Letters & Books: lesson, 5 heritage stories, 2 finished');
    expect(cell({ stories: 2, finished: 2, complete: true })).toBe(
      'Stage 1 Hangul, Letters & Books: lesson, complete, 2 heritage stories, 2 finished',
    );
  });

  it('a book cell reads like a lesson cell with its own word', () => {
    expect(cell({ stage: 5, stageTitle: 'Stories', kind: 'book', stories: 0 })).toBe('Stage 5 Stories, Letters & Books: story book');
    expect(cell({ stage: 5, stageTitle: 'Stories', kind: 'book', complete: true })).toBe(
      'Stage 5 Stories, Letters & Books: story book, complete',
    );
  });

  it('a stories-only cell says only its stories', () => {
    expect(cell({ stage: 2, stageTitle: 'Words', kind: 'stories-only', stories: 2 })).toBe(
      'Stage 2 Words, Letters & Books: 2 heritage stories',
    );
    expect(cell({ stage: 2, stageTitle: 'Words', kind: 'stories-only', stories: 1, finished: 1 })).toBe(
      'Stage 2 Words, Letters & Books: 1 heritage story, 1 finished',
    );
  });

  it('a placeholder cell is coming soon', () => {
    expect(cell({ stage: 3, stageTitle: 'Sentences', themeTitle: 'Holidays & Traditions', kind: 'placeholder' })).toBe(
      'Stage 3 Sentences, Holidays & Traditions, coming soon',
    );
  });

  it('adds the level-check marks as their own sentences, as before', () => {
    expect(cell({ start: true })).toBe('Stage 1 Hangul, Letters & Books: lesson. You started here.');
    expect(cell({ placedOut: true })).toBe(
      'Stage 1 Hangul, Letters & Books: lesson. You can skip ahead here, and it is still open to play.',
    );
    expect(cell({ start: true, placedOut: true, stories: 1 })).toBe(
      'Stage 1 Hangul, Letters & Books: lesson, 1 heritage story. You started here. You can skip ahead here, and it is still open to play.',
    );
  });

  it('never names the stage by its key', () => {
    expect(cell()).not.toMatch(/stage\d/);
  });
});

describe('learner.journey story words', () => {
  const j = m.learner.journey;

  it('the count mark caps at 5+', () => {
    expect(j.countMark(1, false)).toBe('1');
    expect(j.countMark(5, false)).toBe('5');
    expect(j.countMark(5, true)).toBe('5+');
  });

  it('the stories caption and the explainer line', () => {
    expect(j.storiesNote).toBe('Heritage stories are open in the cells with books.');
    expect(j.how.stories).toBe('Cells with books also have heritage stories. The number in a corner says how many.');
  });

  it('every new function message has sample arguments', () => {
    expect(SAMPLES['a11y.journeyCell']).toBeDefined();
    expect(SAMPLES['learner.journey.countMark']).toBeDefined();
    expect(SAMPLES['a11y.gridCell']).toBeUndefined();
    expect(SAMPLES['a11y.gridCellMarked']).toBeUndefined();
  });
});
