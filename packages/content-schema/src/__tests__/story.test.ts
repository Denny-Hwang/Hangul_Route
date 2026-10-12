import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CultureNoteSchema,
  MIN_VERIFICATION_PASSES,
  STORY_SCHEMA_VERSION,
  StoryCardSchema,
  StoryObjectSchema,
  StoryReadySchema,
  StorySchema,
  StoryShelfSchema,
  TALE_KINDS,
  koTextExtend,
  parseStory,
  sceneKorean,
  type Story,
} from '../index';
import draftJson from '../__fixtures__/story/valid.draft.json';
import readyJson from '../__fixtures__/story/valid.ready.json';
import taleJson from '../__fixtures__/story/valid.tale.json';

const ready = (): Story => structuredClone(parseStory(readyJson));
const draft = (): Story => structuredClone(parseStory(draftJson));

/** `path: message` for every issue `parseStory` reports (empty when the story parses). */
const issuesOf = (value: unknown): string[] => {
  try {
    parseStory(value);
    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    }
    throw error;
  }
};
const expectIssue = (value: unknown, path: string, message?: string): void => {
  const issues = issuesOf(value);
  const hit = issues.find((i) => i.startsWith(`${path}: `) && (!message || i.includes(message)));
  expect(hit, issues.join('\n') || 'no issues').toBeDefined();
};

describe('constants', () => {
  it('pins the schema version, the verification gate and the tale kinds', () => {
    expect(STORY_SCHEMA_VERSION).toBe(1);
    expect(MIN_VERIFICATION_PASSES).toBe(3);
    expect(TALE_KINDS).toEqual(['folk-tale', 'myth', 'fable']);
  });
});

describe('parseStory: valid fixtures', () => {
  it('accepts the ready fixture through the strict path', () => {
    const story = parseStory(readyJson);
    expect(story.state).toBe('ready');
    expect(story.tiers.map((t) => t.level)).toEqual(['listen', 'read-along']);
    expect(StoryReadySchema.safeParse(readyJson).success).toBe(true);
    expect(StorySchema.safeParse(readyJson).success).toBe(true);
    expect(StoryObjectSchema.safeParse(readyJson).success).toBe(true);
  });

  it('accepts the draft fixture with every later-authored field empty', () => {
    const story = parseStory(draftJson);
    expect(story.state).toBe('draft');
    expect(story.title.romanization).toBe('');
    expect(story.title.en).toBe('');
    expect(story.hoyaIntroEn).toBeUndefined();
    expect(story.tiers[0]?.scenes[0]?.captionEn).toBeUndefined();
    expect(story.tiers[0]?.checks[0]?.explainEn).toBeUndefined();
    expect(story.keywords[0]?.romanization).toBe('');
  });

  it('accepts the traditional tale fixture', () => {
    const story = parseStory(taleJson);
    expect(story.kind).toBe('folk-tale');
    expect(story.origin.type).toBe('traditional');
    expect(story.facts[0]?.scope).toBe('in-the-tale');
  });

  it('keeps the draft fixture a draft: the ready schema rejects it', () => {
    expect(StoryReadySchema.safeParse(draftJson).success).toBe(false);
  });

  it('applies the defaults of every cross-spec slot', () => {
    const story = parseStory(draftJson);
    expect(story.pillarTags).toEqual([]);
    expect(story.companionId).toBe('hoya');
    expect(story.errata).toEqual([]);
    expect(story.review.advisory).toEqual([]);
    expect(story.shelf).toBeUndefined();
    expect(story.card).toBeUndefined();
    expect(story.rewardCardIds).toBeUndefined();
    const scene = story.tiers[0]!.scenes[0]!;
    expect(scene.approximations).toEqual([]);
    expect(scene.framing).toBe(false);
    expect(story.tiers[0]!.checkpoints).toEqual([]);
    expect(story.keywords[0]?.kind).toBe('word');
  });

  it('parses the slots when present', () => {
    const story = parseStory(readyJson);
    expect(story.shelf).toEqual({ category: 'story-time', order: 1, sampler: true, minutes: 4 });
    expect(story.pillarTags).toEqual(['A1']);
    expect(story.card).toEqual({ titleEn: 'Hangul Day', keywordId: 'hangeullal', factId: 'f3' });
    expect(story.rewardCardIds).toEqual({ listen: 'card:story-hangul-day', read: 'card:book' });
    expect(story.errata[0]?.show).toBe(false);
  });

  it('defaults shelf.sampler to false', () => {
    const story = ready();
    delete (story.shelf as { sampler?: boolean }).sampler;
    expect(parseStory(story).shelf?.sampler).toBe(false);
  });

  it('is idempotent: parsing a parsed story gives the same story', () => {
    expect(parseStory(parseStory(readyJson))).toEqual(parseStory(readyJson));
  });
});

