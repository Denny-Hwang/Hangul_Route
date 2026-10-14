import type { LessonCell } from '@hangul-route/content-schema';

/**
 * Test support for U-8 (F-CURR-001 §3.5): a distractor reply is never a natural reply, a heard
 * round never offers two options that sound the same, and a Tap to Respond cell does not keep
 * its right reply in one place.
 */

/** Hangul syllables with ㅐ / ㅒ read as ㅔ / ㅖ (the merger most speakers have today, §3.5) and no marks or spaces. */
export function soundKey(ko: string): string {
  return [...ko.replace(/[\s.,!?~]/g, '')]
    .map((ch) => {
      const code = ch.codePointAt(0)! - 0xac00;
      if (code < 0 || code > 11171) return ch;
      const medial = Math.floor((code % 588) / 28);
      const merged = medial === 1 ? 5 : medial === 3 ? 7 : medial;
      return String.fromCodePoint(0xac00 + code - medial * 28 + merged * 28);
    })
    .join('');
}

const bare = (ko: string): string => ko.replace(/[\s.,!?~]/g, '');

/** The question words a prompt is keyed by: every "X이/가 어디예요?" shares the replies of "어디예요?". */
const QUESTION_WORDS = ['어디', '뭐', '무엇', '누구', '언제', '왜', '어때', '어떻게', '몇'] as const;

/**
 * The key a prompt's natural replies are filed under: from its question word on (the subject,
 * a vocative or "이게" before it is dropped), so a generic answer to the same question word
 * counts as natural for every prompt that asks it. A line with no question word keys as itself.
 */
export function promptKey(ko: string): string {
  const words = ko.replace(/[.,!?~]/g, ' ').trim().split(/\s+/);
  const at = words.findIndex((w) => QUESTION_WORDS.some((q) => w.startsWith(q)));
  return bare(at < 0 ? ko : words.slice(at).join(''));
}

/**
 * U-8: "natural" is what the cell itself pairs, filed by `promptKey`: a Discover exchange's first
 * line with its second, a Tap to Respond line with its natural reply, a Listen & Pick prompt with
 * its answer.
 */
export function distractorProblems(cell: LessonCell): string[] {
  const natural = new Map<string, Set<string>>();
  const pair = (prompt: string, reply: string): void => {
    const set = natural.get(promptKey(prompt)) ?? new Set<string>();
    set.add(bare(reply));
    natural.set(promptKey(prompt), set);
  };
  for (const quest of cell.quests) {
    for (const step of quest.steps) {
      for (const page of step.discover?.pages ?? []) {
        for (const item of page.items) if (item.type === 'exchange') pair(item.lines[0].line.ko, item.lines[1].line.ko);
      }
    }
    for (const scope of quest.scopes) {
      if (scope.kind === 'tap-respond') for (const t of scope.turns) pair(t.line.ko, t.replies.find((r) => r.correct)!.text.ko);
      if (scope.kind === 'listen-pick') {
        for (const r of scope.rounds) {
          const answer = r.options.find((o) => o.id === r.answerId);
          if (r.prompt && answer?.text) pair(r.prompt.ko, answer.text.ko);
        }
      }
    }
  }
  const out: string[] = [];
  const check = (where: string, prompt: string, options: ReadonlyArray<{ ko: string; correct: boolean }>): void => {
    for (const o of options) {
      if (!o.correct && natural.get(promptKey(prompt))?.has(bare(o.ko))) out.push(`U-8 ${where}: ${o.ko} is also a natural reply to ${prompt}`);
    }
    const seen = new Map<string, string>();
    for (const o of options) {
      const key = soundKey(o.ko);
      const other = seen.get(key);
      if (other !== undefined && bare(other) !== bare(o.ko)) out.push(`U-8 ${where}: ${other} and ${o.ko} sound the same`);
      seen.set(key, o.ko);
    }
  };
  for (const quest of cell.quests) {
    for (const scope of quest.scopes) {
      if (scope.kind === 'tap-respond') {
        scope.turns.forEach((t, i) => check(`${scope.ref} turn ${i + 1}`, t.line.ko, t.replies.map((r) => ({ ko: r.text.ko, correct: r.correct }))));
      }
      if (scope.kind === 'listen-pick') {
        for (const r of scope.rounds) {
          if (!r.prompt) continue;
          const options = r.options.flatMap((o) => (o.text ? [{ ko: o.text.ko, correct: o.id === r.answerId }] : []));
          check(`${scope.ref} ${r.id}`, r.prompt.ko, options);
        }
      }
    }
  }
  return out;
}

/**
 * Tap to Respond shows its replies in the authored order, so a cell whose right reply sits in the
 * same place in every turn can be passed by always tapping that place. Returns that place (0-based)
 * when every turn of the cell shares it, or `undefined`.
 */
export function fixedReplyPlace(cell: LessonCell): number | undefined {
  const places = new Set<number>();
  for (const quest of cell.quests) {
    for (const scope of quest.scopes) {
      if (scope.kind === 'tap-respond') for (const t of scope.turns) places.add(t.replies.findIndex((r) => r.correct));
    }
  }
  return places.size === 1 ? [...places][0] : undefined;
}
