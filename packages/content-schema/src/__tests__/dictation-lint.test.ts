import { describe, expect, it } from 'vitest';
import { lintCurriculum, type CurriculumFinding } from '../lesson-lint';

/**
 * F-CURR-002 section 4.5 (row CM-31): `dictation-unambiguous` on the homophone fixtures the row names. 낫 / 낮 / 낯 all
 * sound [낟], 같이 sounds [가치], and 학교 (said [학꾜]) is a tensification the romanization does not write; the
 * spelling round of Letters S2 (책이 / 채기, both [채기]) is settled by its picture or meaning, and its Listen & Pick
 * fallback keeps only options that sound different. An error for Volume 2 and packs, a warning for Volume 1.
 */

type Json = Record<string, unknown>;
const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const rows = (findings: CurriculumFinding[]) =>
  findings.filter((f) => f.rule === 'dictation-unambiguous').map((f) => `${f.severity} ${f.file} ${f.path}`);
const lint = (files: Record<string, unknown>) => lintCurriculum(new Map(Object.entries(files)));
const step = (kind: string, extra: Json = {}) => ({ id: kind, kind, titleEn: kind, ...extra });
const words = (...list: Array<[string, string, string]>) =>
  step('discover', { discover: { pages: [{ items: list.map(([ko, r, en]) => ({ type: 'word', word: kt(ko, r, en) })) }] } });
const teach = (id: string, ...list: Array<[string, string, string]>) => ({ id, steps: [words(...list)], scopes: [] });
const hear = (id: string, rounds: Json[]) => ({ id, steps: [step('check', { minigameRef: 'm:h' })], scopes: [{ ref: 'm:h', kind: 'type-hangul', rounds }] });
const pick = (id: string, rounds: Json[]) => ({ id, steps: [step('check', { minigameRef: 'm:p' })], scopes: [{ ref: 'm:p', kind: 'listen-pick', rounds }] });
const dictation = (ko: string, r: string, en: string, extra: Json = {}) => ({ id: `r-${r}`, promptEn: 'Type the word you hear.', mode: 'hear', target: kt(ko, r, en), ...extra });
const V2 = 'content/episodes/stage-2/letters.v2.json';
const V1 = 'content/episodes/stage-2/letters.json';
const v2 = (quests: Json[]) => ({ [V2]: { id: 'episode:stage2-letters-v2', stage: 'stage2', volume: 2, quests } });
const v1 = (quests: Json[]) => ({ [V1]: { id: 'episode:stage2-letters', stage: 'stage2', quests } });

const NAT: Array<[string, string, string]> = [['낫', 'nat', 'sickle'], ['낮', 'nat', 'daytime'], ['낯', 'nat', 'face']];

describe('dictation-unambiguous: homophones (낫 / 낮 / 낯)', () => {
  it('keeps each of the three out of Dictation when the others are taught: an error in Volume 2, and in Volume 1 since row CM-3B', () => {
    const rounds = NAT.map(([ko, r, en]) => dictation(ko, r, en));
    expect(rows(lint(v2([teach('quest:t', ...NAT), hear('quest:h', rounds)])))).toEqual([0, 1, 2].map((i) => `error ${V2} quests[1].scopes[0].rounds[${i}]`));
    expect(rows(lint(v1([teach('quest:t', ...NAT), hear('quest:h', rounds)])))).toEqual([0, 1, 2].map((i) => `error ${V1} quests[1].scopes[0].rounds[${i}]`));
  });

  it('admits one of them when it is the only spelling taught, or when a picture settles it', () => {
    expect(rows(lint(v2([teach('quest:t', ['낫', 'nat', 'sickle']), hear('quest:h', [dictation('낫', 'nat', 'sickle')])])))).toEqual([]);
    expect(rows(lint(v2([teach('quest:t', ...NAT), hear('quest:h', [dictation('낮', 'nat', 'daytime', { pictureRef: 'word:daytime' })])])))).toEqual([]);
  });

  it('does not admit a picture whose meaning another spelling of the sound shares (the compact row draws only the meaning)', () => {
    // 낫 and 낮 both taught as "thing": the picture settles it on a tall screen, but below 640 tall only "thing" shows.
    const same: Array<[string, string, string]> = [['낫', 'nat', 'thing'], ['낮', 'nat', 'thing']];
    expect(rows(lint(v2([teach('quest:t', ...same), hear('quest:h', [dictation('낮', 'nat', 'thing', { pictureRef: 'word:daytime' })])])))).toEqual([
      `error ${V2} quests[1].scopes[0].rounds[0]`,
    ]);
    // A gloss line alone does not settle it either when the meaning is shared.
    expect(rows(lint(v2([teach('quest:t', ...same), hear('quest:h', [dictation('낮', 'nat', 'thing', { promptEn: 'Type the word you hear: thing' })])])))).toEqual([
      `error ${V2} quests[1].scopes[0].rounds[0]`,
    ]);
    // Taught with their own meanings, the same picture round passes.
    expect(rows(lint(v2([teach('quest:t', ...NAT), hear('quest:h', [dictation('낮', 'nat', 'daytime', { promptEn: 'Type the word you hear: daytime' })])])))).toEqual([]);
  });
});