describe('parseStory: strictness and caps', () => {
  it('rejects a misspelt scene key (narationEn)', () => {
    const story = ready() as unknown as Record<string, unknown>;
    const scene = (story.tiers as Array<{ scenes: Array<Record<string, unknown>> }>)[0]!.scenes[0]!;
    scene.narationEn = scene.narrationEn;
    delete scene.narrationEn;
    const issues = issuesOf(story);
    expect(issues.some((i) => i.includes('narrationEn'))).toBe(true);
    expect(issues.some((i) => i.includes('Unrecognized key'))).toBe(true);
  });

  it.each([
    'origin',
    'review',
    'shelf',
    'card',
    'verification',
    'tiers.0',
    'tiers.0.scenes.0',
    'tiers.0.scenes.1.approximations.0',
    'tiers.0.scenes.0.keyword',
    'tiers.0.scenes.4.line',
    'tiers.0.scenes.0.art',
    'keywords.0',
    'cultureNotes.0',
    'facts.0',
    'facts.0.sources.0',
    'errata.0',
    'rewardCardIds',
  ])('rejects an unknown key inside %s', (path) => {
    const story = ready() as unknown as Record<string, unknown>;
    let node: unknown = story;
    for (const part of path.split('.')) node = (node as Record<string, unknown>)[part];
    (node as Record<string, unknown>).typo = true;
    expectIssue(story, path, 'Unrecognized key');
  });

  it('rejects an unknown top-level key', () => {
    expectIssue({ ...ready(), ageAdvisory: '5+' }, '', 'Unrecognized key');
  });

  it.each(['story:Bad', 'story:two--dashes', 'hangul-day', 'story:', 'story:a_b'])(
    'rejects the id %s',
    (id) => {
      expectIssue({ ...ready(), id }, 'id');
    },
  );

  it('rejects a wrong version and a zero contentVer', () => {
    expectIssue({ ...ready(), v: 2 }, 'v');
    expectIssue({ ...ready(), contentVer: 0 }, 'contentVer');
  });

  it('rejects a bad theme, kind, stage, minutes and goals count', () => {
    expectIssue({ ...ready(), theme: 'games' }, 'theme');
    expectIssue({ ...ready(), kind: 'poem' }, 'kind');
    expectIssue({ ...ready(), recommendedStage: 8 }, 'recommendedStage');
    expectIssue({ ...ready(), minutes: 1 }, 'minutes');
    expectIssue({ ...ready(), learningGoalsEn: ['one'] }, 'learningGoalsEn');
  });

  it('rejects an empty tiers list, repeated levels, and scenes outside 4..8', () => {
    expectIssue({ ...ready(), tiers: [] }, 'tiers');
    const twice = ready();
    twice.tiers[1]!.level = 'listen';
    expectIssue(twice, 'tiers.1.level', 'unique');
    const short = ready();
    short.tiers[0]!.scenes = short.tiers[0]!.scenes.slice(0, 3);
    expectIssue(short, 'tiers.0.scenes');
  });

  it('rejects a source that is not a URL and a date that is not YYYY-MM-DD', () => {
    const bad = ready();
    bad.facts[0]!.sources[0]!.url = 'not a url';
    expectIssue(bad, 'facts.0.sources.0.url');
    const date = ready();
    date.facts[0]!.sources[0]!.accessed = '10/09/2026';
    expectIssue(date, 'facts.0.sources.0.accessed');
  });

  it('rejects a verification record above the passes cap and without notes', () => {
    const story = ready();
    story.verification.passes = 10;
    expectIssue(story, 'verification.passes');
    const noNotes = ready();
    noNotes.verification.notes = '';
    expectIssue(noNotes, 'verification.notes');
  });
});

