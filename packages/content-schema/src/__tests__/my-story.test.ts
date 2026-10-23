import { describe, expect, it } from 'vitest';
import {
  LessonScopeSchema,
  MinigameKindSchema,
  MY_STORY_PRIVATE_TOPICS,
  MyStoryFrameSchema,
  MyStoryRoundSchema,
  RoundSchema,
  WriteFrameRoundSchema,
  fillFrame,
  scopeRoundCount,
  type LessonScope,
} from '../index';
import { kt } from './helpers/lesson-fixtures';

/**
 * My Story (F-CURR-002 §7.1 F8, OD-13; row CM-38; design/wireframes/minigame/my-story.md): 3-5 chained Write
 * Frame rounds, slots word-bank only, one neutral option in every bank, no frame asking for a private fact.
 * The example chain is the wireframe's.
 */
const neutral = (ko: string, romanization: string, en: string) => ({ ...kt(ko, romanization, en), neutral: true as const });

const place = {
  id: 'place',
  frame: kt('저는 주말에 ___에 가요.', 'jeoneun jumare ___e gayo', 'On the weekend I go to ___.'),
  slots: [{ id: 'where', bank: [kt('도서관', 'doseogwan', 'the library'), kt('시장', 'sijang', 'the market'), neutral('공원', 'gongwon', 'the park')] }],
  entry: 'type',
};
const withWho = {
  id: 'with',
  frame: kt('___과/와 같이 가요.', '___gwa/wa gachi gayo', 'I go with ___.'),
  slots: [{ id: 'who', bank: [kt('친구', 'chingu', 'a friend'), kt('가족', 'gajok', 'my family'), neutral('호야', 'hoya', 'Hoya')] }],
  entry: 'type',
};
const feel = {
  id: 'feel',
  frame: kt('기분이 ___.', 'gibuni ___', 'I feel ___.'),
  slots: [{ id: 'how', bank: [kt('좋아요', 'joayo', 'good'), kt('아주 좋아요', 'aju joayo', 'very good'), neutral('괜찮아요', 'gwaenchanayo', 'okay')] }],
  entry: 'pick',
};
const chain = [place, withWho, feel];
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown): boolean => schema.safeParse(v).success;
const messages = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, v: unknown): string[] =>
  schema.safeParse(v).error?.issues.map((i) => i.message) ?? [];

describe('the my-story kind (additive)', () => {
  it('is the last kind; every older kind still parses', () => {
    expect(MinigameKindSchema.options.at(-1)).toBe('my-story');
    expect(MinigameKindSchema.options).toHaveLength(22);
    for (const kind of ['write-frame', 'type-hangul', 'listen-pick', 'voice-echo']) expect(MinigameKindSchema.safeParse(kind).success).toBe(true);
  });

  it('carries a chain in RoundSchema and in a lesson scope, one round per frame', () => {
    expect(ok(RoundSchema, { kind: 'my-story', data: { id: 'weekend', frames: chain } })).toBe(true);
    expect(ok(RoundSchema, { kind: 'my-story', data: { id: 'weekend', frames: chain.slice(0, 2) } })).toBe(false);
    const scope = LessonScopeSchema.parse({ ref: 'minigame:s7-life-q1-apply', kind: 'my-story', frames: chain }) as LessonScope;
    expect(scopeRoundCount(scope)).toBe(3);
  });
});

describe('MyStoryFrameSchema (a Write Frame round, word-bank only)', () => {
  it('parses to a Write Frame round: the fallback plays it unchanged, the neutral mark kept', () => {
    const frame = MyStoryFrameSchema.parse(place);
    expect(frame.freeEntry).toBe(false);
    expect(frame.slots[0]!.bank.map((w) => w.neutral === true)).toEqual([false, false, true]);
    expect(WriteFrameRoundSchema.safeParse(frame).success).toBe(true);
  });

  it('keeps every Write Frame rule: slot count, known endings, Hangul bank words', () => {
    expect(ok(MyStoryFrameSchema, { ...place, frame: kt('저는 ___에 ___에 가요.', 'x', 'I go to ___ and ___.') })).toBe(false);
    expect(ok(MyStoryFrameSchema, { ...place, frame: kt('저는 ___좋아요.', 'x', 'I ___.') })).toBe(false);
    expect(ok(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: [...place.slots[0]!.bank, kt('Park!', 'x', 'y')] }] })).toBe(false);
  });

  it('has no free text: no free-entry slot and no sound table', () => {
    expect(messages(MyStoryFrameSchema, { ...place, freeEntry: true })).toContain('a My Story frame is word-bank only: no free entry');
    expect(messages(MyStoryFrameSchema, { ...place, soundTable: { groups: [[{ ko: '호', romanization: 'ho' }]], finals: [] } })).toContain(
      'a My Story frame is word-bank only: no sound table',
    );
  });

  it('offers 3 to 5 words per slot', () => {
    const bank = place.slots[0]!.bank;
    expect(ok(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: bank.slice(1) }] })).toBe(false);
    const five = [...bank, kt('학교', 'hakgyo', 'school'), kt('바다', 'bada', 'the sea')];
    expect(ok(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: five }] })).toBe(true);
    expect(ok(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: [...five, kt('산', 'san', 'a mountain')] }] })).toBe(false);
  });
});

