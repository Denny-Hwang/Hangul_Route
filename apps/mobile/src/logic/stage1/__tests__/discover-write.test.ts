import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { questsAll } from '../../../content';
import {
  autoHearId,
  buildDiscover as buildDiscoverWith,
  pageRender as pageRenderWith,
  startDiscover,
  stepDiscover,
  type DiscoverState,
} from '../discover-flow';
import { WRITE_ADVANCE_MS, jamoIdOfKey, writeLetters, writePageIndex, writeStripLine } from '../discover-write';

/**
 * AMENDMENTS-STAGE1-TRACE-COVERAGE row TC-1a (§3.5, §6 tests 1-5): the trace page's logic, behind `writeOnce`.
 */

const messages = getMessages('en');
const COPY = messages.learner.quest.discover;
const build = (pages: readonly DiscoverPage[], writeOnce: boolean): ReturnType<typeof buildDiscoverWith> =>
  buildDiscoverWith(pages, COPY, messages.a11y, 'en', undefined, { writeOnce });
const render = (model: ReturnType<typeof build>, state: DiscoverState): ReturnType<typeof pageRenderWith> =>
  pageRenderWith(model, state, 'always', COPY);

const ex = { ko: '가', romanization: 'ga', en: 'ga' };
const jamoPage = (...ids: string[]): DiscoverPage => ({ items: ids.map((jamoId) => ({ type: 'jamo' as const, jamoId, example: ex })) });
const wordsPage: DiscoverPage = { items: [{ type: 'word', word: { ko: '차', romanization: 'cha', en: 'tea' } }] };

const QUEST_IDS = [
  'letters-q1', 'letters-q2', 'letters-q3', 'life-q1', 'life-q2', 'life-q3', 'rites-q1', 'rites-q2', 'rites-q3', 'nature-q1', 'nature-q2',
];
/** The Discover pages of Stage 1 quest `n` (1-based, in the order of F-QUEST-002). */
const questPages = (n: number): DiscoverPage[] => {
  const quest = questsAll.find((q) => q.id === `quest:stage1-${QUEST_IDS[n - 1]}`)!;
  return quest.steps.find((s) => s.kind === 'discover')!.discover!.pages;
};

describe('WRITE_ADVANCE_MS', () => {
  it('is the 1100 ms beat after a finished letter (§3.3)', () => {
    expect(WRITE_ADVANCE_MS).toBe(1100);
  });
});

describe('writeLetters (§3.5)', () => {
  it("lists quest 1's letters in page order", () => {
    expect(writeLetters(questPages(1))).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
  });

  it('lists each id once, even when a content item repeats on two pages', () => {
    expect(writeLetters([jamoPage('jamo:a', 'jamo:eo'), jamoPage('jamo:a', 'jamo:giyeok')])).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok']);
  });

  it('skips words, other item kinds and jamo with no stroke data', () => {
    const exchange: DiscoverPage = {
      items: [
        {
          type: 'exchange',
          lines: [
            { speaker: 'a', speakerEn: 'Mina', line: { ko: '안녕', romanization: 'annyeong', en: 'hi' } },
            { speaker: 'b', speakerEn: 'Ben', line: { ko: '안녕', romanization: 'annyeong', en: 'hi' } },
          ],
        },
      ],
    };
    expect(writeLetters([wordsPage, exchange, jamoPage('jamo:ssanggiyeok', 'jamo:a')])).toEqual(['jamo:a']);
  });

  it('is empty for no pages', () => {
    expect(writeLetters([])).toEqual([]);
  });
});

describe('jamoIdOfKey', () => {
  it('drops the #n a repeated item carries', () => {
    expect(jamoIdOfKey('jamo:a')).toBe('jamo:a');
    expect(jamoIdOfKey('jamo:a#1')).toBe('jamo:a');
    expect(jamoIdOfKey('jamo:ieung-batchim#12')).toBe('jamo:ieung-batchim');
  });
});

