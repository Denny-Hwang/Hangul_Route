import { readFileSync } from 'node:fs';
import { LessonCellSchema, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-001 row S4-3, Park Conversations (`content/episodes/stage-4/nature.json`): the
 * content checks of sections 3.1 and 3.5 for this cell (U-3 new items, U-6 reuse, U-8
 * distractors and sound-alike pairs), until the shared checks of
 * upper-stage-curriculum.test.ts land.
 */

const cell = LessonCellSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../../content/episodes/stage-4/nature.json', import.meta.url), 'utf8')),
);

/** The words (어절) a line is made of, without sentence marks. */
const words = (ko: string): string[] => ko.replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean);

/**
 * Words taught before Stage 4 (Stage 1 greetings, the Stage 3 sentences of section 3.4,
 * and the cast name), so a Park Conversations quest may use them without a Discover.
 */
const KNOWN = new Set(['안녕하세요', '네', '좋아요', '책이에요', '밥을', '먹어요', '우유를', '마셔요', '저는', '호야예요', '호야', '집에', '가요', '와요', '공원에']);

/** The one grammar point of q2 (section 3.5): -(으)ㄹ 거예요 and the verb forms it takes, counted once. */
const GRAMMAR_Q2 = new Set(['거예요', '올', '갈', '좋을']);

const discoverWords = (quest: LessonQuest): string[] =>
  quest.steps.flatMap(
    (s) => s.discover?.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'exchange' ? i.lines.flatMap((l) => words(l.line.ko)) : []))) ?? [],
  );

