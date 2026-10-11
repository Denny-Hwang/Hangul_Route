import {
  QuestSchema,
  ROMANIZATION_EXCEPTIONS,
  checkRomanization,
  type DiscoverPage,
  type KoText,
  type Quest,
  type QuestStepKind,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes, scopeFor, type MinigameScope } from '../../logic/minigame-config';
import {
  buildBuildLetterRounds,
  buildMatchSoundRounds,
  buildOddOneOutRounds,
  buildTraceStrokeRounds,
} from '../../logic/round-builder';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { symbolsOf } from '../../logic/stage1/hangul';
import { cardById } from '../heritage-cards';
import { episodesAll } from '../episodes';
import { findJamo, jamoAll } from '../jamo';
import { questsAll } from '../quests';

/**
 * The Stage 1 curriculum invariants (F-QUEST-002 section 5, T1-T11): the heart of the
 * spec. They run over the Stage 1 quests already rebuilt with a Discover step (Q-6a:
 * quests 1-3; Q-6b, Q-7b and Q-8 add the rest), which must lead the Stage 1 order so
 * "taught by this quest or earlier" means the real teaching order. T1 (all 30 symbols)
 * runs once all 15 quests are rebuilt.
 */

const hasDiscover = (quest: Quest): boolean => quest.steps.some((s) => s.kind === 'discover');
const REBUILT: readonly Quest[] = STAGE1_QUESTS.filter(hasDiscover);
const ALL_REBUILT = STAGE1_QUESTS.length === 15 && REBUILT.length === 15;

const STEP_ORDER: readonly QuestStepKind[] = ['intro', 'discover', 'practice', 'apply', 'check', 'reward'];
const ROUNDS: Partial<Record<QuestStepKind, number>> = { practice: 6, apply: 4, check: 2 };

const HANGUL = /[가-힣ㄱ-ㅣ]/;

/** Jamo ids taught by `quest` and every rebuilt quest before it. */
function taughtThrough(quest: Quest): Set<string> {
  const at = REBUILT.indexOf(quest);
  return new Set(REBUILT.slice(0, at + 1).flatMap(questTeaches));
}

function scopesOf(quest: Quest): Array<{ stepId: string; kind: QuestStepKind; ref: string; scope: MinigameScope | undefined }> {
  return quest.steps.flatMap((s) => (s.minigameRef ? [{ stepId: s.id, kind: s.kind, ref: s.minigameRef, scope: scopeFor(s.minigameRef) }] : []));
}

/** Rounds a scope scores (one per pair for Pic-Word Match, capped by the pool for Trace). */
function scopeRounds(scope: MinigameScope): number {
  switch (scope.kind) {
    case 'listen-pick':
      return scope.listenPick?.rounds.length ?? 0;
    case 'pic-word-match':
      return (scope.picWord?.boards ?? []).reduce((n, b) => n + b.pairs.length, 0);
    case 'build-letter':
      return scope.syllables?.length ?? 0;
    case 'story-sequence':
      return scope.storySteps?.length ?? 0;
    case 'trace-stroke':
      return Math.min(scope.jamoIds?.length ?? 0, scope.rounds ?? 4);
    default:
      return scope.rounds ?? 4;
  }
}

/** A Korean word or syllable as the symbols it uses; `null` when it leaves the 30 symbols. */
const wordSymbols = (ko: string): string[] | null => symbolsOf(ko);

/**
 * Every symbol a scope asks a learner to read (R3). Theme-word games (Pic-Word Match,
 * Culture Quiz, Story Sequence, Card Match) are exposure and are left out.
 */
function scopeReading(scope: MinigameScope): { ids: string[]; words: string[] } {
  switch (scope.kind) {
    case 'match-sound':
    case 'trace-stroke':
    case 'odd-one-out':
      return { ids: scope.jamoIds ?? [], words: [] };
    case 'build-letter':
      return {
        ids: (scope.syllables ?? []).flatMap((s) => s.jamoIds ?? []),
        words: (scope.syllables ?? []).filter((s) => !s.jamoIds).map((s) => s.ko),
      };
    case 'listen-pick': {
      const ids: string[] = [];
      const words: string[] = [];
      for (const round of scope.listenPick?.rounds ?? []) {
        if (round.id.startsWith('lp:sym:')) {
          // A symbol round: the options are the written symbols; the prompt is only its sound.
          ids.push(...round.options.map((o) => o.id));
          continue;
        }
        words.push(round.prompt.ko);
        for (const option of round.options) if (option.text) words.push(option.text.ko);
      }
      return { ids, words };
    }
    default:
      return { ids: [], words: [] };
  }
}

