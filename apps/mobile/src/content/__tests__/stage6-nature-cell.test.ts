import { readFileSync } from 'node:fs';
import { LessonCellSchema, discoverItemTexts, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-001 row S6-4, Hike & Ask (`content/episodes/stage-6/nature.json`): the content
 * checks of sections 3.1, 3.6 and 3.9 for this cell (rule 4, U-3 new items, U-6 reuse, U-8
 * replies, the Realia Read answers, the sourced notes), until the shared checks of
 * upper-stage-curriculum.test.ts land.
 */

const cell = LessonCellSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../../content/episodes/stage-6/nature.json', import.meta.url), 'utf8')),
);

/** The words (어절) a line is made of, without sentence marks. */
const words = (ko: string): string[] => ko.replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean);

/**
 * Words taught before this cell: Stage 1 and Stage 4 greetings and questions (안녕하세요,
 * 감사합니다, 잘 가요, 어디예요 from Read Along, the restroom word 화장실) and the nature, food
 * and travel vocabulary topics (강, 바다, 집).
 */
const KNOWN = new Set(['안녕하세요', '감사합니다', '잘', '가요', '어디예요', '화장실', '강', '바다', '집']);

/**
 * Subject particles and copula endings a taught word may carry (Stage 3 and 4 patterns). The
 * direction particle 으로 is not here: no earlier row teaches it, so 오른쪽으로 / 왼쪽으로 and
 * 가세요 count as new q2 Discover items (its exchange pages).
 */
const ENDINGS = ['', '이', '가', '이에요', '예요'];

const taughtIn = (set: ReadonlySet<string>, w: string): boolean => ENDINGS.some((e) => w.endsWith(e) && set.has(w.slice(0, w.length - e.length)));

const discoverWords = (quest: LessonQuest): string[] =>
  quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => discoverItemTexts(i).flatMap((t) => words(t.ko)))) ?? []);