/** Every Korean line a scope shows: the prompt lines and the replies or options. */
function scopeLines(scope: LessonScope): string[] {
  switch (scope.kind) {
    case 'tap-respond':
      return scope.turns.flatMap((t) => [t.line.ko, ...t.replies.map((r) => r.text.ko)]);
    case 'story-sequence':
      return scope.lines.map((l) => l.line.ko);
    case 'listen-pick':
      return scope.rounds.flatMap((r) => [r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
    default:
      return [];
  }
}

/**
 * U-8: for each line a learner hears, the replies that would be natural. A distractor
 * must never be one of them; the answer always is. A new prompt fails until it is listed.
 */
const NATURAL_REPLIES: Readonly<Record<string, readonly string[]>> = {
  '안녕하세요!': ['안녕하세요!', '저는 호야예요.'],
  '날씨가 좋아요!': ['네, 좋아요!', '네, 같이 가요!'],
  '비가 와요!': ['집에 가요!', '그럼 집에 가요.'],
  '오늘 비가 올 거예요.': ['그럼 내일 갈 거예요.', '그럼 집에 가요.'],
  '내일 갈 거예요?': ['네, 갈 거예요.'],
  '내일 날씨가 좋을 거예요.': ['네, 같이 가요!', '네, 좋아요!'],
  '호야, 어디 가요?': ['공원에 가요.', '집에 가요!', '그럼 집에 가요.'],
  '어디 가요?': ['공원에 가요.', '집에 가요!', '그럼 집에 가요.'],
  '같이 가요!': ['네, 좋아요!', '네, 같이 가요!'],
  '비가 올 거예요.': ['그럼 집에 가요.', '그럼 내일 갈 거예요.'],
};

/** Prompt, answer and distractors of every scored reply choice of the cell. */
function replyChoices(): Array<{ where: string; prompt: string; answer: string; distractors: string[] }> {
  return cell.quests.flatMap((q) =>
    q.scopes.flatMap((scope) => {
      if (scope.kind === 'tap-respond') {
        return scope.turns.map((t, i) => ({
          where: `${scope.ref} turn ${i}`,
          prompt: t.line.ko,
          answer: t.replies.find((r) => r.correct)?.text.ko ?? '',
          distractors: t.replies.filter((r) => !r.correct).map((r) => r.text.ko),
        }));
      }
      if (scope.kind === 'listen-pick') {
        return scope.rounds.map((r) => ({
          where: `${scope.ref} ${r.id}`,
          prompt: r.prompt.ko,
          answer: r.options.find((o) => o.id === r.answerId)?.text?.ko ?? '',
          distractors: r.options.filter((o) => o.id !== r.answerId).map((o) => o.text?.ko ?? ''),
        }));
      }
      return [];
    }),
  );
}

/** A line as most speakers say it today: ㅐ and ㅔ merged (section 3.5, the 내 / 네 pair). */
function heardAs(ko: string): string {
  return [...ko.replace(/[.?!,\s]/g, '')]
    .map((ch) => {
      const code = ch.codePointAt(0)! - 0xac00;
      if (code < 0 || code > 11171) return ch;
      const vowel = Math.floor((code % 588) / 28);
      // Vowel indexes: ㅐ 1 -> ㅔ 5, ㅒ 3 -> ㅖ 7.
      const merged = vowel === 1 ? 5 : vowel === 3 ? 7 : vowel;
      return String.fromCodePoint(0xac00 + Math.floor(code / 588) * 588 + merged * 28 + (code % 28));
    })
    .join('');
}

describe('Park Conversations (F-CURR-001 S4-3)', () => {
  it('is the nature cell of Stage 4, three quests, no new cards (section 3.12)', () => {
    expect(cell.id).toBe('episode:stage4-nature');
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage4-nature-q1', 'quest:stage4-nature-q2', 'quest:stage4-nature-q3']);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
  });

  it('teaches the section 3.5 lines: weather, the future, where to', () => {
    const lines = cell.quests.map((q) => discoverWords(q).join(' '));
    expect(lines[0]).toContain('날씨가 좋아요');
    expect(lines[0]).toContain('비가 와요');
    expect(lines[1]).toContain('올 거예요');
    expect(lines[1]).toContain('내일 갈 거예요');
    expect(lines[2]).toContain('어디 가요');
    expect(lines[2]).toContain('공원에 가요');
  });

  it('rule 4: every word a quest asks was shown in its Discover, an earlier Discover of the cell, or an earlier stage', () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const w of discoverWords(quest)) taught.add(w);
      for (const scope of quest.scopes) {
        for (const ko of scopeLines(scope)) for (const w of words(ko)) expect(taught.has(w), `${scope.ref}: ${w} in ${ko}`).toBe(true);
      }
    }
  });

  it('U-3: one grammar point and at most 4 new words or set phrases per quest', () => {
    const seen = new Set(KNOWN);
    for (const [qi, quest] of cell.quests.entries()) {
      const fresh = [...new Set(discoverWords(quest))].filter((w) => !seen.has(w));
      const grammar = fresh.filter((w) => qi === 1 && GRAMMAR_Q2.has(w));
      const items = fresh.filter((w) => !grammar.includes(w));
      expect(items.length, `${quest.id}: ${items.join(', ')}`).toBeLessThanOrEqual(4);
      for (const w of fresh) seen.add(w);
    }
  });

  it('U-6: at least half the Korean words outside Discover were taught before the quest', () => {
    const before = new Set(KNOWN);
    for (const quest of cell.quests) {
      const shown = new Set(quest.scopes.flatMap((s) => scopeLines(s).flatMap(words)));
      const reused = [...shown].filter((w) => before.has(w));
      expect(reused.length * 2, `${quest.id}: ${reused.length} of ${shown.size}`).toBeGreaterThanOrEqual(shown.size);
      for (const w of discoverWords(quest)) before.add(w);
    }
  });

  it('U-8: the answer is a natural reply and no distractor is one', () => {
    const choices = replyChoices();
    expect(choices.length).toBe(15);
    for (const { where, prompt, answer, distractors } of choices) {
      const natural = NATURAL_REPLIES[prompt];
      expect(natural, `${where}: list the natural replies of ${prompt}`).toBeDefined();
      expect(natural, `${where}: ${answer}`).toContain(answer);
      for (const d of distractors) expect(natural, `${where}: ${d}`).not.toContain(d);
    }
  });

  it('U-8: no round offers two replies that sound the same (내 / 네)', () => {
    for (const { where, answer, distractors } of replyChoices()) {
      const heard = [answer, ...distractors].map(heardAs);
      expect(new Set(heard).size, where).toBe(heard.length);
    }
    expect(heardAs('내 차례야')).toBe(heardAs('네 차례야'));
    expect(heardAs('공원에 가요.')).toBe(heardAs('공원에 가요'));
  });

  it('Stage 4 shape: Tap to Respond, Story Sequence of 4 lines, Listen & Pick Check of 2 rounds; every listen prompt has its text', () => {
    for (const quest of cell.quests) {
      expect(quest.scopes.map((s) => s.kind), quest.id).toEqual(['tap-respond', 'story-sequence', 'listen-pick']);
      for (const scope of quest.scopes) {
        if (scope.kind === 'tap-respond') for (const t of scope.turns) expect(t.replies.length, scope.ref).toBe(3);
        if (scope.kind === 'story-sequence') expect(scope.lines.length, scope.ref).toBe(4);
        if (scope.kind === 'listen-pick') {
          expect(scope.rounds.length, scope.ref).toBe(2);
          for (const r of scope.rounds) expect(r.prompt.romanization && r.prompt.en, `${scope.ref} ${r.id}`).toBeTruthy();
        }
      }
    }
  });
});