/** Theme pages (pictured culture words) are exposure: a page of words only, one with a picture. */
const isThemePage = (page: DiscoverPage): boolean =>
  page.items.every((i) => i.type === 'word') && page.items.some((i) => i.picture !== undefined);

/** The reading words of a quest's Discover step: every example and every word off a theme page. */
function discoverReading(quest: Quest): KoText[] {
  return quest.steps.flatMap((s) =>
    (s.discover?.pages ?? []).flatMap((page) =>
      page.items.flatMap((item) => {
        if (item.type === 'jamo') return [item.example];
        return isThemePage(page) ? [] : [item.word];
      }),
    ),
  );
}

/** Every KoText a quest and its scopes show (Discover items, Listen & Pick prompts and text options, Pic-Word words). */
function koTextsOf(quest: Quest): KoText[] {
  const fromDiscover = quest.steps.flatMap((s) =>
    (s.discover?.pages ?? []).flatMap((p) => p.items.map((i) => (i.type === 'jamo' ? i.example : i.word))),
  );
  const fromScopes = scopesOf(quest).flatMap(({ scope }) => [
    ...(scope?.listenPick?.rounds ?? []).flatMap((r) => [
      r.prompt,
      ...r.options.flatMap((o) => (o.text ? [o.text] : [])),
    ]),
    ...(scope?.picWord?.boards ?? []).flatMap((b) => b.pairs.map((p) => p.word)),
  ]);
  return [...fromDiscover, ...fromScopes];
}

/** Every English field of a quest (`*En`), its Discover captions and notes, and its glosses. */
function englishFieldsOf(quest: Quest): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  const add = (where: string, text: string | undefined): void => {
    if (text !== undefined) out.push({ where, text });
  };
  add('titleEn', quest.titleEn);
  add('blurbEn', quest.blurbEn);
  add('teaserEn', quest.teaserEn);
  for (const s of quest.steps) {
    add(`${s.id}.titleEn`, s.titleEn);
    add(`${s.id}.hoyaLineEn`, s.hoyaLineEn);
    add(`${s.id}.bodyEn`, s.bodyEn);
    (s.discover?.pages ?? []).forEach((p, pi) => {
      add(`${s.id}.pages[${pi}].captionEn`, p.captionEn);
      p.items.forEach((item, ii) => {
        if (item.type === 'word') add(`${s.id}.pages[${pi}].items[${ii}].noteEn`, item.noteEn);
      });
    });
  }
  for (const text of koTextsOf(quest)) add(`gloss of ${text.ko}`, text.en);
  return out;
}

const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };

describe('the rebuilt Stage 1 quests', () => {
  it('starts with letters q1-q3 (Q-6a) and they lead the Stage 1 order', () => {
    expect(REBUILT.map((q) => q.id).slice(0, 3)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
    ]);
    expect(STAGE1_QUESTS.slice(0, REBUILT.length)).toEqual(REBUILT);
  });

  it('teaches the symbols of the spec quest list, in page order', () => {
    const chars = (q: Quest): string[] => questTeaches(q).map((id) => findJamo(id)?.char ?? id);
    expect(chars(REBUILT[0]!)).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    expect(chars(REBUILT[1]!)).toEqual(['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']);
    expect(chars(REBUILT[2]!)).toEqual(['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']);
  });

  it('gives an episode whose quests are all rebuilt the sum of their minutes (section 3.6: letters 15)', () => {
    const rebuilt = new Set(REBUILT.map((q) => q.id));
    const done = episodesAll.filter((e) => e.stage === 'stage1' && e.questIds.length > 0 && e.questIds.every((id) => rebuilt.has(id)));
    expect(done.map((e) => e.id)).toContain('episode:stage1-letters');
    for (const episode of done) {
      const sum = episode.questIds.reduce((n, id) => n + (questsAll.find((q) => q.id === id)?.estimatedMinutes ?? 0), 0);
      expect(episode.estimatedMinutes, episode.id).toBe(sum);
    }
    const letters = episodesAll.find((e) => e.id === 'episode:stage1-letters');
    expect(letters?.estimatedMinutes).toBe(15);
    expect(letters?.subtitleEn).toBe('Twelve letters, and your first real words.');
  });
});

describe('T1 teach once', () => {
  it('teaches no symbol in two quests', () => {
    const taught = REBUILT.flatMap(questTeaches);
    expect(taught.filter((id, i) => taught.indexOf(id) !== i)).toEqual([]);
  });

  it.runIf(ALL_REBUILT)('teaches exactly the 30 symbols, each once, across the 15 quests', () => {
    const taught = REBUILT.flatMap(questTeaches);
    expect([...taught].sort()).toEqual(jamoAll.map((j) => j.id).sort());
  });
});