describe('writePageIndex (§3.5)', () => {
  it('is the index after the last built page that holds a letter with stroke data', () => {
    expect(writePageIndex(build([jamoPage('jamo:a'), wordsPage, jamoPage('jamo:giyeok'), wordsPage], false).pages)).toBe(3);
  });

  it('puts the page before a trailing words page', () => {
    expect(writePageIndex(build([jamoPage('jamo:jieut', 'jamo:chieut'), wordsPage], false).pages)).toBe(1);
  });

  it('reads the jamo id of a repeated item (key jamo:a#1)', () => {
    const pages = build([jamoPage('jamo:a'), jamoPage('jamo:a'), wordsPage], false).pages;
    expect(pages[1]!.items[0]!.key).toBe('jamo:a#1');
    expect(writePageIndex(pages)).toBe(2);
  });

  it('is -1 (no trace page) for a letter with no stroke data, for words and for nothing', () => {
    expect(writePageIndex(build([jamoPage('jamo:ssanggiyeok'), wordsPage], false).pages)).toBe(-1);
    expect(writePageIndex([])).toBe(-1);
  });
});

describe('writeStripLine (§3.5): praise wins, then keep going, then shape guide, else idle', () => {
  const base = { traced: false, keepGoing: false, hintUp: false, last: false };
  it('covers each order', () => {
    expect(writeStripLine(base)).toBe('idle');
    expect(writeStripLine({ ...base, hintUp: true })).toBe('shapeGuide');
    expect(writeStripLine({ ...base, keepGoing: true })).toBe('keepGoing');
    expect(writeStripLine({ ...base, keepGoing: true, last: true })).toBe('keepGoingLast');
    expect(writeStripLine({ ...base, keepGoing: true, hintUp: true })).toBe('keepGoing');
    expect(writeStripLine({ ...base, traced: true, keepGoing: true, hintUp: true })).toBe('praise');
    expect(writeStripLine({ ...base, traced: true, last: true })).toBe('praise');
  });
});