describe('parseStory: narration', () => {
  const withNarration = (text: string): Story => {
    const story = ready();
    story.tiers[0]!.scenes[2]!.narrationEn = text;
    return story;
  };
  const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  it('accepts 45 words and rejects 46', () => {
    expect(issuesOf(withNarration(words(45)))).toEqual([]);
    expectIssue(withNarration(words(46)), 'tiers.0.scenes.2.narrationEn', 'narration-too-long');
  });

  it('counts a token as one word', () => {
    expect(issuesOf(withNarration(`${words(44)} {kw:jamo-g}`))).toEqual([]);
    expectIssue(withNarration(`${words(45)} {kw:jamo-g}`), 'tiers.0.scenes.2.narrationEn');
  });

  it('rejects an empty narration and one over 320 characters', () => {
    expectIssue(withNarration(''), 'tiers.0.scenes.2.narrationEn');
    expectIssue(withNarration('x'.repeat(321)), 'tiers.0.scenes.2.narrationEn');
  });
});

describe('parseStory: cross-references', () => {
  it('rejects a scene fact that is not in facts[]', () => {
    const story = ready();
    story.tiers[0]!.scenes[0]!.factIds = ['f9'];
    expectIssue(story, 'tiers.0.scenes.0.factIds.0', 'fact-unknown');
  });

  it('rejects an unknown fact in a check, a checkpoint, a culture note and an approximation', () => {
    const check = ready();
    check.tiers[0]!.checks[0]!.factIds = ['f9'];
    expectIssue(check, 'tiers.0.checks.0.factIds.0', 'fact-unknown');
    const checkpoint = ready();
    checkpoint.tiers[0]!.checkpoints[0]!.factIds = ['f9'];
    expectIssue(checkpoint, 'tiers.0.checkpoints.0.factIds.0', 'fact-unknown');
    const note = ready();
    note.cultureNotes[0]!.factIds = ['f9'];
    expectIssue(note, 'cultureNotes.0.factIds.0', 'fact-unknown');
    const approx = ready();
    approx.tiers[0]!.scenes[1]!.approximations[0]!.factIds = ['f9'];
    expectIssue(approx, 'tiers.0.scenes.1.approximations.0.factIds.0', 'fact-unknown');
  });

  it('rejects a non-framing scene with no fact (framing without the flag)', () => {
    const story = ready();
    story.tiers[0]!.scenes[4]!.framing = false;
    expectIssue(story, 'tiers.0.scenes.4.factIds', 'scene-without-fact');
  });

  it('accepts a framing scene with no fact', () => {
    expect(issuesOf(ready())).toEqual([]);
  });

  it('rejects a missing coverSceneId', () => {
    const story = ready();
    story.coverSceneId = 's9';
    expectIssue(story, 'coverSceneId');
  });

  it('accepts a cover scene that exists in only one of the tiers', () => {
    const story = ready();
    story.coverSceneId = 's5';
    expect(issuesOf(story)).toEqual([]);
  });

  it('rejects duplicate scene ids in a tier', () => {
    const story = ready();
    story.tiers[0]!.scenes[1]!.id = 's1';
    expectIssue(story, 'tiers.0.scenes.1.id', 'unique');
  });

  it('rejects a sequence that is unresolved, not increasing or not four long', () => {
    const missing = ready();
    missing.tiers[0]!.sequenceSceneIds = ['s1', 's2', 's4', 's9'];
    expectIssue(missing, 'tiers.0.sequenceSceneIds.3');
    const backwards = ready();
    backwards.tiers[0]!.sequenceSceneIds = ['s1', 's4', 's2', 's5'];
    expectIssue(backwards, 'tiers.0.sequenceSceneIds.2', 'increasing');
    const repeated = ready();
    repeated.tiers[0]!.sequenceSceneIds = ['s1', 's2', 's2', 's5'];
    expectIssue(repeated, 'tiers.0.sequenceSceneIds.2', 'increasing');
    const short = ready();
    short.tiers[0]!.sequenceSceneIds = ['s1', 's2', 's4'];
    expectIssue(short, 'tiers.0.sequenceSceneIds');
  });

  it('rejects a checkpointId and a cultureNoteId that resolve to nothing', () => {
    const checkpoint = ready();
    checkpoint.tiers[0]!.scenes[2]!.checkpointId = 'cp9';
    expectIssue(checkpoint, 'tiers.0.scenes.2.checkpointId');
    const note = ready();
    note.tiers[0]!.scenes[0]!.cultureNoteId = 'cn-missing';
    expectIssue(note, 'tiers.0.scenes.0.cultureNoteId');
  });

  it('rejects a check id used twice across checks and checkpoints', () => {
    const story = ready();
    story.tiers[0]!.checkpoints[0]!.id = 'c1';
    expectIssue(story, 'tiers.0.checkpoints.0.id', 'unique');
    const twoChecks = ready();
    twoChecks.tiers[0]!.checks[1]!.id = 'c1';
    expectIssue(twoChecks, 'tiers.0.checks.1.id', 'unique');
  });

  it('rejects a check with two correct options', () => {
    const story = ready();
    story.tiers[0]!.checks[0]!.options[1]!.isCorrect = true;
    expectIssue(story, 'tiers.0.checks.0.options', 'exactly one option');
  });

  it('rejects newKeywordIds that are unknown or unused in the tier', () => {
    const unknown = ready();
    unknown.tiers[0]!.newKeywordIds = ['nope'];
    expectIssue(unknown, 'tiers.0.newKeywordIds.0', 'keywords[]');
    const unused = ready();
    unused.tiers[1]!.newKeywordIds = ['sejong', 'jamo-g'];
    expectIssue(unused, 'tiers.1.newKeywordIds.1', 'not used');
  });

  it('counts a keyword as used when a token, a scene keyword or a phrase line names it', () => {
    const story = ready();
    // tier 2: sejong is named only by a narration token, hangeullal-chukahaeyo only by a phrase line
    story.tiers[1]!.scenes[3]!.narrationEn = 'Everyone cheers!';
    story.tiers[1]!.newKeywordIds = ['sejong', 'hangeullal-chukahaeyo', 'hangeul'];
    expect(issuesOf(story)).toEqual([]);
  });

  it('rejects advisories without a note', () => {
    const story = ready();
    delete story.review.advisoryNoteEn;
    expectIssue(story, 'review.advisoryNoteEn');
    story.review.advisory = [];
    expect(issuesOf(story)).toEqual([]);
  });
});