describe.each(REBUILT.map((q) => [q.id, q] as const))('%s', (_id, quest) => {
  const taught = taughtThrough(quest);

  it('T2 teaches at most two consonant-type symbols and two vowels', () => {
    const kinds = questTeaches(quest).map((id) => findJamo(id)?.kind);
    expect(kinds.filter((k) => k === 'consonant' || k === 'batchim').length).toBeLessThanOrEqual(2);
    expect(kinds.filter((k) => k === 'vowel').length).toBeLessThanOrEqual(2);
    expect(kinds).not.toContain(undefined);
  });

  it('T3 asks only symbols taught by this quest or earlier, in every scope and Check option', () => {
    const problems: string[] = [];
    for (const { ref, scope } of scopesOf(quest)) {
      if (!scope) continue;
      const { ids, words } = scopeReading(scope);
      for (const id of ids) if (!taught.has(id)) problems.push(`${ref}: ${id} is not taught yet`);
      for (const word of words) {
        const symbols = wordSymbols(word);
        if (symbols === null) problems.push(`${ref}: ${word} is outside the 30 symbols`);
        else for (const id of symbols) if (!taught.has(id)) problems.push(`${ref}: ${word} uses ${id}, not taught yet`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('T4 has the six steps in order, a short Discover, and 6 + 4 + 2 rounds', () => {
    expect(quest.steps.map((s) => s.kind)).toEqual(STEP_ORDER);
    const discover = quest.steps.find((s) => s.kind === 'discover')?.discover;
    expect(discover?.pages.length).toBeLessThanOrEqual(3);
    for (const page of discover?.pages ?? []) expect(page.items.length).toBeLessThanOrEqual(2);
    for (const { kind, ref, scope } of scopesOf(quest)) {
      expect(scope, ref).toBeDefined();
      expect(scopeRounds(scope!), `${ref} (${kind})`).toBe(ROUNDS[kind]);
    }
    expect(scopesOf(quest).find((s) => s.kind === 'check')?.scope?.kind).toBe('listen-pick');
  });

  it('T4 every practice and apply scope builds its rounds the way its game screen does, over several seeds', () => {
    const SEEDS = [1, 7, 42, 2026, 99991];
    for (const { kind, ref, scope } of scopesOf(quest)) {
      if (kind !== 'practice' && kind !== 'apply') continue;
      const s = scope!;
      const jamoIds = s.jamoIds ?? [];
      const rounds = s.rounds ?? 4;
      for (const seed of SEEDS) {
        const label = `${ref} seed ${seed}`;
        switch (s.kind) {
          case 'match-sound': {
            const built = buildMatchSoundRounds({ scopeJamoIds: jamoIds, rounds, ...(s.focusJamoIds ? { focusJamoIds: s.focusJamoIds } : {}), seed });
            expect(built, label).toHaveLength(ROUNDS[kind]!);
            const prompted = new Set(built.map((r) => r.promptJamo.id));
            for (const id of s.focusJamoIds ?? []) expect(prompted.has(id), `${label} asks ${id}`).toBe(true);
            break;
          }
          case 'trace-stroke':
            expect(buildTraceStrokeRounds({ scopeJamoIds: jamoIds, rounds, seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          case 'odd-one-out':
            expect(buildOddOneOutRounds({ scopeJamoIds: jamoIds, rounds, seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          case 'build-letter':
            expect(buildBuildLetterRounds({ syllables: s.syllables ?? [], seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          default:
            break;
        }
      }
    }
  });

  it('T4 the practice Match Sound focuses exactly the symbols the quest teaches', () => {
    const practice = scopesOf(quest).find((s) => s.kind === 'practice')?.scope;
    expect(practice?.kind).toBe('match-sound');
    expect(practice?.focusJamoIds).toEqual(questTeaches(quest));
  });

  it('T5 repeats no minigame and every ref resolves to a scope of the same kind', () => {
    const refs = scopesOf(quest).map((s) => s.ref);
    expect(new Set(refs).size).toBe(refs.length);
    for (const step of quest.steps) {
      if (!step.minigameRef) continue;
      expect(scopeFor(step.minigameRef)?.kind, `${step.id} -> ${step.minigameRef}`).toBe(step.minigameKind);
    }
  });

  it('T6 passes QuestSchema', () => {
    const result = QuestSchema.safeParse(quest);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('T7 reads only taught symbols in Discover, and every example holds its symbol', () => {
    const problems: string[] = [];
    for (const word of discoverReading(quest)) {
      const symbols = wordSymbols(word.ko);
      if (symbols === null) problems.push(`${word.ko} is outside the 30 symbols`);
      else for (const id of symbols) if (!taught.has(id)) problems.push(`${word.ko} uses ${id}, not taught yet`);
      if (word.syllables && word.syllables.join('') !== word.romanization) problems.push(`${word.ko}: syllables do not join to ${word.romanization}`);
    }
    for (const step of quest.steps) {
      for (const page of step.discover?.pages ?? []) {
        for (const item of page.items) {
          if (item.type === 'jamo' && !(wordSymbols(item.example.ko) ?? []).includes(item.jamoId)) {
            problems.push(`${item.jamoId}: example ${item.example.ko} does not use it`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('T8 romanizes every Korean word in lower-case Revised Romanization without hyphens', () => {
    const problems: string[] = [];
    for (const text of koTextsOf(quest)) {
      if (!/^[a-z/ ]+$/.test(text.romanization)) problems.push(`${text.ko}: "${text.romanization}" is not lower-case Latin`);
      // A written-symbol option (ㅓ) carries its sound value (eo, g/k), checked with the jamo records.
      if (jamoAll.some((j) => j.char === text.ko)) continue;
      for (const issue of checkRomanization(text.ko, text.romanization, ctx)) problems.push(`${text.ko}: ${issue.message}`);
    }
    expect(problems).toEqual([]);
  });

  it('T9 rewards a card of its own episode, and that episode lists only its own cards', () => {
    const episode = episodesAll.find((e) => e.questIds.includes(quest.id));
    expect(episode).toBeDefined();
    expect(quest.rewardCardId).toBeDefined();
    expect(cardById(quest.rewardCardId!)).toBeDefined();
    expect(episode!.rewardCardIds).toContain(quest.rewardCardId);
    for (const cardId of episode!.rewardCardIds) expect(cardById(cardId)?.unlockedBy, cardId).toBe(episode!.id);
  });

  it('T10 estimates its minutes from its step durations (within one minute)', () => {
    const seconds = quest.steps.reduce((n, s) => n + (s.durationSeconds ?? 0), 0);
    expect(quest.steps.every((s) => s.durationSeconds !== undefined)).toBe(true);
    expect(Math.abs(quest.estimatedMinutes - Math.round(seconds / 60))).toBeLessThanOrEqual(1);
  });

  it('T11 has no Hangul in any English field', () => {
    const found = englishFieldsOf(quest).filter((f) => HANGUL.test(f.text));
    expect(found).toEqual([]);
  });
});

describe('T5 across the bundle', () => {
  it('leaves no entry in minigameScopes unreferenced', () => {
    const referenced = new Set(questsAll.flatMap((q) => q.steps.flatMap((s) => (s.minigameRef ? [s.minigameRef] : []))));
    expect(Object.keys(minigameScopes).filter((ref) => !referenced.has(ref))).toEqual([]);
  });
});

describe('T9 across Stage 1', () => {
  it.runIf(ALL_REBUILT)('makes all 30 Stage 1 cards earnable: quest rewards, episode extras, stage1-complete and first-launch', () => {
    const stage1Episodes = episodesAll.filter((e) => e.stage === 'stage1' && e.placement !== 'shelf');
    const earnable = new Set([
      ...REBUILT.flatMap((q) => (q.rewardCardId ? [q.rewardCardId] : [])),
      ...stage1Episodes.flatMap((e) => e.rewardCardIds),
      'card:hangul-day',
      'card:lantern',
      'card:gayageum',
      'card:tiger',
    ]);
    expect(earnable.size).toBe(30);
  });
});

describe('the sound hints (Appendix A)', () => {
  it('every one of the 30 symbols carries a short English sound hint', () => {
    for (const jamo of jamoAll) {
      expect(jamo.soundHint, jamo.id).toBeTruthy();
      expect(jamo.soundHint!.length, jamo.id).toBeLessThanOrEqual(60);
      expect(HANGUL.test(jamo.soundHint!), jamo.id).toBe(false);
    }
  });

  it('describes the soft stops as soft and light, and the aspirated ones with a puff of air (audit F15)', () => {
    const hint = (char: string, kind = 'consonant'): string => jamoAll.find((j) => j.char === char && j.kind === kind)?.soundHint ?? '';
    for (const ch of ['ㄱ', 'ㄷ', 'ㅂ', 'ㅈ']) expect(hint(ch), ch).toContain('soft, light');
    for (const ch of ['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ']) expect(hint(ch), ch).toContain('puff of air');
    expect(hint('ㅇ')).toContain('silent at the start of a block');
    expect(hint('ㅇ', 'batchim')).toContain('ng');
  });
});
