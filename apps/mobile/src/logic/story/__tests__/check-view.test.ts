import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryCheck } from '@hangul-route/content-schema';
import { buildCheckView } from '../check-view';

const opt = (id: string, isCorrect: boolean, en = `option ${id}`): StoryCheck['options'][number] => ({
  id,
  en,
  isCorrect,
});

const check = (over: Partial<StoryCheck> = {}): StoryCheck => ({
  id: 'c1',
  kind: 'detail',
  promptEn: 'What is the New Year bow called?',
  options: [opt('a', false), opt('b', false), opt('c', true), opt('d', false)],
  factIds: ['f1'],
  ...over,
});

const TARGET = { ko: '설날', romanization: 'seollal', en: 'Lunar New Year' };

describe('buildCheckView prompt', () => {
  it('keeps a plain prompt as one text part', () => {
    const view = buildCheckView(check(), 'story:x');
    expect(view.promptParts).toEqual([{ text: 'What is the New Year bow called?' }]);
    expect(view.target).toBeUndefined();
    expect(view.targetInline).toBe(false);
  });

  it('splits {target} into text / target / text parts', () => {
    const view = buildCheckView(check({ promptEn: 'What does {target} mean?', target: TARGET }), 'story:x');
    expect(view.promptParts).toEqual([{ text: 'What does ' }, { target: TARGET }, { text: ' mean?' }]);
    expect(view.targetInline).toBe(true);
    expect(view.target).toEqual(TARGET);
  });

  it('drops empty text parts when the token opens or closes the prompt', () => {
    expect(buildCheckView(check({ promptEn: '{target} means what?', target: TARGET }), 's').promptParts).toEqual([
      { target: TARGET },
      { text: ' means what?' },
    ]);
    expect(buildCheckView(check({ promptEn: 'Say {target}', target: TARGET }), 's').promptParts).toEqual([
      { text: 'Say ' },
      { target: TARGET },
    ]);
  });

  it('shows a target without a token as a word card above the options', () => {
    const view = buildCheckView(check({ target: TARGET }), 's');
    expect(view.promptParts).toEqual([{ text: 'What is the New Year bow called?' }]);
    expect(view.target).toEqual(TARGET);
    expect(view.targetInline).toBe(false);
  });

  it('leaves a stray {target} as text when there is no target to draw', () => {
    const view = buildCheckView(check({ promptEn: 'What does {target} mean?' }), 's');
    expect(view.promptParts).toEqual([{ text: 'What does {target} mean?' }]);
    expect(view.targetInline).toBe(false);
  });
});

describe('buildCheckView answer gloss', () => {
  it('hides the target gloss until the item resolves for pick-meaning and fill-word', () => {
    expect(buildCheckView(check({ kind: 'pick-meaning', target: TARGET }), 's').hideTargetGloss).toBe(true);
    expect(buildCheckView(check({ kind: 'fill-word', target: TARGET }), 's').hideTargetGloss).toBe(true);
  });

  it('shows the gloss for the other kinds', () => {
    for (const kind of ['detail', 'who', 'pick-picture', 'true-false', 'feeling'] as const) {
      expect(buildCheckView(check({ kind, target: TARGET }), 's').hideTargetGloss, kind).toBe(false);
    }
  });
});