describe('buildDiscover with writeOnce (§6 tests 1-3)', () => {
  it('quest 1: three pages, the third the trace page with ㅏ ㅓ ㄱ ㄴ; without the flag two pages', () => {
    const model = build(questPages(1), true);
    expect(model.pages).toHaveLength(3);
    const page = model.pages[2]!;
    expect(page.write!.key).toBe('write');
    expect(page.write!.letters.map((l) => l.jamoId)).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
    expect(page.items).toEqual([]);
    expect(page.exchange).toBeUndefined();
    expect(build(questPages(1), false).pages).toHaveLength(2);
    expect(buildDiscoverWith(questPages(1), COPY, messages.a11y).pages).toHaveLength(2);
    expect(buildDiscoverWith(questPages(1), COPY, messages.a11y, 'en', undefined, {}).pages).toHaveLength(2);
  });

  it("a letter carries its glyph, romanization, final flag and the card's own hear under write|<jamoId>", () => {
    const model = build(questPages(1), true);
    const [a, eo, giyeok] = model.pages[2]!.write!.letters;
    const card = model.pages[1]!.items[0]!;
    expect(giyeok).toMatchObject({ jamoId: 'jamo:giyeok', glyph: 'ㄱ', romanization: card.romanization, final: false });
    expect(giyeok!.hear).toEqual({ ...card.hear, id: 'write|jamo:giyeok' });
    expect(giyeok!.hear.spec.text).toBe('가');
    expect(a!.hear.id).toBe('write|jamo:a');
    expect(eo!.glyph).toBe('ㅓ');
  });

  it('quest 4: the trace page is page 2, before the words page', () => {
    const model = build(questPages(4), true);
    expect(model.pages[1]!.write!.letters.map((l) => l.jamoId)).toEqual(['jamo:jieut', 'jamo:chieut']);
    expect(model.pages[0]!.write).toBeUndefined();
    expect(model.pages[2]!.write).toBeUndefined();
    expect(model.pages).toHaveLength(build(questPages(4), false).pages.length + 1);
  });

  it('quests 7 and 10: page 2, the letters are finals', () => {
    for (const n of [7, 10]) {
      const model = build(questPages(n), true);
      const at = model.pages.findIndex((p) => p.write !== undefined);
      expect(at).toBe(1);
      expect(model.pages[at]!.write!.letters).toHaveLength(2);
      expect(model.pages[at]!.write!.letters.every((l) => l.final)).toBe(true);
    }
  });

  it('quest 8: page 3, before the Chuseok page, with a final among the letters', () => {
    const model = build(questPages(8), true);
    const at = model.pages.findIndex((p) => p.write !== undefined);
    expect(at).toBe(2);
    expect(model.pages[at]!.write!.letters.map((l) => l.jamoId)).toEqual(['jamo:ya', 'jamo:yeo', 'jamo:pieup', 'jamo:ieung-batchim']);
    expect(model.pages[at]!.write!.letters.map((l) => l.final)).toEqual([false, false, false, true]);
    expect(model.pages[at + 1]!.write).toBeUndefined();
  });

  it('quest 11 has no trace page; an upper-stage Discover whose letters have no stroke data has none', () => {
    expect(build(questPages(11), true).pages.some((p) => p.write !== undefined)).toBe(false);
    const upper = build([jamoPage('jamo:ssanggiyeok', 'jamo:ssangdigeut'), wordsPage], true);
    expect(upper.pages.some((p) => p.write !== undefined)).toBe(false);
    expect(upper.pages).toHaveLength(2);
  });

  it('a content item repeated on two pages appears once on the trace page', () => {
    const model = build([jamoPage('jamo:a', 'jamo:eo'), jamoPage('jamo:a', 'jamo:giyeok')], true);
    expect(model.pages).toHaveLength(3);
    expect(model.pages[2]!.write!.letters.map((l) => l.jamoId)).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok']);
  });

  it('an item that cannot be resolved is skipped on the trace page too, and no letter means no page', () => {
    const model = build([jamoPage('jamo:a', 'jamo:nope')], true);
    expect(model.pages[1]!.write!.letters.map((l) => l.jamoId)).toEqual(['jamo:a']);
    expect(build([jamoPage('jamo:nope')], true).pages).toEqual([]);
  });
});

