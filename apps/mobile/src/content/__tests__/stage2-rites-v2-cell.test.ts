import { readFileSync } from 'node:fs';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { allowlistedInstitution } from '@hangul-route/content-schema/lint';
import { SEOLLAL_ROOM_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/seollal-room';
import { describe, expect, it } from 'vitest';
import { canDrawPicture } from '../../logic/__tests__/drawn-pictures';

/**
 * F-CURR-002 row CM-45 S2, Holidays Volume 2 of Stage 2 (`content/episodes/stage-2/rites.v2.json`, §5.4 S2, OD-9): the
 * foods of the first lunar month with the Holidays scene (`scene:seollal-room`) placed in quest 1, Dano, Dongji and 차례
 * as a reading word with a neutral, sourced note, and the first birthday with Syllable Build. The cell's own checks
 * beside the shared ones of upper-stage-curriculum.test.ts (U-1 to U-11) and the §9.3 lint rules, which are errors for
 * a Volume 2 file.
 */

const read = (file: string): LessonCell =>
  LessonCellSchema.parse(JSON.parse(readFileSync(new URL(`../../../../../content/episodes/stage-2/${file}`, import.meta.url), 'utf8')));
const overlay = (locale: 'es' | 'ko'): Record<string, Record<string, string>> =>
  (JSON.parse(readFileSync(new URL(`../../../../../content/i18n/${locale}/lessons-stage2-rites-v2.json`, import.meta.url), 'utf8')) as { entries: Record<string, Record<string, string>> }).entries;
const CELL = read('rites.v2.json');
const VOLUME1 = read('rites.json');
const STAGE2_VOLUME1 = ['letters.json', 'life.json', 'rites.json', 'nature.json', 'crafts.json'].map(read);

const STAGE1_INITIALS = new Set([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ']);
const STAGE1_VOWELS = new Set([...'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ']);
const STAGE1_FINALS = new Set([...'ㄱㄴㄹㅁㅂㅇ']);
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** True when every syllable of `ko` is built from Stage 1 symbols only (F-CURR-001 §3.1 rule 6). */
function decodable(ko: string): boolean {
  return [...ko.replace(/[\s.?!,]/g, '')].every((ch) => {
    const code = ch.codePointAt(0)! - 0xac00;
    if (code < 0 || code > 11171) return false;
    const final = FINALS[code % 28]!;
    return STAGE1_INITIALS.has(INITIALS[Math.floor(code / 588)]!) && STAGE1_VOWELS.has(VOWELS[Math.floor((code % 588) / 28)]!) && (final === '' || STAGE1_FINALS.has(final));
  });
}

const discoverWords = (quest: LessonQuest): string[] =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'word' ? [i.word.ko] : []))) ?? []);
const scopeOf = (quest: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = quest.steps.find((s) => s.kind === kind)!.minigameRef!;
  return quest.scopes.find((s) => s.ref === ref)!;
};
const triple = (quest: LessonQuest): string => (['practice', 'apply', 'check'] as const).map((k) => scopeOf(quest, k).kind).join(' / ');

/** The Korean a scope asks for: the answer of every round (a wrong option or a scene's other thing is never asked). */
function asked(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'listen-pick':
      return scope.rounds.map((r) => r.prompt.ko);
    case 'pic-word-match':
      return scope.boards.flatMap((b) => b.pairs.map((p) => p.word.ko));
    case 'card-match':
      return scope.pairs.map((p) => p.ko);
    case 'type-hangul':
      return scope.rounds.map((r) => r.target.ko);
    case 'hidden-heritage':
      return scope.rounds.flatMap((r) => r.targets.map((t) => t.word.ko));
    case 'syllable-build':
      return scope.rounds.map((r) => r.target.ko);
    default:
      return [];
  }
}
const taughtBy = (cell: LessonCell): Set<string> => new Set(cell.quests.flatMap((q) => [...discoverWords(q), ...q.scopes.flatMap(asked)]));