describe('buildCheckView options', () => {
  it('carries ids, text, art and correctness, and reports the correct id', () => {
    const view = buildCheckView(
      check({
        options: [
          { id: 'a', ko: '설날', romanization: 'seollal', en: 'New Year', isCorrect: true },
          { id: 'b', en: 'Cat', art: 'prop:cat', isCorrect: false },
        ],
      }),
      's',
    );
    const a = view.options.find((o) => o.id === 'a');
    expect(a).toEqual({ id: 'a', ko: '설날', romanization: 'seollal', en: 'New Year', isCorrect: true });
    expect(view.options.find((o) => o.id === 'b')?.art).toBe('prop:cat');
    expect(view.correctOptionId).toBe('a');
  });

  it('is a permutation with stable ids', () => {
    const c = check();
    const view = buildCheckView(c, 'story:x');
    expect(view.options.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is deterministic for the same story and check, and does not mutate the check', () => {
    const c = check();
    const before = JSON.stringify(c);
    const one = buildCheckView(c, 'story:seollal-new-year');
    const two = buildCheckView(c, 'story:seollal-new-year');
    expect(one.options.map((o) => o.id)).toEqual(two.options.map((o) => o.id));
    expect(JSON.stringify(c)).toBe(before);
  });

  it('varies with the story id', () => {
    const orders = new Set(
      ['story:a', 'story:b', 'story:c', 'story:d', 'story:e', 'story:f'].map((s) =>
        buildCheckView(check(), s)
          .options.map((o) => o.id)
          .join(''),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('never shuffles true-false', () => {
    for (let i = 0; i < 20; i += 1) {
      const view = buildCheckView(
        check({ kind: 'true-false', options: [opt('t', true, 'True'), opt('f', false, 'False')] }),
        `story:s${i}`,
      );
      expect(view.options.map((o) => o.id)).toEqual(['t', 'f']);
    }
  });

  it('keeps the authored order when shuffle is false', () => {
    for (let i = 0; i < 20; i += 1) {
      const view = buildCheckView(check({ shuffle: false }), `story:s${i}`);
      expect(view.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('reports an empty correct id for malformed data instead of throwing', () => {
    const view = buildCheckView(check({ options: [opt('a', false), opt('b', false)] }), 's');
    expect(view.correctOptionId).toBe('');
  });

  it('exposes the explanation and hint', () => {
    const view = buildCheckView(check({ explainEn: 'Because.', hintEn: 'Think of the bow.' }), 's');
    expect(view.explainEn).toBe('Because.');
    expect(view.hintEn).toBe('Think of the bow.');
    expect(view.checkId).toBe('c1');
    expect(view.kind).toBe('detail');
    const bare = buildCheckView(check(), 's');
    expect(bare.explainEn).toBeUndefined();
    expect(bare.hintEn).toBeUndefined();
  });
});

describe('answer-at-index-0 share (F-STORY-003 §3.4)', () => {
  interface ResearchEpisode {
    id: string;
    checks: Array<{ q_en: string; options: string[]; answer_index: number; fact_id: string }>;
  }
  const dir = join(__dirname, '../../../../../../content/stories/research');
  const files = [
    'hangul-printing.final.json',
    'records-joseon.final.json',
    'science-art-life.final.json',
    'seasons-tales.final.json',
  ];

  const researchChecks = (answerFirst: boolean): Array<{ storyId: string; check: StoryCheck }> =>
    files.flatMap((f) => {
      const json = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { episodes: ResearchEpisode[] };
      return json.episodes.flatMap((ep) =>
        ep.checks.map((q, i) => {
          const ids = ['a', 'b', 'c', 'd'];
          const texts = [...q.options];
          if (answerFirst) {
            const [right] = texts.splice(q.answer_index, 1);
            texts.unshift(right as string);
          }
          const rightIndex = answerFirst ? 0 : q.answer_index;
          return {
            storyId: ep.id.replace(/^story-/, 'story:'),
            check: {
              id: `c${i + 1}`,
              kind: 'detail' as const,
              promptEn: q.q_en,
              options: texts.map((en, k) => ({ id: ids[k] as string, en, isCorrect: k === rightIndex })),
              factIds: [q.fact_id],
            },
          };
        }),
      );
    });

  const shareAtZero = (items: Array<{ storyId: string; check: StoryCheck }>): number => {
    const hits = items.filter(({ storyId, check: c }) => {
      const view = buildCheckView(c, storyId);
      return view.options[0]?.isCorrect === true;
    }).length;
    return hits / items.length;
  };

  it('reads all 72 research checks', () => {
    expect(researchChecks(false)).toHaveLength(72);
  });

  it('shows the correct option first in at most half of the 72 research checks', () => {
    expect(shareAtZero(researchChecks(false))).toBeLessThanOrEqual(0.5);
  });

  it('still shows it first in at most half when every author put it first', () => {
    const items = researchChecks(true);
    expect(items.every(({ check: c }) => c.options[0]?.isCorrect === true)).toBe(true);
    expect(shareAtZero(items)).toBeLessThanOrEqual(0.5);
  });
});