describe('my-story-neutral-option: exactly one neutral option in every bank, drawn like the others', () => {
  const bank = place.slots[0]!.bank;
  it('refuses a bank with no neutral option, or two', () => {
    const none = bank.map((w) => kt(w.ko, w.romanization, w.en));
    expect(messages(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: none }] })).toEqual([
      "my-story-neutral-option: a slot's bank has exactly one neutral option (it has 0)",
    ]);
    const two = [bank[0], neutral('시장', 'sijang', 'the market'), bank[2]];
    expect(messages(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: two }] })).toEqual([
      "my-story-neutral-option: a slot's bank has exactly one neutral option (it has 2)",
    ]);
  });

  it('never puts the neutral option first, so it is not the default', () => {
    const first = [bank[2], bank[0], bank[1]];
    expect(messages(MyStoryFrameSchema, { ...place, slots: [{ id: 'where', bank: first }] })).toEqual([
      'my-story-neutral-option: the neutral option is drawn like the others, never first in the bank',
    ]);
  });

  it('checks each slot of a two-slot frame', () => {
    const two = {
      id: 'two',
      frame: kt('___에 ___과/와 가요.', '___e ___gwa/wa gayo', 'I go to ___ with ___.'),
      slots: [place.slots[0], { id: 'who', bank: withWho.slots[0]!.bank.map((w) => kt(w.ko, w.romanization, w.en)) }],
      entry: 'type',
    };
    expect(messages(MyStoryFrameSchema, two)).toEqual(["my-story-neutral-option: a slot's bank has exactly one neutral option (it has 0)"]);
  });

  it('the neutral options make sentences that tell nothing about the learner', () => {
    const neutralPicks = chain.map((f) => fillFrame(f.frame.ko, [f.slots[0]!.bank.find((w) => 'neutral' in w)!.ko]));
    expect(neutralPicks).toEqual(['저는 주말에 공원에 가요.', '호야와 같이 가요.', '기분이 괜찮아요.']);
  });
});

describe('my-story-private-topic: no frame asks for a private fact', () => {
  it.each([
    ['My name is ___.'],
    ['I live in ___.'],
    ['My school is ___.'],
    ['I am ___ years old.'],
    ['My birthday is in ___.'],
    ['I feel sick in my ___.'],
    ['My religion is ___.'],
    ['My phone number is ___.'],
  ])('refuses "%s"', (en) => {
    expect(messages(MyStoryFrameSchema, { ...place, frame: { ...place.frame, en } }).some((m) => m.startsWith('my-story-private-topic'))).toBe(true);
  });

  it('allows everyday frames: a place, a companion, a feeling, a season, a food', () => {
    for (const en of ['On the weekend I go to ___.', 'I go with ___.', 'I feel ___.', 'My favourite season is ___.', 'I like ___.', 'Happy New Year, ___!']) {
      expect(MY_STORY_PRIVATE_TOPICS.test(en), en).toBe(false);
    }
  });
});

describe('MyStoryRoundSchema (the chain)', () => {
  it('holds 3 to 5 frames with distinct ids', () => {
    expect(ok(MyStoryRoundSchema, { id: 'w', frames: chain })).toBe(true);
    expect(ok(MyStoryRoundSchema, { id: 'w', frames: [...chain, { ...place, id: 'p2' }, { ...feel, id: 'f2' }] })).toBe(true);
    expect(ok(MyStoryRoundSchema, { id: 'w', frames: [...chain, { ...place, id: 'p2' }, { ...feel, id: 'f2' }, { ...withWho, id: 'w2' }] })).toBe(false);
    expect(messages(MyStoryRoundSchema, { id: 'w', frames: [place, place, feel] })).toContain('frame ids must be unique');
  });
});