describe('Holidays Volume 2, Stage 2 (row CM-45 S2)', () => {
  it('is the second volume of the Stage 2 Holidays cell: three quests with -v2 ids, stamped, no card of its own', () => {
    expect([CELL.id, CELL.volume, CELL.stage, CELL.theme, CELL.status]).toEqual(['episode:stage2-rites-v2', 2, 'stage2', 'rites', 'ready']);
    expect(CELL.quests.map((q) => q.id)).toEqual(['quest:stage2-rites-v2-q1', 'quest:stage2-rites-v2-q2', 'quest:stage2-rites-v2-q3']);
    for (const q of CELL.quests) expect(q.addedIn, q.id).toBeGreaterThan(20261028);
    expect(CELL.rewardCardIds).toEqual([]);
    expect(VOLUME1.status).toBe('ready');
  });

  it('teaches holiday foods, Dano, Dongji and 차례, and the first birthday (§5.4 S2), each Discover with at most 4 new words', () => {
    expect(CELL.quests.map(discoverWords)).toEqual([
      ['떡국', '한복', '오곡밥', '부럼'],
      ['단오', '송편', '동지', '팥죽', '차례'],
      ['돌잔치', '돌잡이', '실', '국수'],
    ]);
    // 떡국, 한복 and 송편 come from Volume 1. 돌 alone, a homograph of the taught 'stone', is not taught; 돈 is a held-out
    // probe block of the Block Sprint (row CM-32), so it is not taught either.
    const route = new Set(STAGE2_VOLUME1.flatMap((c) => [...taughtBy(c)]));
    const fresh = CELL.quests.map((q) => discoverWords(q).filter((ko) => !route.has(ko)));
    expect(fresh).toEqual([['오곡밥', '부럼'], ['단오', '동지', '팥죽', '차례'], ['돌잔치', '돌잡이', '실', '국수']]);
    for (const words of fresh) expect(words.length).toBeLessThanOrEqual(4);
  });

  it('places scene:seollal-room in quest 1 as its Apply, the scene reference round unchanged', () => {
    const apply = scopeOf(CELL.quests[0]!, 'apply');
    expect(apply.kind).toBe('hidden-heritage');
    expect(apply.kind === 'hidden-heritage' && apply.rounds).toEqual([SEOLLAL_ROOM_SCENE.round]);
  });

  it('plays the §5.4 S2 formats: Pic-Word Match, Syllable Build and Hidden Heritage', () => {
    const kinds = new Set(CELL.quests.flatMap((q) => q.scopes.map((s) => s.kind)));
    for (const kind of ['pic-word-match', 'syllable-build', 'hidden-heritage'] as const) expect(kinds.has(kind), kind).toBe(true);
  });

  it('its Practice, Apply and Check triples differ from Volume 1 and from each other; the Checks rotate (§5.1, §7.1)', () => {
    const v1 = new Set(VOLUME1.quests.map(triple));
    expect(CELL.quests.map(triple)).toEqual([
      'listen-pick / hidden-heritage / listen-pick',
      'listen-pick / card-match / pic-word-match',
      'listen-pick / syllable-build / type-hangul',
    ]);
    for (const q of CELL.quests) expect(v1.has(triple(q)), q.id).toBe(false);
    // Read Pick Meaning, Pic-Word Match and Dictation: one Check each, 33 in 100 of the cell's Checks.
    const [q1, , q3] = CELL.quests;
    const readPick = scopeOf(q1!, 'check');
    expect(readPick.kind === 'listen-pick' && readPick.rounds.every((r) => r.promptShown === true && r.options.every((o) => o.pictureRef !== undefined && o.text === undefined))).toBe(true);
    const dictation = scopeOf(q3!, 'check');
    expect(dictation.kind === 'type-hangul' && dictation.rounds.map((r) => [r.mode, r.target.ko])).toEqual([
      ['hear', '실'],
      ['hear', '동지'],
    ]);
  });

  it('every Check asks a word its own Discover teaches, and every new word is asked in its own quest (F-CURR-001 §3.1 rule 4)', () => {
    const route = new Set(STAGE2_VOLUME1.flatMap((c) => [...taughtBy(c)]));
    for (const q of CELL.quests) {
      expect(asked(scopeOf(q, 'check')).some((ko) => discoverWords(q).includes(ko)), q.id).toBe(true);
      const games = new Set(q.scopes.flatMap(asked));
      for (const ko of discoverWords(q).filter((w) => !route.has(w))) expect(games.has(ko), `${q.id} ${ko}`).toBe(true);
    }
  });

  it('U-4: every scored read, every Syllable Build tile and every Dictation answer uses Stage 1 symbols only', () => {
    for (const q of CELL.quests) {
      for (const scope of q.scopes) {
        if (scope.kind === 'type-hangul') for (const r of scope.rounds) expect(decodable(r.target.ko), r.target.ko).toBe(true);
        if (scope.kind === 'syllable-build') {
          for (const r of scope.rounds) {
            expect(decodable(r.target.ko), r.target.ko).toBe(true);
            for (const tile of [...r.firstTiles, ...r.vowelTiles]) expect(STAGE1_INITIALS.has(tile) || STAGE1_VOWELS.has(tile), `${r.id} ${tile}`).toBe(true);
            for (const tile of r.finalTiles) expect(STAGE1_FINALS.has(tile), `${r.id} ${tile}`).toBe(true);
          }
        }
        if (scope.kind !== 'listen-pick') continue;
        for (const r of scope.rounds) {
          if (r.promptShown === true) expect(decodable(r.prompt.ko), r.prompt.ko).toBe(true);
          for (const o of r.options) if (o.text !== undefined) expect(decodable(o.text.ko), `${r.id} ${o.text.ko}`).toBe(true);
        }
      }
    }
    // The words with a Word Builder symbol are matched (Card Match), heard or pictured, never read for a score.
    expect(['차례', '팥죽', '떡국', '떡'].some(decodable)).toBe(false);
  });

  it('every picture is drawn art, and within a quest one picture always names one word', () => {
    for (const q of CELL.quests) {
      const named = new Map<string, Set<string>>();
      const add = (ref: string | undefined, ko: string | undefined): void => {
        if (ref === undefined || ko === undefined) return;
        expect(canDrawPicture(ref), `${q.id} ${ref}`).toBe(true);
        named.set(ref, (named.get(ref) ?? new Set()).add(ko));
      };
      for (const s of q.steps) for (const p of s.discover?.pages ?? []) for (const i of p.items) if (i.type === 'word') add(i.picture, i.word.ko);
      for (const scope of q.scopes) {
        if (scope.kind === 'pic-word-match') for (const b of scope.boards) for (const p of b.pairs) add(p.pictureRef, p.word.ko);
        if (scope.kind === 'hidden-heritage') for (const r of scope.rounds) for (const t of r.targets) add(t.picture, t.word.ko);
        if (scope.kind === 'listen-pick') {
          const byId = new Map(scope.rounds.map((r) => [r.answerId, r.prompt.ko] as const));
          for (const r of scope.rounds) for (const o of r.options) add(o.pictureRef, o.id === r.answerId ? r.prompt.ko : byId.get(o.id));
        }
      }
      for (const [ref, words] of named) expect([...words], `${q.id} ${ref}`).toHaveLength(1);
    }
  });

  it('recycles Volume 1 items in new contexts: 30 in 100 or more of what each quest asks, and about 40 in 100 of the cell (§5.1)', () => {
    const route = new Set(STAGE2_VOLUME1.flatMap((c) => [...taughtBy(c)]));
    const all = new Set<string>();
    const recycled = new Set<string>();
    for (const q of CELL.quests) {
      const items = [...new Set(q.scopes.flatMap(asked))];
      const fromVolume1 = items.filter((ko) => route.has(ko));
      expect(fromVolume1.length / items.length, q.id).toBeGreaterThanOrEqual(0.3);
      for (const ko of items) all.add(ko);
      for (const ko of fromVolume1) recycled.add(ko);
    }
    // 떡국, 한복, 송편, 연, 보름달, 그네, 국, 밥 and 떡, taught by Stage 2 Volume 1: 9 of the 19 words the cell asks (47 in 100).
    expect([recycled.size, all.size]).toEqual([9, 19]);
  });

  it('carries five sourced culture notes, each source from the §6.6 allowlist under its name on the access date, checked three times or more', () => {
    expect(CELL.culture.map((n) => [n.id, n.kind])).toEqual([
      ['n1', 'culture'],
      ['n2', 'culture'],
      ['n3', 'culture'],
      ['n4', 'culture'],
      ['n5', 'culture'],
    ]);
    for (const note of CELL.culture) {
      expect(note.sources?.length, note.id).toBeGreaterThanOrEqual(2);
      // The tip on screen names the first source: the National Folk Museum of Korea for every note.
      expect(allowlistedInstitution(note.sources![0]!.publisher, note.sources![0]!.accessed, note.sources![0]!.url)?.institution.name, note.id).toBe('National Folk Museum of Korea');
      for (const s of note.sources ?? []) {
        const match = allowlistedInstitution(s.publisher, s.accessed, s.url);
        expect(match, `${note.id} ${s.url}`).toBeDefined();
        expect(match?.nameAsOfAccess, note.id).toBe(true);
        expect(s.quoteOrLocator.length, note.id).toBeGreaterThan(0);
      }
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
      expect(note.verification.scope, note.id).toBe('lesson');
    }
  });

  it('OD-9: 차례 is a reading word whose notes describe the rite neutrally, say it differs by family, and are shown where it is taught', () => {
    const q2 = CELL.quests[1]!;
    expect(discoverWords(q2)).toContain('차례');
    const charye = CELL.culture.find((n) => n.textEn.includes('{ko:차례}'))!;
    // Quest k shows note k at its reward step (row CM-3C): the 차례 note is the one quest 2 shows.
    expect(CELL.culture.indexOf(charye)).toBe(1);
    const discoverNote = q2.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).find((i) => i.type === 'word' && i.word.ko === '차례');
    const lines = [charye.textEn, discoverNote && 'noteEn' in discoverNote ? String(discoverNote.noteEn) : ''];
    for (const line of lines) {
      expect(line, line).toMatch(/famil/);
      expect(line, line).not.toMatch(/\b(all|every|always|must|should|worship|spirit|ghost|god|pray)\b/i);
    }
    for (const locale of ['es', 'ko'] as const) expect(overlay(locale)[CELL.id]!['culture.n2.text'], locale).toContain('{ko:차례}');
  });

  it('frames shared East Asian heritage as shared and gives UNESCO status only to the inscribed element, under its UNESCO name (§5.1)', () => {
    const text = (ko: string) => CELL.culture.find((n) => n.textEn.includes(`{ko:${ko}}`))!.textEn;
    expect(text('동지')).toMatch(/shared across East Asia/);
    expect(text('동지')).toMatch(/Chinese/);
    expect(text('돌잡이')).toMatch(/Chinese books record a similar custom/);
    expect(text('단오')).toMatch(/UNESCO proclaimed the Gangneung Danoje festival in 2005 and inscribed it in 2008/);
    for (const note of CELL.culture) {
      expect(note.textEn, note.id).not.toMatch(/Korean (invention|origin)|invented in Korea|began in Korea|all Koreans/i);
      if (!note.textEn.includes('{ko:단오}')) expect(note.textEn, note.id).not.toMatch(/UNESCO/);
    }
  });

  it('is signed off by the multi-agent review (MAR), with no native-speaker or expert review claimed', () => {
    expect([CELL.review.language, CELL.review.culture, CELL.review.reviewedBy]).toEqual(['native-reviewed', 'culture-reviewed', 'MAR']);
    const record = [...CELL.review.notes, ...CELL.culture.map((n) => n.verification.notes)].join('\n');
    expect(record).toMatch(/No native-speaker or expert review is claimed/);
    expect(record).not.toMatch(/reviewed by a native speaker|native-speaker review (was|has been) done|expert review (was|has been) done/i);
  });
});
