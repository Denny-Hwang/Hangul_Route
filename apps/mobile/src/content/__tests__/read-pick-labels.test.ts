import { isReadPickScope, localize } from '@hangul-route/content-schema';
import { readPickRoundIssues } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import type { MinigameScope } from '../../logic/minigame-config';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * Read Pick Meaning (F-CURR-002 section 7.1, row CM-3A S2): its options are the meanings the round asks, so a Spanish or
 * Korean learner reads them in the UI language, never in English (section 4.3). Each option's label carries an es and a
 * ko overlay (`listenPick.rounds.<round>.options.<option>.label`, an optional overlay field, so a heard round's English
 * labels are not counted missing); the localized scope has no English label left. Every shipped Read Pick round keeps
 * its shape (meanings only, a scope all read or all heard), whatever its stage.
 */

const readPick = Object.entries(ALL_LESSON_SCOPES).filter(
  ([, scope]) => scope.kind === 'listen-pick' && isReadPickScope(scope.listenPick?.rounds ?? []),
) as Array<[string, MinigameScope]>;

const OVERLAYS = {
  es: Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPE_OVERLAYS.es)),
  ko: Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPE_OVERLAYS.ko)),
};

describe('Read Pick Meaning: options in the UI language (row CM-3A S2)', () => {
  it('the Stage 2 Read Pick Checks are shipped: seven scopes in Volume 1, one in the Holidays Volume 2 (row CM-45 S2)', () => {
    expect(readPick.filter(([ref]) => ref.startsWith('minigame:s2-')).map(([ref]) => ref).sort()).toEqual([
      'minigame:s2-crafts-q3-check',
      'minigame:s2-letters-q1-check',
      'minigame:s2-letters-q4-check',
      'minigame:s2-letters-q6-check',
      'minigame:s2-life-q1-check',
      'minigame:s2-nature-q2-check',
      'minigame:s2-rites-q1-check',
      'minigame:s2-rites-v2-q1-check',
    ]);
  });

  it.each(['es', 'ko'] as const)('%s: every Read Pick option has its label overlay, and the localized options carry no English', (locale) => {
    const missing: string[] = [];
    for (const [ref, scope] of readPick) {
      const localized = localize(scope, ref, locale, OVERLAYS);
      scope.listenPick!.rounds.forEach((round, ri) => {
        for (const [oi, option] of round.options.entries()) {
          const field = `listenPick.rounds.${round.id}.options.${option.id}.label`;
          const label = localized.listenPick!.rounds[ri]!.options[oi]!.labelEn;
          if (OVERLAYS[locale][ref]?.[field] === undefined || label === option.labelEn) missing.push(`${ref} ${field}`);
        }
      });
    }
    expect(missing).toEqual([]);
  });

  // A ko label is Korean text beside a Korean prompt: one that shares a syllable with the prompt lets a learner match
  // the text instead of reading the word (김밥 beside "김에 밥과 ..."), or lures them to a distractor (비 "구름에서 ..."
  // when the prompt is 구름). The labels of a Read Pick round share no syllable with its prompt.
  it('ko: no Read Pick label shares a syllable with its round\'s prompt', () => {
    const cues: string[] = [];
    for (const [ref, scope] of readPick) {
      for (const round of scope.listenPick!.rounds) {
        const syllables = new Set([...round.prompt.ko].filter((c) => /[\uac00-\ud7a3]/.test(c)));
        for (const option of round.options) {
          const label = OVERLAYS.ko[ref]?.[`listenPick.rounds.${round.id}.options.${option.id}.label`] ?? '';
          const shared = [...label].filter((c) => syllables.has(c));
          if (shared.length > 0) cues.push(`${ref} ${round.id} ${option.id}: ${[...new Set(shared)].join('')}`);
        }
      }
    }
    expect(cues).toEqual([]);
  });

  it('every shipped Read Pick round keeps its shape (meanings only; a scope all read or all heard)', () => {
    const issues = Object.entries(ALL_LESSON_SCOPES)
      .filter(([, scope]) => scope.kind === 'listen-pick')
      .flatMap(([ref, scope]) => readPickRoundIssues(scope.listenPick?.rounds ?? []).map((i) => `${ref} rounds[${i.round}].${i.path}: ${i.message}`));
    expect(issues).toEqual([]);
  });
});
