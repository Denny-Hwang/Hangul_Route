import { readFileSync } from 'node:fs';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { allowlistedInstitution } from '@hangul-route/content-schema/lint';
import { PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { describe, expect, it } from 'vitest';
import { canDrawPicture } from '../../logic/__tests__/drawn-pictures';

/**
 * F-CURR-002 row CM-42 S2, Play Volume 2 of Stage 2 (`content/episodes/stage-2/crafts.v2.json`, §5.6 S2): folk games
 * and toys, the five colours (오방색) and shapes, with the Play scene (`scene:play-courtyard`) placed in quest 1. The
 * cell's own checks beside the shared ones of upper-stage-curriculum.test.ts (U-1 to U-11) and the §9.3 lint rules,
 * which are errors for a Volume 2 file.
 */

const read = (file: string): LessonCell =>
  LessonCellSchema.parse(JSON.parse(readFileSync(new URL(`../../../../../content/episodes/stage-2/${file}`, import.meta.url), 'utf8')));
const CELL = read('crafts.v2.json');
const VOLUME1 = read('crafts.json');
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
    default:
      return [];
  }
}
const taughtBy = (cell: LessonCell): Set<string> => new Set(cell.quests.flatMap((q) => [...discoverWords(q), ...q.scopes.flatMap(asked)]));

describe('Play Volume 2, Stage 2 (row CM-42 S2)', () => {
  it('is the second volume of the Stage 2 Play cell: three quests with -v2 ids, stamped, no card of its own', () => {
    expect([CELL.id, CELL.volume, CELL.stage, CELL.theme, CELL.status]).toEqual(['episode:stage2-crafts-v2', 2, 'stage2', 'crafts', 'ready']);
    expect(CELL.quests.map((q) => q.id)).toEqual(['quest:stage2-crafts-v2-q1', 'quest:stage2-crafts-v2-q2', 'quest:stage2-crafts-v2-q3']);
    for (const q of CELL.quests) expect(q.addedIn, q.id).toBeGreaterThan(20261028);
    expect(CELL.rewardCardIds).toEqual([]);
    expect(VOLUME1.status).toBe('ready');
  });

  it('teaches folk games and toys, the five colours and three shapes (§5.6 S2), each Discover with at most 4 new words', () => {
    expect(CELL.quests.map(discoverWords)).toEqual([
      ['연', '연날리기', '공기', '윷'],
      ['파란색', '빨간색', '노란색', '하얀색', '검은색'],
      ['동그라미', '세모', '네모', '딱지'],
    ]);
  });

  it('places scene:play-courtyard in quest 1 as its Apply, the scene reference round unchanged', () => {
    const apply = scopeOf(CELL.quests[0]!, 'apply');
    expect(apply.kind).toBe('hidden-heritage');
    expect(apply.kind === 'hidden-heritage' && apply.rounds).toEqual([PLAY_COURTYARD_SCENE.round]);
  });

  it('its Practice, Apply and Check triples differ from Volume 1 and from each other; the Checks rotate (§5.1, §7.1)', () => {
    const v1 = new Set(VOLUME1.quests.map(triple));
    expect(CELL.quests.map(triple)).toEqual([
      'listen-pick / hidden-heritage / listen-pick',
      'pic-word-match / listen-pick / pic-word-match',
      'listen-pick / card-match / type-hangul',
    ]);
    for (const q of CELL.quests) expect(v1.has(triple(q)), q.id).toBe(false);
    // Read Pick Meaning, Pic-Word Match and Dictation: one Check each, 33 in 100 of the Volume 2 Stage 2 Checks.
    const [q1, , q3] = CELL.quests;
    const read = scopeOf(q1!, 'check');
    expect(read.kind === 'listen-pick' && read.rounds.every((r) => r.promptShown === true && r.options.every((o) => o.pictureRef !== undefined && o.text === undefined))).toBe(true);
    const dictation = scopeOf(q3!, 'check');
    expect(dictation.kind === 'type-hangul' && dictation.rounds.map((r) => r.mode)).toEqual(['hear', 'hear']);
  });

  it('every Check asks a word its own Discover teaches (F-CURR-001 §3.1 rule 4)', () => {
    for (const q of CELL.quests) expect(asked(scopeOf(q, 'check')).some((ko) => discoverWords(q).includes(ko)), q.id).toBe(true);
  });

  it('U-4: every scored read uses Stage 1 symbols only; a word with a Word Builder symbol is heard, pictured or matched', () => {
    for (const q of CELL.quests) {
      for (const scope of q.scopes) {
        if (scope.kind === 'type-hangul') for (const r of scope.rounds) expect(decodable(r.target.ko), r.target.ko).toBe(true);
        if (scope.kind !== 'listen-pick') continue;
        for (const r of scope.rounds) {
          if (r.promptShown === true) expect(decodable(r.prompt.ko), r.prompt.ko).toBe(true);
          for (const o of r.options) if (o.text !== undefined) expect(decodable(o.text.ko), `${r.id} ${o.text.ko}`).toBe(true);
        }
      }
    }
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

  it('recycles Volume 1 items in new contexts: 30 in 100 or more of what each quest asks, and more than half of the cell (§5.1)', () => {
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
    // 연, 팽이, 윷, 제기, 공 and the four colours of Word Builder: 9 of the 16 words the cell asks (56 in 100).
    expect([recycled.size, all.size]).toEqual([9, 16]);
  });

  it('carries three sourced culture notes, each from the §6.6 allowlist under its name on the access date, checked three times or more', () => {
    expect(CELL.culture.map((n) => [n.id, n.kind])).toEqual([
      ['n1', 'culture'],
      ['n2', 'culture'],
      ['n3', 'culture'],
    ]);
    for (const note of CELL.culture) {
      expect(note.sources?.length, note.id).toBeGreaterThanOrEqual(2);
      for (const s of note.sources ?? []) {
        const match = allowlistedInstitution(s.publisher, s.accessed, s.url);
        expect(match?.institution.name, `${note.id} ${s.url}`).toBe('National Folk Museum of Korea');
        expect(match?.nameAsOfAccess, note.id).toBe(true);
        expect(s.quoteOrLocator, note.id).toMatch(/[가-힣]/);
      }
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
      expect(note.verification.scope, note.id).toBe('lesson');
    }
  });

  it('frames the five colours as five-elements thought shared across East Asia, never as Korean in origin (§5.1)', () => {
    const obangsaek = CELL.culture.find((n) => n.textEn.includes('{ko:오방색}'))!;
    expect(obangsaek.textEn).toMatch(/shared across East Asia/);
    for (const note of CELL.culture) expect(note.textEn, note.id).not.toMatch(/Korean (invention|origin)|invented in Korea|began in Korea|UNESCO/i);
  });

  it('is signed off by the multi-agent review (MAR), with no native-speaker or expert review claimed', () => {
    expect([CELL.review.language, CELL.review.culture, CELL.review.reviewedBy]).toEqual(['native-reviewed', 'culture-reviewed', 'MAR']);
    const record = [...CELL.review.notes, ...CELL.culture.map((n) => n.verification.notes)].join('\n');
    expect(record).toMatch(/No native-speaker or expert review is claimed/);
    expect(record).not.toMatch(/reviewed by a native speaker|native-speaker review (was|has been) done|expert review (was|has been) done/i);
  });
});