describe('parseStory: the Korean of a scene', () => {
  it('requires exactly one of keyword and line at the listen level', () => {
    const both = ready();
    both.tiers[0]!.scenes[0]!.line = { ko: '세종', romanization: 'sejong', en: 'Sejong', speaker: 'narrator' };
    expectIssue(both, 'tiers.0.scenes.0', 'exactly one');
    const neither = ready();
    delete neither.tiers[0]!.scenes[0]!.keyword;
    expectIssue(neither, 'tiers.0.scenes.0', 'exactly one');
  });

  it('requires a line at read-along and read, with the keyword optional', () => {
    const noLine = ready();
    delete noLine.tiers[1]!.scenes[0]!.line;
    expectIssue(noLine, 'tiers.1.scenes.0.line', 'needs a line');
    const readTier = ready();
    readTier.tiers[1]!.level = 'read';
    expect(issuesOf(readTier)).toEqual([]);
    const noLineRead = ready();
    noLineRead.tiers[1]!.level = 'read';
    delete noLineRead.tiers[1]!.scenes[1]!.line;
    expectIssue(noLineRead, 'tiers.1.scenes.1.line', 'needs a line');
  });

  it('accepts a scene gloss that differs from the keyword gloss', () => {
    const story = ready();
    expect(story.tiers[0]!.scenes[0]!.keyword?.en).not.toBe(story.keywords[0]!.en);
    expect(issuesOf(story)).toEqual([]);
  });

  it('accepts a scene romanization that differs only in case', () => {
    const story = ready();
    expect(story.tiers[0]!.scenes[0]!.keyword?.romanization).toBe('Sejong');
    expect(issuesOf(story)).toEqual([]);
  });

  it('rejects a scene keyword with a different ko (keyword-inconsistent)', () => {
    const story = ready();
    story.tiers[0]!.scenes[0]!.keyword!.ko = '세종대왕';
    expectIssue(story, 'tiers.0.scenes.0.keyword.ko', 'keyword-inconsistent');
  });

  it('rejects a scene keyword with a different romanization', () => {
    const story = ready();
    story.tiers[0]!.scenes[0]!.keyword!.romanization = 'sejeong';
    expectIssue(story, 'tiers.0.scenes.0.keyword.romanization', 'keyword-inconsistent');
  });

  it('rejects a scene keyword whose id is not in keywords[]', () => {
    const story = ready();
    story.tiers[0]!.scenes[0]!.keyword!.id = 'nope';
    expectIssue(story, 'tiers.0.scenes.0.keyword.id', 'keyword-inconsistent');
  });

  it('checks a line against the phrase keyword with the same ko, ignoring case', () => {
    const story = ready();
    expect(story.tiers[1]!.scenes[3]!.line?.romanization).toBe('Hangeullal chukahaeyo');
    expect(issuesOf(story)).toEqual([]);
    story.tiers[1]!.scenes[3]!.line!.romanization = 'hangeullal chukhaeyo';
    expectIssue(story, 'tiers.1.scenes.3.line.romanization', 'keyword-inconsistent');
  });

  it('leaves a line that matches no phrase keyword free', () => {
    const story = ready();
    story.tiers[1]!.scenes[0]!.line!.romanization = 'anything goes';
    expect(issuesOf(story)).toEqual([]);
  });
});