/** Every Korean string a scope shows. */
function scopeLines(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'realia-read':
      return [
        ...(scope.realia.title ? [scope.realia.title.ko] : []),
        ...scope.realia.entries.flatMap((e) => [e.text.ko, ...(e.value ? [e.value.ko] : [])]),
        ...scope.rounds.flatMap((r) => [...(r.key ? [r.key.ko] : []), ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]),
      ];
    case 'type-hangul':
      return scope.rounds.map((r) => r.target.ko);
    case 'tap-respond':
      return scope.turns.flatMap((t) => [t.line.ko, ...t.replies.map((r) => r.text.ko)]);
    case 'listen-pick':
      return scope.rounds.flatMap((r) => [r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
    default:
      return [];
  }
}

/** U-8: for each line a learner hears, the replies that would be natural. */
const NATURAL_REPLIES: Readonly<Record<string, readonly string[]>> = {
  '안녕하세요!': ['안녕하세요!'],
  '정상이 어디예요?': ['오른쪽으로 가세요.', '왼쪽으로 가세요.'],
  '화장실이 어디예요?': ['오른쪽으로 가세요.', '왼쪽으로 가세요.'],
  '입구가 어디예요?': ['오른쪽으로 가세요.', '왼쪽으로 가세요.'],
  '얼마나 걸려요?': ['한 시간 걸려요.'],
};

describe('Hike & Ask (F-CURR-001 S6-4)', () => {
  it('is the nature cell of Stage 6, three quests, no new cards, MAR signed off, ready (shipped at CATALOG_VERSION 24 on the compact literal, section 3.12)', () => {
    expect(cell.id).toBe('episode:stage6-nature');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.culture.every((n) => n.verification.passes >= 3)).toBe(true);
    expect(cell.titleEn).toBe('Hike & Ask');
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage6-nature-q1', 'quest:stage6-nature-q2', 'quest:stage6-nature-q3']);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
  });

  it('teaches the section 3.6 items: signs, asking the way, how long', () => {
    const taught = cell.quests.map((q) => discoverWords(q));
    expect(taught[0]).toEqual(expect.arrayContaining(['산길', '정상', '입구', '출구']));
    expect(taught[1]).toEqual(expect.arrayContaining(['왼쪽', '오른쪽', '정상이', '어디예요', '오른쪽으로', '왼쪽으로', '가세요']));
    expect(taught[2]).toEqual(expect.arrayContaining(['얼마나', '걸려요', '한', '시간']));
  });

  it('Stage 6 shape: Realia Read of 4-5 questions, then Type Hangul or Tap to Respond, then a 2-round Listen & Pick', () => {
    for (const quest of cell.quests) {
      const [practice, apply, check] = quest.scopes;
      expect(practice?.kind, quest.id).toBe('realia-read');
      expect(['type-hangul', 'tap-respond'], quest.id).toContain(apply?.kind);
      expect(check?.kind, quest.id).toBe('listen-pick');
    }
    expect(cell.quests.map((q) => q.scopes[1]?.kind)).toEqual(['type-hangul', 'tap-respond', 'type-hangul']);
  });

  it('rule 4: every word a quest asks was shown in its Discover, an earlier Discover of the cell, or an earlier stage', () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const w of discoverWords(quest)) taught.add(w);
      for (const scope of quest.scopes) for (const ko of scopeLines(scope)) for (const w of words(ko)) expect(taughtIn(taught, w), `${scope.ref}: ${w} in ${ko}`).toBe(true);
    }
  });

  it('U-3: at most 6 new words per quest (the hour numbers 한, 두, 세 are one number set)', () => {
    const seen = new Set(KNOWN);
    for (const quest of cell.quests) {
      const fresh = [...new Set(discoverWords(quest))].filter((w) => !taughtIn(seen, w));
      const numbers = fresh.filter((w) => ['한', '두', '세'].includes(w));
      const items = fresh.length - numbers.length + (numbers.length > 0 ? 1 : 0);
      expect(items, `${quest.id}: ${fresh.join(', ')}`).toBeLessThanOrEqual(6);
      for (const w of fresh) seen.add(w);
    }
  });

  it('U-6: at least half the Korean words outside Discover were taught before the quest', () => {
    const before = new Set(KNOWN);
    for (const quest of cell.quests) {
      const shown = new Set(quest.scopes.flatMap((s) => scopeLines(s).flatMap(words)));
      const reused = [...shown].filter((w) => taughtIn(before, w));
      expect(reused.length * 2, `${quest.id}: ${reused.length} of ${shown.size}`).toBeGreaterThanOrEqual(shown.size);
      for (const w of discoverWords(quest)) before.add(w);
    }
  });

  it('every Realia Read answer is on the sign: the board, its direction or its time', () => {
    const dirWord = { left: '왼쪽', right: '오른쪽' } as const;
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'realia-read') continue;
        expect(scope.rounds.length, scope.ref).toBeGreaterThanOrEqual(4);
        expect(scope.realia.kind, scope.ref).toBe('sign');
        for (const round of scope.rounds) {
          const entry = scope.realia.entries.find((e) => e.id === round.answerEntryId);
          const answer = round.options.find((o) => o.id === round.answerId)?.text?.ko;
          expect(entry, `${scope.ref} ${round.id}`).toBeDefined();
          const found = [entry?.text.ko, entry?.value?.ko, entry?.dir ? dirWord[entry.dir] : undefined];
          expect(found, `${scope.ref} ${round.id}: ${answer}`).toContain(answer);
          if (round.key) expect(round.key.ko, `${scope.ref} ${round.id}`).toBe(entry?.text.ko);
          // A wrong option is never also true of the answer board (no second right answer).
          for (const o of round.options.filter((x) => x.id !== round.answerId)) expect(found, `${scope.ref} ${round.id}`).not.toContain(o.text?.ko);
        }
      }
    }
  });

  it('the Discover realia pages name a sign the quest plays', () => {
    for (const quest of cell.quests) {
      const signs = new Set(quest.scopes.flatMap((s) => (s.kind === 'realia-read' ? [s.realia.ref] : [])));
      const refs = quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'realia' ? [i.realiaRef] : []))) ?? []);
      for (const ref of refs) expect(signs.has(ref), `${quest.id}: ${ref}`).toBe(true);
    }
  });

  it('Type Hangul targets are words of the quest or an earlier Discover', () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const w of discoverWords(quest)) taught.add(w);
      for (const scope of quest.scopes) if (scope.kind === 'type-hangul') for (const r of scope.rounds) for (const w of words(r.target.ko)) expect(taught.has(w), `${scope.ref} ${r.id}`).toBe(true);
    }
  });

  it('U-8: the answer is a natural reply and no distractor is one', () => {
    let replies = 0;
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        const choices =
          scope.kind === 'tap-respond'
            ? scope.turns.map((t) => ({ prompt: t.line.ko, answer: t.replies.find((r) => r.correct)?.text.ko, wrong: t.replies.filter((r) => !r.correct).map((r) => r.text.ko) }))
            : scope.kind === 'listen-pick'
              ? scope.rounds
                  .filter((r) => r.prompt.ko in NATURAL_REPLIES)
                  .map((r) => ({ prompt: r.prompt.ko, answer: r.options.find((o) => o.id === r.answerId)?.text?.ko, wrong: r.options.filter((o) => o.id !== r.answerId).map((o) => o.text?.ko) }))
              : [];
        for (const { prompt, answer, wrong } of choices) {
          replies += 1;
          const natural = NATURAL_REPLIES[prompt];
          expect(natural, `${scope.ref}: list the natural replies of ${prompt}`).toBeDefined();
          expect(natural, `${scope.ref}: ${answer}`).toContain(answer);
          for (const d of wrong) expect(natural, `${scope.ref}: ${d}`).not.toContain(d);
        }
      }
    }
    expect(replies).toBe(6);
  });

  it('the right Tap to Respond reply moves between turns', () => {
    const places = cell.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'tap-respond' ? s.turns.map((t) => t.replies.findIndex((r) => r.correct)) : [])));
    expect(new Set(places).size).toBeGreaterThan(1);
  });

  it('section 3.9: every note has two or more sources, one a Korean public institution, and no "all Koreans" claim', () => {
    expect(cell.culture.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    for (const note of cell.culture) {
      expect(note.sources?.length ?? 0, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.scope, note.id).toBe('lesson');
      expect(note.textEn, note.id).not.toMatch(/all Koreans|every Korean/i);
    }
    expect(cell.culture.some((n) => n.sources?.some((s) => new URL(s.url).hostname === 'www.knps.or.kr'))).toBe(true);
  });

  it('section 3.6: the hour page says which number system the times use', () => {
    const q3 = cell.quests[2]!;
    const captions = q3.steps.flatMap((s) => s.discover?.pages.map((p) => p.captionEn ?? '') ?? []);
    expect(captions.some((c) => /native numbers/.test(c) && /han, du, se/.test(c))).toBe(true);
  });
});