describe('the reducer on a trace page (§6 tests 4-5)', () => {
  const model = build(questPages(1), true);
  const start = startDiscover(model);

  it('starts with the first letter and nothing traced', () => {
    expect(start.write).toEqual({ at: 0, count: 4, traced: [] });
    expect(startDiscover(build(questPages(1), false)).write).toEqual({ at: 0, count: 0, traced: [] });
    expect(startDiscover(model, { lastPage: true }).page).toBe(2);
  });

  it('traced adds once and never removes', () => {
    const a = stepDiscover(start, { type: 'traced', jamoId: 'jamo:a' });
    expect(a.state.write.traced).toEqual(['jamo:a']);
    expect(a.effects).toEqual([]);
    const again = stepDiscover(a.state, { type: 'traced', jamoId: 'jamo:a' });
    expect(again.state.write.traced).toEqual(['jamo:a']);
    const two = stepDiscover(again.state, { type: 'traced', jamoId: 'jamo:eo' });
    expect(two.state.write.traced).toEqual(['jamo:a', 'jamo:eo']);
  });

  it('writeNext moves on only when from is the current letter, so a timer and a tap never skip one', () => {
    const a = stepDiscover(start, { type: 'writeNext', from: 0 });
    expect(a.state.write.at).toBe(1);
    expect(a.effects).toEqual([]);
    expect(stepDiscover(a.state, { type: 'writeNext', from: 0 }).state.write.at).toBe(1);
    expect(stepDiscover(a.state, { type: 'writeNext', from: 2 }).state.write.at).toBe(1);
  });

  it('at stops at the last letter', () => {
    let s = start;
    for (let i = 0; i < 10; i += 1) s = stepDiscover(s, { type: 'writeNext', from: s.write.at }).state;
    expect(s.write.at).toBe(3);
    expect(stepDiscover(s, { type: 'writeNext', from: 3 }).state.write.at).toBe(3);
  });

  it('writeNext with no trace page does nothing', () => {
    const plain = startDiscover(build(questPages(1), false));
    expect(stepDiscover(plain, { type: 'writeNext', from: 0 }).state.write).toEqual({ at: 0, count: 0, traced: [] });
  });

  it('next, prev and hear keep write', () => {
    let s = stepDiscover(stepDiscover(start, { type: 'traced', jamoId: 'jamo:a' }).state, { type: 'writeNext', from: 0 }).state;
    const kept = s.write;
    s = stepDiscover(s, { type: 'next' }).state;
    expect(s.write).toEqual(kept);
    s = stepDiscover(s, { type: 'next' }).state;
    expect(s.page).toBe(2);
    expect(s.write).toEqual(kept);
    s = stepDiscover(s, { type: 'prev' }).state;
    expect(s.write).toEqual(kept);
    s = stepDiscover(s, { type: 'hear', id: 'write|jamo:a' }).state;
    expect(s.write).toEqual(kept);
    expect(s.tapped).toEqual(['write|jamo:a']);
  });

  it('done carries written, the number of letters traced', () => {
    let s = start;
    s = stepDiscover(s, { type: 'traced', jamoId: 'jamo:a' }).state;
    s = stepDiscover(s, { type: 'traced', jamoId: 'jamo:eo' }).state;
    s = stepDiscover(s, { type: 'next' }).state;
    s = stepDiscover(s, { type: 'next' }).state;
    expect(stepDiscover(s, { type: 'next' }).effects).toEqual([{ type: 'done', pages: 3, heard: 0, written: 2 }]);
  });

  it('done is written: 0 when nothing was traced', () => {
    expect(stepDiscover({ ...start, page: 2 }, { type: 'next' }).effects).toEqual([{ type: 'done', pages: 3, heard: 0, written: 0 }]);
  });

  it('autoHearId on a trace page is undefined', () => {
    expect(autoHearId(model, 2)).toBeUndefined();
    expect(autoHearId(model, 1)).toBe('jamo:giyeok|sound');
  });

  it('pageRender of a trace page has write, no items, Continue enabled and the usual dots and page', () => {
    const traced = stepDiscover(start, { type: 'traced', jamoId: 'jamo:a' }).state;
    const onWrite = render(model, { ...traced, page: 2, furthest: 2 });
    expect(onWrite.empty).toBe(false);
    expect(onWrite.items).toEqual([]);
    expect(onWrite.exchange).toBeUndefined();
    expect(onWrite.continueEnabled).toBe(true);
    expect(onWrite.page).toBe(3);
    expect(onWrite.dots).toEqual({ value: 3, max: 3 });
    expect(onWrite.hasPrevious).toBe(true);
    expect(onWrite.isLast).toBe(true);
    expect(onWrite.write).toMatchObject({ at: 0, traced: ['jamo:a'], last: false });
    expect(onWrite.write!.letters).toHaveLength(4);
    expect(render(model, { ...traced, page: 2, furthest: 2, write: { at: 3, count: 4, traced: ['jamo:a'] } }).write!.last).toBe(true);
  });

  it('a card page has no write', () => {
    expect(render(model, start).write).toBeUndefined();
  });

  it('a trace page that is not the last page is not the last', () => {
    const quest4 = build(questPages(4), true);
    const r = render(quest4, { ...startDiscover(quest4), page: 1, furthest: 1 });
    expect(r.write).toBeDefined();
    expect(r.isLast).toBe(false);
  });
});
