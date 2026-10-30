import { en } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STORY_ORDER_FIXTURES } from '../../../navigation/story-order-e2e-fixture';
import { storyOrderCards } from '../story-order-player';
import {
  STORY_ORDER_AUDIO_SOURCE,
  lineSpeech,
  slotFace,
  storyOrderCardLabel,
  storyOrderColumns,
  storyOrderHeading,
  storyOrderSlotsPerRow,
  STORY_ORDER_STACK_SLOTS_AT,
  type StoryOrderCopy,
} from '../story-order-view';

const copy: StoryOrderCopy = { storyOrder: en.learner.storyOrder, sequence: en.learner.story.sequence };
const [day, morning] = STORY_ORDER_FIXTURES.twoRounds.storyOrder?.rounds ?? [];

describe('storyOrderHeading', () => {
  it('reads the lines for a captions round and the pictures for an illustrated one', () => {
    expect(storyOrderHeading(morning!, copy)).toEqual({ title: 'Put the lines in order', hint: 'Read each line. Tap the one that comes first.' });
    expect(storyOrderHeading(day!, copy)).toEqual({ title: 'Put the story in order', hint: 'Tap each picture, starting with what happened first.' });
    expect(storyOrderHeading({ ...day!, captionsOnly: true }, copy).title).toBe('Put the lines in order');
  });
});

describe('slotFace', () => {
  it("is the line's first word without its mark, with that word's romanization", () => {
    expect(slotFace({ ko: '그다음에 세수해요.', romanization: 'geudaeume sesuhaeyo', en: 'Next.' })).toEqual({ ko: '그다음에', romanization: 'geudaeume' });
    expect(slotFace({ ko: '먼저!', romanization: 'meonjeo!', en: 'First!' })).toEqual({ ko: '먼저', romanization: 'meonjeo' });
  });

  it('romanizes the word with rr.ts when the romanization does not split one word per Korean word', () => {
    expect(slotFace({ ko: '마지막에 공원에 가요.', romanization: 'majimage gongwone-e gayo now', en: 'Last.' })).toEqual({ ko: '마지막에', romanization: 'majimage' });
  });
});

describe('storyOrderCardLabel', () => {
  const card = storyOrderCards(morning!)[1]!;
  it('names the line and its romanization; the meaning only once shown; a miss or ring in words, never colour alone', () => {
    expect(storyOrderCardLabel(card, 'geudaeume sesuhaeyo', false, null, copy)).toBe('그다음에 세수해요., geudaeume sesuhaeyo');
    expect(storyOrderCardLabel(card, '', false, null, copy)).toBe('그다음에 세수해요.');
    expect(storyOrderCardLabel(card, 'geudaeume sesuhaeyo', true, null, copy)).toBe('그다음에 세수해요., geudaeume sesuhaeyo. Next, I wash my face.');
    expect(storyOrderCardLabel(card, '', false, 'wrong', copy)).toBe('그다음에 세수해요.. Try another');
    expect(storyOrderCardLabel(card, '', false, 'hint', copy)).toBe('그다음에 세수해요.. This one comes next.');
  });
});

describe('layout', () => {
  it('cards: captions in one column on a phone and two from regular; pictures 1 at 320, 2 from 360, 4 from regular', () => {
    expect(storyOrderColumns('compact', 320, false)).toBe(1);
    expect(storyOrderColumns('compact', 412, false)).toBe(1);
    expect(storyOrderColumns('regular', 768, false)).toBe(2);
    expect(storyOrderColumns('compact', 320, true)).toBe(1);
    expect(storyOrderColumns('compact', 360, true)).toBe(2);
    expect(storyOrderColumns('wide', 1024, true)).toBe(4);
  });

  it('slots: 2 x 2 on a phone, every slot in one row from regular', () => {
    expect(storyOrderSlotsPerRow('compact', 4)).toBe(2);
    expect(storyOrderSlotsPerRow('regular', 4)).toBe(4);
    expect(storyOrderSlotsPerRow('wide', 5)).toBe(5);
    expect(storyOrderSlotsPerRow('wide', 0)).toBe(1);
  });

  it('stacks the slots of a phone one per row from 200 % text, and keeps two across at 150 %', () => {
    expect(storyOrderSlotsPerRow('compact', 4, 1.5)).toBe(2);
    expect(storyOrderSlotsPerRow('compact', 4, 1.99)).toBe(2);
    expect(storyOrderSlotsPerRow('compact', 4, STORY_ORDER_STACK_SLOTS_AT)).toBe(1);
    expect(storyOrderSlotsPerRow('compact', 5, 3)).toBe(1);
    // A wider window has room for every slot in one row at any size.
    expect(storyOrderSlotsPerRow('regular', 4, 2)).toBe(4);
  });
});

describe('lineSpeech', () => {
  it('says the line at the sentence rate, its spoken form and clip when the content has them', () => {
    expect(lineSpeech({ ko: '밤에 별이 떠요.', romanization: 'bame byeori tteoyo', en: 'x' })).toEqual({ text: '밤에 별이 떠요.', kind: 'sentence', source: STORY_ORDER_AUDIO_SOURCE });
    expect(lineSpeech({ ko: 'a', romanization: 'a', en: 'x', spokenKo: 'b', audioRef: 'clip:x' })).toEqual({ text: 'b', kind: 'sentence', source: 'story-order', audioRef: 'clip:x' });
  });
});