describe('dictation-unambiguous: vowels said alike (개 / 게)', () => {
  it('keeps 개 out of Dictation when 게 is taught, and admits it when a picture settles it or 게 is not taught', () => {
    const taught = teach('quest:t', ['개', 'gae', 'dog'], ['게', 'ge', 'crab']);
    expect(rows(lint(v2([taught, hear('quest:h', [dictation('개', 'gae', 'dog')])])))).toEqual([`error ${V2} quests[1].scopes[0].rounds[0]`]);
    expect(rows(lint(v2([taught, hear('quest:h', [dictation('개', 'gae', 'dog', { pictureRef: 'word:dog' })])])))).toEqual([]);
    expect(rows(lint(v2([teach('quest:t', ['개', 'gae', 'dog']), hear('quest:h', [dictation('개', 'gae', 'dog')])])))).toEqual([]);
  });
});

describe('dictation-unambiguous: sound changes (같이, 학교)', () => {
  it('keeps 같이 [가치] out of Dictation, alone or beside 가치', () => {
    expect(rows(lint(v2([teach('quest:t', ['같이', 'gachi', 'together']), hear('quest:h', [dictation('같이', 'gachi', 'together')])])))).toEqual([`error ${V2} quests[1].scopes[0].rounds[0]`]);
    const both = rows(lint(v2([teach('quest:t', ['같이', 'gachi', 'together'], ['가치', 'gachi', 'value']), hear('quest:h', [dictation('같이', 'gachi', 'together')])])));
    // Two findings for the one round: it has a homophone, and a sound change.
    expect(both).toEqual([`error ${V2} quests[1].scopes[0].rounds[0]`, `error ${V2} quests[1].scopes[0].rounds[0]`]);
  });

  it('excludes 학교 (tensification, said [학꾜]) from Dictation, with nothing else taught', () => {
    expect(rows(lint(v2([teach('quest:t', ['학교', 'hakgyo', 'school']), hear('quest:h', [dictation('학교', 'hakgyo', 'school')])])))).toEqual([`error ${V2} quests[1].scopes[0].rounds[0]`]);
    expect(rows(lint(v2([teach('quest:t', ['사과', 'sagwa', 'apple']), hear('quest:h', [dictation('사과', 'sagwa', 'apple')])])))).toEqual([]);
  });
});

describe('dictation-unambiguous: the spelling round (책이 / 채기)', () => {
  const taught = teach('quest:t', ['책', 'chaek', 'book'], ['책이', 'chaegi', 'book'], ['학교', 'hakgyo', 'school'], ['우유', 'uyu', 'milk']);
  const spelling = (extra: Json = {}) => ({
    id: 'sp',
    promptKind: 'spelling',
    prompt: kt('책이', 'chaegi', 'book'),
    options: [{ id: 'a', text: kt('책이', 'chaegi', 'book') }, { id: 'b', text: kt('채기', 'chaegi', 'book') }],
    answerId: 'a',
    fallbackOptions: [{ id: 'c', text: kt('학교', 'hakgyo', 'school') }, { id: 'd', text: kt('우유', 'uyu', 'milk') }],
    ...extra,
  });

  it('passes with its meaning or its picture, and fallback options that are taught and sound different', () => {
    expect(rows(lint(v2([taught, pick('quest:p', [spelling()])])))).toEqual([]);
    expect(rows(lint(v2([taught, pick('quest:p', [spelling({ pictureRef: 'word:book' })])])))).toEqual([]);
  });

  it('names its fallback options', () => {
    expect(rows(lint(v2([taught, pick('quest:p', [spelling({ fallbackOptions: undefined })])])))).toEqual([`error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions`]);
  });

  it('needs the picture or a meaning that is not blank', () => {
    expect(rows(lint(v2([taught, pick('quest:p', [spelling({ prompt: kt('책이', 'chaegi', '  ') })])])))).toEqual([`error ${V2} quests[1].scopes[0].rounds[0]`]);
  });

  it('refuses a fallback option that sounds like the answer or another option, or that is not taught', () => {
    const fallbackOptions = [
      { id: 'c', text: kt('채기', 'chaegi', 'x') },
      { id: 'd', text: kt('우유', 'uyu', 'milk') },
      { id: 'e', text: kt('우유', 'uyu', 'milk') },
      { id: 'f', pictureRef: 'word:x' },
    ];
    expect(rows(lint(v2([taught, pick('quest:p', [spelling({ fallbackOptions })])])))).toEqual([
      // The shape: 채기 is already an option, 우유 is offered twice, and a picture is not a spelling.
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[0].text.ko`,
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[2].text.ko`,
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[3].text`,
      // The sound: 채기 sounds like the answer and is not taught; the second 우유 sounds like the first.
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[0]`,
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[0]`,
      `error ${V2} quests[1].scopes[0].rounds[0].fallbackOptions[2]`,
    ]);
  });

  it('a plain heard pick between two spellings of one sound is not settled, even with a picture or a gloss line', () => {
    const plain = { id: 'lp', prompt: kt('낮', 'nat', 'daytime'), pictureRef: 'word:daytime', promptEn: 'daytime', options: [{ id: 'a', text: kt('낮', 'nat', 'daytime') }, { id: 'b', text: kt('낫', 'nat', 'sickle') }], answerId: 'a' };
    expect(rows(lint(v2([teach('quest:t', ...NAT), pick('quest:p', [plain])])))).toEqual([
      // A picture on a plain round is not drawn, so it is refused as well.
      `error ${V2} quests[1].scopes[0].rounds[0].pictureRef`,
      `error ${V2} quests[1].scopes[0].rounds[0]`,
    ]);
  });
});