describe('parseStory: ready-only requirements', () => {
  it('accepts the same edits on a draft and rejects them on a ready story', () => {
    const mutate = (s: Story): Story => {
      s.title.romanization = '';
      return s;
    };
    expect(issuesOf(mutate({ ...ready(), state: 'draft' }))).toEqual([]);
    expectIssue(mutate(ready()), 'title.romanization');
  });

  it('requires title.en', () => {
    const story = ready();
    story.title.en = '';
    expectIssue(story, 'title.en');
  });

  it('requires a caption on every scene', () => {
    const story = ready();
    delete story.tiers[1]!.scenes[2]!.captionEn;
    expectIssue(story, 'tiers.1.scenes.2.captionEn');
  });

  it('requires art or artPending: true on every scene', () => {
    const none = ready();
    delete none.tiers[0]!.scenes[0]!.art;
    expectIssue(none, 'tiers.0.scenes.0.art');
    const explicitFalse = ready();
    delete explicitFalse.tiers[0]!.scenes[2]!.artPending;
    explicitFalse.tiers[0]!.scenes[2]!.artPending = false;
    expectIssue(explicitFalse, 'tiers.0.scenes.2.art');
  });

  it('requires explainEn on every check and checkpoint', () => {
    const check = ready();
    delete check.tiers[0]!.checks[1]!.explainEn;
    expectIssue(check, 'tiers.0.checks.1.explainEn');
    const checkpoint = ready();
    delete checkpoint.tiers[0]!.checkpoints[0]!.explainEn;
    expectIssue(checkpoint, 'tiers.0.checkpoints.0.explainEn');
  });

  it('requires romanization and en on every keyword', () => {
    const rom = ready();
    rom.keywords[3]!.romanization = '';
    rom.tiers[0]!.scenes[2]!.keyword!.romanization = ''; // the scene copy must still agree
    expectIssue(rom, 'keywords.3.romanization');
    const en = ready();
    en.keywords[3]!.en = '';
    expectIssue(en, 'keywords.3.en');
  });

  it('requires hoyaIntroEn and hoyaOutroEn when there is a shelf block', () => {
    const story = ready();
    delete story.hoyaIntroEn;
    delete story.hoyaOutroEn;
    expectIssue(story, 'hoyaIntroEn');
    expectIssue(story, 'hoyaOutroEn');
    delete story.shelf;
    expect(issuesOf(story)).toEqual([]);
  });

  it('requires card.keywordId and card.factId to resolve', () => {
    const keyword = ready();
    keyword.card!.keywordId = 'nope';
    expectIssue(keyword, 'card.keywordId');
    const fact = ready();
    fact.card!.factId = 'f9';
    expectIssue(fact, 'card.factId');
  });

  it('does not require any of it from a draft', () => {
    const story = draft();
    expect(story.state).toBe('draft');
    expect(issuesOf(story)).toEqual([]);
  });

  it('also applies the cross-field rules to drafts', () => {
    const story = draft();
    story.tiers[0]!.scenes[0]!.factIds = ['f9'];
    expectIssue(story, 'tiers.0.scenes.0.factIds.0', 'fact-unknown');
  });
});

