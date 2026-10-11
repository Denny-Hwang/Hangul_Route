import type { CultureNote, Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  RECAP_SCENES,
  advisoryAfter,
  advisoryInPhase,
  advisoryNote,
  cultureNoteView,
  noteItemId,
  noteOpen,
  recapLayout,
  recapScenes,
} from '../reader-extras';
import { readyStory } from './story-fixture';

/**
 * F-STORY-002 §3.7 (PR 2.8): the culture note card, the grown-up advisory row
 * and the end page recap. Pure rules; `StoryReaderView` only draws them.
 */

const note = (over: Partial<CultureNote> = {}): CultureNote => ({
  id: 'cn-hangul-day',
  titleEn: 'Hangul Day',
  bodyEn: 'Korea celebrates its alphabet every year in October.',
  term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
  cardId: 'card:hanji',
  factIds: ['f3'],
  ...over,
});

describe('cultureNoteView (§3.7 culture note)', () => {
  it('is null for a scene without a note', () => {
    expect(cultureNoteView(null, ['card:hanji'])).toBeNull();
  });

  it('carries the title, body, the taught term and the card when the card has art', () => {
    expect(cultureNoteView(note(), ['card:book', 'card:hanji'])).toEqual({
      id: 'cn-hangul-day',
      itemId: 'note:cn-hangul-day',
      title: 'Hangul Day',
      body: 'Korea celebrates its alphabet every year in October.',
      term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
      cardId: 'card:hanji',
    });
  });

  it('drops the card when it has no art, and when the note names none', () => {
    expect(cultureNoteView(note(), ['card:book'])?.cardId).toBeNull();
    const { cardId: _omit, ...withoutCard } = note();
    expect(cultureNoteView(withoutCard, ['card:hanji'])?.cardId).toBeNull();
  });

  it('keeps the spoken form and the recording of the term for its speaker', () => {
    const term = { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day', spokenKo: '한글랄', audioRef: 'audio/story/hangul-day/term.mp3' };
    expect(cultureNoteView(note({ term }), [])?.term).toEqual(term);
  });
});

describe('noteItemId / noteOpen: the note card shares the one inline-card slot', () => {
  it('names the note item apart from term and word items', () => {
    expect(noteItemId('cn-x')).toBe('note:cn-x');
  });

  it('is open only while the reader holds that note in its open slot', () => {
    const view = cultureNoteView(note(), []);
    expect(noteOpen(view, 'note:cn-hangul-day')).toBe(true);
    expect(noteOpen(view, 'kw:sejong')).toBe(false);
    expect(noteOpen(view, null)).toBe(false);
    expect(noteOpen(null, 'note:cn-hangul-day')).toBe(false);
  });
});

describe('advisoryNote (§3.7 advisory)', () => {
  const story = readyStory();

  it('shows the note on a fresh quest-mode open of scene 1', () => {
    expect(advisoryNote(story, { mode: 'quest', startIndex: 0 })).toBe('Mentions that most people could not read long ago.');
  });

  it('is not shown when the reader resumes past scene 1', () => {
    expect(advisoryNote(story, { mode: 'quest', startIndex: 2 })).toBeNull();
  });

  it('is not shown in replay mode', () => {
    expect(advisoryNote(story, { mode: 'replay', startIndex: 0 })).toBeNull();
  });

  it('is not shown for a story without an advisory, nor without its note', () => {
    const calm: Story = { ...story, review: { ...story.review, advisory: [] } };
    expect(advisoryNote(calm, { mode: 'quest', startIndex: 0 })).toBeNull();
    const { advisoryNoteEn: _omit, ...noNote } = story.review;
    expect(advisoryNote({ ...story, review: noNote }, { mode: 'quest', startIndex: 0 })).toBeNull();
  });
});

describe('advisoryAfter: the row never shows again in that visit', () => {
  const row = 'A note';

  it('stays through the opening of scene 1', () => {
    expect(advisoryAfter(row, { type: 'scene-changed', index: 0, via: 'open' })).toBe(row);
  });

  it('goes on any page turn, restart or the end page, and does not come back', () => {
    expect(advisoryAfter(row, { type: 'scene-changed', index: 1, via: 'next' })).toBeNull();
    expect(advisoryAfter(row, { type: 'scene-changed', index: 0, via: 'restart' })).toBeNull();
    expect(advisoryAfter(row, { type: 'finish-reading' })).toBeNull();
    expect(advisoryAfter(null, { type: 'scene-changed', index: 0, via: 'back' })).toBeNull();
  });

  it('is untouched by a checkpoint answer', () => {
    expect(advisoryAfter(row, { type: 'answer', roundKey: 'cp:x', correct: true })).toBe(row);
  });
});

describe('advisoryInPhase: the row belongs to the scene page only', () => {
  const row = 'A note';

  it('stays on the scene page', () => {
    expect(advisoryInPhase(row, 'scene')).toBe(row);
  });

  it('goes when a checkpoint opens or the end page shows (a page turn without a scene change, §3.7)', () => {
    expect(advisoryInPhase(row, 'checkpoint')).toBeNull();
    expect(advisoryInPhase(row, 'end')).toBeNull();
    expect(advisoryInPhase(null, 'scene')).toBeNull();
  });
});

describe('recapScenes (§3.7 end page)', () => {
  const story = readyStory();

  it('takes the Story Order scenes of the tier, in order, at most four', () => {
    const scenes = recapScenes(story, 'listen');
    expect(scenes.map((s) => s.sceneId)).toEqual(['s1', 's2', 's4', 's5']);
    expect(scenes.length).toBeLessThanOrEqual(RECAP_SCENES);
    for (const s of scenes) expect(s.art.setting).toBeTruthy();
  });

  it('leaves out a scene whose art is pending or missing', () => {
    // read-along: s3 is artPending.
    expect(recapScenes(story, 'read-along').map((s) => s.sceneId)).toEqual(['s1', 's2', 's4']);
    const tier = story.tiers[0]!;
    const noArt: Story = {
      ...story,
      tiers: [{ ...tier, scenes: tier.scenes.map((s) => (s.id === 's2' ? { ...s, art: undefined } : s)) }, story.tiers[1]!],
    };
    expect(recapScenes(noArt, 'listen').map((s) => s.sceneId)).toEqual(['s1', 's4', 's5']);
  });

  it('skips an id that is not a scene of the tier and is empty for a missing tier', () => {
    const tier = story.tiers[0]!;
    const odd: Story = { ...story, tiers: [{ ...tier, sequenceSceneIds: ['s1', 's9', 's4', 's5'] }] };
    expect(recapScenes(odd, 'listen').map((s) => s.sceneId)).toEqual(['s1', 's4', 's5']);
    expect(recapScenes(story, 'read')).toEqual([]);
  });

  it('never shows more than four pictures', () => {
    const tier = story.tiers[0]!;
    const many: Story = { ...story, tiers: [{ ...tier, sequenceSceneIds: ['s1', 's2', 's4', 's5', 's1'] }] };
    expect(recapScenes(many, 'listen')).toHaveLength(RECAP_SCENES);
  });
});

describe('recapLayout: the recap fits the end page at any window', () => {
  const base = { hoya: 64, maxThumb: 96, gap: 8 };

  it('stacks under Hoya with thumbnails up to their cap on a tall window', () => {
    expect(recapLayout({ ...base, width: 600, compact: false, landscape: false, count: 4 })).toEqual({ inline: false, thumbWidth: 96 });
  });

  it('shares the row across the width on a narrow window', () => {
    // 288 wide (320 minus gutters): (288 - 3 * 8) / 4 = 66.
    expect(recapLayout({ ...base, width: 288, compact: true, landscape: false, count: 4 })).toEqual({ inline: false, thumbWidth: 66 });
  });

  it('sits beside Hoya on a short landscape window so Continue stays on screen', () => {
    expect(recapLayout({ ...base, width: 300, compact: true, landscape: true, count: 4 })).toEqual({ inline: true, thumbWidth: 51 });
    expect(recapLayout({ ...base, maxThumb: 64, width: 900, compact: true, landscape: true, count: 3 })).toEqual({ inline: true, thumbWidth: 64 });
  });

  it('a landscape window that is not short stacks as usual', () => {
    expect(recapLayout({ ...base, width: 900, compact: false, landscape: true, count: 4 }).inline).toBe(false);
  });

  it('hides the row rather than draw pictures smaller than the floor', () => {
    // 100 wide: (100 - 3 * 8) / 4 = 19, under a 32 floor.
    expect(recapLayout({ ...base, minThumb: 32, width: 100, compact: false, landscape: false, count: 4 }).thumbWidth).toBe(0);
    expect(recapLayout({ ...base, minThumb: 32, width: 288, compact: true, landscape: false, count: 4 }).thumbWidth).toBe(66);
    // Exactly the floor still draws.
    expect(recapLayout({ ...base, minThumb: 19, width: 100, compact: false, landscape: false, count: 4 }).thumbWidth).toBe(19);
  });

  it('is zero wide with nothing to show or no room yet', () => {
    expect(recapLayout({ ...base, width: 600, compact: false, landscape: false, count: 0 }).thumbWidth).toBe(0);
    expect(recapLayout({ ...base, width: 0, compact: false, landscape: false, count: 4 }).thumbWidth).toBe(0);
  });
});
