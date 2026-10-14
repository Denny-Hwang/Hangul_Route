import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll } from '../heritage-cards';

/**
 * Heritage card copy has no age wording (CLAUDE.md section 1, owner decision D1, issue #589):
 * a card's title, blurb and fact are read by learners of any age and projected on a classroom
 * screen by the lecture presenter, so none of them says who learns (kids, children) by age.
 * The check covers the hand-written English cards, the Stage 1 card content JSON and every
 * es / ko card overlay. A story card is left out: its fact is its story's sourced fact,
 * verbatim (F-STORY-006 T-AWARD-6), so it is reworded only in the story with its sources.
 */
const AGE_WORDS: Record<'en' | 'es' | 'ko', RegExp> = {
  en: /\b(kids?|child(ren|hood)?|little ones?|toddlers?|young (learners?|readers?))\b/i,
  es: /\b(niñ[oa]s?|niñez|chic[oa]s?|infantil(es)?|infancia)\b/iu,
  // eorini, aideul, kkoma, aedeul (Korean words for "child", "children", "little one", "kids"), and a word-bounded
  // ai ("child") with its common particles, written as escapes so this file holds no Hangul. The bound keeps
  // longer words that start with the same two syllables (aiseukeurim, "ice cream") out of the match.
  ko: /\uC5B4\uB9B0\uC774|\uAF2C\uB9C8|\uC560\uB4E4|(^|[\s"'(])\uC544\uC774(\uB4E4|\uAC00|\uB294|\uC758|\uB97C|\uB3C4|\uC640)?(?=[\s.,!?"')]|$)/u,
};

const REPO = join(__dirname, '../../../../..');

interface JsonCard {
  id: string;
  title: string;
  blurb?: string;
  fact?: string;
}

const offenders = (entries: Array<[string, string | undefined]>, re: RegExp): string[] =>
  entries.filter(([, text]) => text !== undefined && re.test(text)).map(([where, text]) => `${where}: ${text ?? ''}`);

describe('heritage card copy has no age words (#589)', () => {
  it('the guard catches the age words it is meant to catch', () => {
    expect(AGE_WORDS.en.test('Korean kids first learn to read')).toBe(true);
    expect(AGE_WORDS.en.test('Children bow')).toBe(true);
    expect(AGE_WORDS.en.test('every kid has an umbrella')).toBe(true);
    expect(AGE_WORDS.en.test('Kidney beans and a skidding sled')).toBe(false);
    expect(AGE_WORDS.es.test('los niños cantan')).toBe(true);
    expect(AGE_WORDS.ko.test('\uC5B4\uB9B0\uC774')).toBe(true);
    expect(AGE_WORDS.en.test('for little ones and young learners')).toBe(true);
    expect(AGE_WORDS.es.test('los chicos juegan')).toBe(true);
    expect(AGE_WORDS.es.test('desde la niñez')).toBe(true);
    // ai-ga (a child, subject), ai alone, kkoma, aedeul.
    expect(AGE_WORDS.ko.test('\uC544\uC774\uAC00 \uC77D\uC5B4\uC694')).toBe(true);
    expect(AGE_WORDS.ko.test('\uC544\uC774')).toBe(true);
    expect(AGE_WORDS.ko.test('\uAF2C\uB9C8')).toBe(true);
    expect(AGE_WORDS.ko.test('\uC560\uB4E4')).toBe(true);
    // Not age words: aiseukeurim ("ice cream") and a Spanish "chicle".
    expect(AGE_WORDS.ko.test('\uC544\uC774\uC2A4\uD06C\uB9BC')).toBe(false);
    expect(AGE_WORDS.es.test('un chicle')).toBe(false);
  });

  it('no hand-written English card title, blurb or fact carries an age word', () => {
    const handWritten = heritageCardsAll.filter((c) => c.storyId === undefined && !c.unlockedBy.startsWith('set:'));
    expect(handWritten.map((c) => c.id)).toEqual(expect.arrayContaining(['card:book', 'card:seollal']));
    const entries = handWritten.flatMap((c): Array<[string, string | undefined]> => [
      [`${c.id} title`, c.titleEn],
      [`${c.id} blurb`, c.blurbEn],
      [`${c.id} fact`, c.factEn],
    ]);
    expect(entries.length).toBeGreaterThan(0);
    expect(offenders(entries, AGE_WORDS.en)).toEqual([]);
  });

  it('no Stage 1 card in content/episodes/stage-1/cards.json carries an age word', () => {
    const cards = JSON.parse(readFileSync(join(REPO, 'content/episodes/stage-1/cards.json'), 'utf8')) as JsonCard[];
    expect(cards.length).toBeGreaterThan(0);
    const entries = cards.flatMap((c): Array<[string, string | undefined]> => [
      [`${c.id} title`, c.title],
      [`${c.id} blurb`, c.blurb],
      [`${c.id} fact`, c.fact],
    ]);
    expect(offenders(entries, AGE_WORDS.en)).toEqual([]);
  });

  it.each(['es', 'ko'] as const)('no %s card overlay carries an age word', (locale) => {
    const byId = OVERLAYS[locale] ?? {};
    const entries = Object.entries(byId)
      .filter(([id]) => id.startsWith('card:'))
      .flatMap(([id, fields]) => Object.entries(fields).map(([field, text]): [string, string] => [`${id} ${field}`, text]));
    expect(offenders(entries, AGE_WORDS[locale])).toEqual([]);
  });
});