describe('sceneKorean', () => {
  it('returns the line, else the keyword, else undefined', () => {
    const story = ready();
    const listen = story.tiers[0]!.scenes;
    expect(sceneKorean(listen[0]!)).toBe(listen[0]!.keyword);
    expect(sceneKorean(listen[4]!)).toBe(listen[4]!.line);
    const along = story.tiers[1]!.scenes[1]!;
    expect(along.keyword).toBeDefined();
    expect(sceneKorean(along)).toBe(along.line);
    expect(sceneKorean({})).toBeUndefined();
  });
});

describe('StoryShelfSchema', () => {
  const shelf = { category: 'culture', order: 12, minutes: 5 };
  it('defaults sampler and accepts both categories', () => {
    expect(StoryShelfSchema.parse(shelf)).toEqual({ ...shelf, sampler: false });
    expect(StoryShelfSchema.safeParse({ ...shelf, category: 'story-time' }).success).toBe(true);
  });
  it.each([
    { category: 'games' },
    { order: 0 },
    { order: 1000 },
    { order: 1.5 },
    { minutes: 1 },
    { minutes: 11 },
    { extra: true },
  ])('rejects %j', (patch) => {
    expect(StoryShelfSchema.safeParse({ ...shelf, ...patch }).success).toBe(false);
  });
});

describe('StoryCardSchema', () => {
  const card = { titleEn: 'Hangul Day', keywordId: 'hangeullal', factId: 'f3' };
  it('accepts a card and rejects a long title, a bad fact id and extra keys', () => {
    expect(StoryCardSchema.safeParse(card).success).toBe(true);
    expect(StoryCardSchema.safeParse({ ...card, titleEn: 'x'.repeat(29) }).success).toBe(false);
    expect(StoryCardSchema.safeParse({ ...card, titleEn: '' }).success).toBe(false);
    expect(StoryCardSchema.safeParse({ ...card, factId: 'fact-3' }).success).toBe(false);
    expect(StoryCardSchema.safeParse({ ...card, rarity: 'rare' }).success).toBe(false);
  });
});

describe('CultureNoteSchema', () => {
  const note = {
    id: 'cn-hangul-day',
    titleEn: 'Hangul Day',
    bodyEn: 'Korea celebrates its alphabet.',
    term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
    factIds: ['f3'],
  };
  it('accepts a note, with or without a card', () => {
    expect(CultureNoteSchema.safeParse(note).success).toBe(true);
    expect(CultureNoteSchema.safeParse({ ...note, cardId: 'card:hanji' }).success).toBe(true);
  });
  it.each([
    { id: 'hangul-day' },
    { bodyEn: 'x'.repeat(221) },
    { titleEn: 'x'.repeat(61) },
    { factIds: [] },
    { factIds: ['f1', 'f2', 'f3', 'f4'] },
    { cardId: 'hanji' },
    { term: { ko: '한글날', romanization: '', en: 'Hangul Day' } },
    { term: { ko: '한글날', romanization: 'hangeullal', en: '' } },
  ])('rejects %j', (patch) => {
    expect(CultureNoteSchema.safeParse({ ...note, ...patch }).success).toBe(false);
  });
});

describe('koTextExtend', () => {
  const schema = koTextExtend({ id: z.string() });
  it('allows an empty romanization and gloss, which KoTextSchema forbids', () => {
    expect(schema.safeParse({ id: 'a', ko: '아버지', romanization: '', en: '' }).success).toBe(true);
  });
  it('keeps the syllables rule', () => {
    const base = { id: 'a', ko: '아버지', en: 'father' };
    expect(
      schema.safeParse({ ...base, romanization: 'abeoji', syllables: ['a', 'beo', 'ji'] }).success,
    ).toBe(true);
    const bad = schema.safeParse({ ...base, romanization: 'abeoji', syllables: ['a', 'beo'] });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(['syllables']);
  });
  it('is strict and keeps the caps', () => {
    const base = { id: 'a', ko: '아버지', romanization: 'abeoji', en: 'father' };
    expect(schema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, romanization: 'x'.repeat(121) }).success).toBe(false);
    expect(schema.safeParse({ ...base, en: 'x'.repeat(201) }).success).toBe(false);
    expect(schema.safeParse({ ...base, ko: '' }).success).toBe(false);
  });
  it('trims the romanization and the gloss', () => {
    const parsed = schema.parse({ id: 'a', ko: '아버지', romanization: ' abeoji ', en: ' father ' });
    expect(parsed.romanization).toBe('abeoji');
    expect(parsed.en).toBe('father');
  });
});
