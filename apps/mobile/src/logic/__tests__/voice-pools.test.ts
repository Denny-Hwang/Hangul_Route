import {
  CATALOG,
  LECTURE_PRESETS,
  LectureDeckSchema,
  PRESET_LENGTHS,
  presetDeck,
  resolvePreset,
  StageKeySchema,
  type Jamo,
  type LectureBlock,
  type PresetContext,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../content';
import { jamoAll, jamoBatchim, jamoConsonants, jamoVowels } from '../../content/jamo';
import { jamoVoice } from '../audio/jamo-voice';
import { lectureBundle } from '../lecture/content';
import { expandDeck, type Slide } from '../lecture/deck-builder';
import { minigameScopes } from '../minigame-config';
import { buildMatchSoundRounds, FINAL_QUIZ_JAMO_IDS, LETTER_QUIZ_JAMO_IDS, type MatchSoundRound } from '../round-builder';
import { buildHangulCheck } from '../stage1/hangul-check';
import { decompose } from '../stage1/hangul';
import {
  allowedDistractors,
  letterTileAllowed,
  poolKindFault,
  poolShortfalls,
  soundTileAllowed,
  tileAllowed,
  type PoolQuestion,
} from '../voice-pools';

/**
 * JV-A3 pool rules (AMENDMENTS-AUDIO-CLIPS section 3, G2 = 0): no tile is right by ear but the
 * answer, on every shipped scope and every lecture preset (seeds 1 to 20).
 *
 * Letter question: the voice says the letter's name (`jamoVoice(j, 'letter')`); its tiles have unique
 * names, no final, no vowel heard inside a consonant target's name (1b), no ㅇ beside ㅣ or ㅡ and no
 * name holding a vowel target's text (1c). Sound question: one kind of tile, and no distractor is a
 * component of the spoken syllable in its position (2); finals are asked only that way (3, 4).
 */

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const byId = (id: string): Jamo => {
  const j = jamoAll.find((x) => x.id === id);
  if (!j) throw new Error(`unknown ${id}`);
  return j;
};
const byChar = (char: string, kind: 'letter' | 'final'): Jamo => {
  const pool = kind === 'final' ? jamoBatchim : [...jamoConsonants, ...jamoVowels];
  const j = pool.find((x) => x.char === char);
  if (!j) throw new Error(`no ${kind} ${char}`);
  return j;
};
const J = (id: string): Jamo => byId(`jamo:${id}`);
const name = (j: Jamo): string => jamoVoice(j, 'letter').text;

/** Every JV-A3 fault of one round, as readable strings (empty when the round is clean). */
function roundFaults(question: PoolQuestion, round: MatchSoundRound, tileCount = 4): string[] {
  const faults: string[] = [];
  const target = round.promptJamo;
  const ids = round.tiles.map((t) => t.id);
  if (round.tiles.length !== tileCount) faults.push(`${target.id}: ${round.tiles.length} tiles, wants ${tileCount}`);
  if (new Set(ids).size !== ids.length) faults.push(`${target.id}: a tile twice`);
  if (!ids.includes(target.id)) faults.push(`${target.id}: the answer is not a tile`);
  if (question === 'letter') {
    if (round.tiles.some((t) => t.kind === 'batchim')) faults.push(`${target.id}: a final in a letter round`);
    const names = round.tiles.map(name);
    if (new Set(names).size !== names.length) faults.push(`${target.id}: two tiles share a name (${names.join(' ')})`);
  } else {
    if (new Set(round.tiles.map((t) => t.kind)).size !== 1) faults.push(`${target.id}: tiles of two kinds`);
  }
  for (const t of round.tiles) {
    if (t.id !== target.id && !tileAllowed(question, target, t)) faults.push(`${target.id}: ${t.char} (${t.id}) is right by ear`);
  }
  return faults;
}

describe('rule 1: letter questions say names, and every name in a round differs', () => {
  it('the 24 letter-question names are unique, and no final is a letter question', () => {
    const letters = [...LETTER_QUIZ_JAMO_IDS].map(byId);
    expect(new Set(letters.map(name)).size).toBe(24);
    for (const f of jamoBatchim) {
      expect(letterTileAllowed(J('nieun'), f)).toBe(false);
      expect(letterTileAllowed(f, J('nieun'))).toBe(false);
    }
  });

  it('a tile never sits beside itself', () => {
    expect(letterTileAllowed(J('nieun'), J('nieun'))).toBe(false);
    expect(soundTileAllowed(J('nieun-batchim'), J('nieun-batchim'))).toBe(false);
  });
});

describe('rule 1b: no vowel heard inside a consonant target name', () => {
  it.each([
    ['digeut', ['i', 'eu']],
    ['rieul', ['i', 'eu']],
    ['mieum', ['i', 'eu']],
    ['ieung', ['i', 'eu']],
    ['nieun', ['i', 'eu']],
    ['bieup', ['i', 'eu']],
    ['jieut', ['i', 'eu']],
    ['chieut', ['i', 'eu']],
    ['kieuk', ['i', 'eu']],
    ['tieut', ['i', 'eu']],
    ['pieup', ['i', 'eu']],
    ['hieut', ['i', 'eu']],
    ['giyeok', ['i', 'yeo']],
    ['siot', ['i', 'o']],
  ])('%s excludes exactly %j among the ten vowels', (consonant, excluded) => {
    const out = jamoVowels.filter((v) => !letterTileAllowed(J(consonant), v)).map((v) => v.id.replace('jamo:', ''));
    expect(out.sort()).toEqual([...excluded].sort());
  });

  it('Quest 1 keeps its four tiles: neither 기역 nor 니은 holds ㅏ or ㅓ', () => {
    for (const c of ['giyeok', 'nieun']) for (const v of ['a', 'eo']) expect(letterTileAllowed(J(c), J(v))).toBe(true);
  });

  it('a consonant tile beside a consonant target is never refused by 1b', () => {
    for (const a of jamoConsonants) for (const b of jamoConsonants) if (a.id !== b.id) expect(letterTileAllowed(a, b)).toBe(true);
  });
});

describe('rule 1c: a vowel target heard inside another name', () => {
  it('ㅇ never sits beside ㅣ or ㅡ', () => {
    expect(letterTileAllowed(J('i'), J('ieung'))).toBe(false);
    expect(letterTileAllowed(J('eu'), J('ieung'))).toBe(false);
  });

  it('accepted, not a fault: ㅇ beside ㅗ ㅜ ㅏ ㅓ (이응 holds none of them)', () => {
    for (const v of ['o', 'u', 'a', 'eo']) expect(letterTileAllowed(J(v), J('ieung'))).toBe(true);
  });

  it('no tile name holds a vowel target text as a whole syllable', () => {
    for (const v of jamoVowels) {
      for (const t of [...jamoConsonants, ...jamoVowels]) {
        if (t.id === v.id || !letterTileAllowed(v, t)) continue;
        expect([...name(t)], `${v.char} beside ${t.char}`).not.toContain(name(v));
      }
    }
  });
});

describe('rule 2: sound questions', () => {
  it('final tiles beside a final target: only the answer is the final of its closed syllable', () => {
    for (const target of jamoBatchim) {
      const text = jamoVoice(target, 'sound').text;
      expect(decompose(text)?.final).toBe(target.char);
      expect(allowedDistractors('sound', target, jamoBatchim).map((j) => j.id)).toEqual(jamoBatchim.filter((j) => j.id !== target.id).map((j) => j.id));
    }
  });

  it('tiles of another kind, or one that is a component of the syllable in its position, are refused', () => {
    // 안 holds ㅇ at the start: an initial ㅇ tile is another kind, never a final-round tile.
    expect(soundTileAllowed(J('nieun-batchim'), J('ieung'))).toBe(false);
    // 아 holds ㅏ: a vowel round for ㅏ never offers ㅏ twice, and ㅓ is not in 아.
    expect(soundTileAllowed(J('a'), J('eo'))).toBe(true);
    // 나 holds ㄴ in the initial position: ㄱ is allowed beside it, ㄴ is the answer.
    expect(soundTileAllowed(J('nieun'), J('giyeok'))).toBe(true);
  });

  it('the kind rule: a letter pool takes no final, a sound pool takes one kind', () => {
    expect(poolKindFault('letter', [J('a'), J('nieun-batchim')])).toMatch(/no final/);
    expect(poolKindFault('letter', [J('a'), J('nieun')])).toBeNull();
    expect(poolKindFault('sound', [J('a'), J('nieun')])).toMatch(/one kind/);
    expect(poolKindFault('sound', jamoBatchim)).toBeNull();
  });
});

describe('buildMatchSoundRounds applies the rules', () => {
  it('throws on a final in a letter pool and on mixed kinds in a sound pool', () => {
    expect(() => buildMatchSoundRounds({ scopeJamoIds: ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun-batchim'], rounds: 2, seed: 1 })).toThrow(/no final/);
    expect(() => buildMatchSoundRounds({ scopeJamoIds: ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'], rounds: 2, seed: 1, question: 'sound' })).toThrow(/one kind/);
  });

  it('a target with too few allowed distractors throws (a content test fails, never a learner)', () => {
    // ㄷ beside ㅣ ㅡ ㄹ: 디귿 holds ㅣ and ㅡ, so only ㄹ is left.
    expect(() =>
      buildMatchSoundRounds({ scopeJamoIds: ['jamo:digeut', 'jamo:i', 'jamo:eu', 'jamo:rieul'], rounds: 1, focusJamoIds: ['jamo:digeut'], seed: 1 }),
    ).toThrow(/digeut has 1 allowed/);
    // The rule runs from the target: 이 and 으 are not heard in 디귿 or 리을, so ㅣ and ㅡ can still be asked here.
    expect(poolShortfalls('letter', ['digeut', 'i', 'eu', 'rieul'].map(J), 4)).toEqual([
      { id: 'jamo:digeut', allowed: 1 },
      { id: 'jamo:rieul', allowed: 1 },
    ]);
  });

  it('Stage 1 / Letters / Q3 Play: a ㄷ round draws its distractors from ㄹ ㅁ ㅇ ㅗ ㅜ', () => {
    const scope = minigameScopes['minigame:s1-letters-q3-play']!;
    const allowed = new Set(['rieul', 'mieum', 'ieung', 'o', 'u'].map((id) => `jamo:${id}`));
    let seen = 0;
    for (const seed of SEEDS) {
      for (const round of buildMatchSoundRounds({ scopeJamoIds: scope.jamoIds!, rounds: scope.rounds!, focusJamoIds: scope.focusJamoIds!, seed })) {
        if (round.promptJamo.id !== 'jamo:digeut') continue;
        seen += 1;
        for (const t of round.tiles) if (t.id !== 'jamo:digeut') expect(allowed.has(t.id), t.id).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('Stage 1 / Letters / Quest 1 Play keeps {ㅏ ㅓ ㄱ ㄴ} in every round', () => {
    const scope = minigameScopes['minigame:s1-letters-q1-play']!;
    for (const seed of SEEDS) {
      for (const round of buildMatchSoundRounds({ scopeJamoIds: scope.jamoIds!, rounds: scope.rounds!, focusJamoIds: scope.focusJamoIds!, seed })) {
        expect(round.tiles.map((t) => t.char).sort()).toEqual(['ㄱ', 'ㄴ', 'ㅏ', 'ㅓ']);
      }
    }
  });
});

describe('every shipped Match Sound scope (G2 = 0)', () => {
  const scopes = Object.entries(minigameScopes).filter(([, s]) => s.kind === 'match-sound');

  it('the scopes named by the amendment are among them', () => {
    const refs = scopes.map(([ref]) => ref);
    for (const ref of ['s1-letters-q1-play', 's1-letters-q2-play', 's1-letters-q3-play', 's1-life-q1-play', 's1-life-q2-play', 's1-rites-q2-play']) {
      expect(refs).toContain(`minigame:${ref}`);
    }
  });

  it.each(scopes)('%s: letters only, and every target fills its 4 tiles', (_ref, scope) => {
    const pool = jamoAll.filter((j) => scope.jamoIds!.includes(j.id));
    expect(poolKindFault('letter', pool)).toBeNull();
    expect(poolShortfalls('letter', pool, 4)).toEqual([]);
  });

  it.each(scopes)('%s: seeds 1-20 build clean rounds', (_ref, scope) => {
    const faults: string[] = [];
    for (const seed of SEEDS) {
      const rounds = buildMatchSoundRounds({ scopeJamoIds: scope.jamoIds!, rounds: scope.rounds ?? 4, ...(scope.focusJamoIds ? { focusJamoIds: scope.focusJamoIds } : {}), seed });
      for (const r of rounds) faults.push(...roundFaults('letter', r).map((f) => `seed ${seed} ${f}`));
    }
    expect(faults).toEqual([]);
  });
});

describe('every Listen & Pick letter round (lp.sym) and the Hangul Check letter rounds', () => {
  const symRounds = Object.entries(minigameScopes).flatMap(([ref, s]) =>
    (s.listenPick?.rounds ?? []).filter((r) => r.id.startsWith('lp:sym:')).map((r) => [`${ref} ${r.id}`, r] as const),
  );

  it('there are letter rounds to check', () => {
    expect(symRounds.length).toBeGreaterThan(5);
  });

  it.each(symRounds)('%s: options are letters the rules allow beside the answer', (_label, round) => {
    const target = byId(round.answerId);
    for (const o of round.options) {
      const option = byId(o.id);
      expect(option.kind, o.id).not.toBe('batchim');
      if (o.id !== round.answerId) expect(letterTileAllowed(target, option), `${o.id} beside ${round.answerId}`).toBe(true);
    }
  });

  it('the Hangul Check letter rounds (seeds 1-20)', () => {
    const faults: string[] = [];
    for (const seed of SEEDS) {
      for (const item of buildHangulCheck({ seed }).items) {
        if (item.kind !== 'symbol' || byId(item.id).kind === 'batchim') continue;
        const target = byId(item.round.answerId);
        for (const o of item.round.options) if (o.id !== target.id && !letterTileAllowed(target, byId(o.id))) faults.push(`${target.id}: ${o.id}`);
      }
    }
    expect(faults).toEqual([]);
  });
});

// ---- the lecture ---------------------------------------------------------------------------------

type QuizSlide = Extract<Slide, { kind: 'quiz' }>;
const isSoundQuiz = (s: Slide): s is QuizSlide => s.kind === 'quiz' && s.prompt.ask === 'sound';

/** Every JV-A3 fault of a lecture sound-quiz slide; letter rounds and final rounds are told apart by `frame`. */
function slideFaults(slide: QuizSlide): string[] {
  if (slide.prompt.ask !== 'sound') return [];
  const final = slide.prompt.frame === 'endsWith';
  const kos = slide.options.map((o) => o.ko ?? '?');
  const answer = slide.options.find((o) => o.correct)?.ko;
  const label = `${slide.prompt.spoken.text} [${kos.join(' ')}]`;
  const faults: string[] = [];
  if (new Set(kos).size !== kos.length) faults.push(`${label}: two identical tiles`);
  if (answer === undefined || slide.options.filter((o) => o.correct).length !== 1) return [...faults, `${label}: not one answer`];
  if (final) {
    // A final round plays a closed syllable (악 안 알 암 압 앙) and shows final tiles only.
    const block = decompose(slide.prompt.spoken.text);
    if (block?.final !== answer) faults.push(`${label}: the syllable does not end in the answer`);
    for (const ko of kos) {
      const tile = jamoBatchim.find((j) => j.char === ko);
      if (!tile || !FINAL_QUIZ_JAMO_IDS.has(tile.id)) faults.push(`${label}: ${ko} is not a Stage 1 final`);
      else if (ko !== answer && !soundTileAllowed(byChar(answer, 'final'), tile)) faults.push(`${label}: ${ko} is right by ear`);
    }
    return faults;
  }
  // A letter round: initials and vowels only (a closed syllable here would be a final asked as a letter).
  if (decompose(slide.prompt.spoken.text)?.final) faults.push(`${label}: a final asked as a letter`);
  const target = byChar(answer, 'letter');
  for (const ko of kos) {
    const tile = [...jamoConsonants, ...jamoVowels].find((j) => j.char === ko);
    if (!tile) faults.push(`${label}: ${ko} is not a Stage 1 letter`);
    else if (ko !== answer && !letterTileAllowed(target, tile)) faults.push(`${label}: ${ko} is right by ear`);
  }
  return faults;
}

const bundle = lectureBundle('en');
const deckOf = (blocks: readonly LectureBlock[], seed: number) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:voicepools', title: 'Pools', createdAt: '2026-10-29T00:00:00Z', seed, blocks });

describe('the lecture sound quiz (JV-A3 rules 1, 3 and 4)', () => {
  it('M3: Letters Quest 1, Holidays Quest 7 and a quiz of everything never show two identical tiles, and ask no final as a letter', () => {
    const faults: string[] = [];
    let quizzes = 0;
    for (const seed of SEEDS) {
      const deck = deckOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }, { kind: 'quest', id: 'quest:stage1-rites-q1' }, { kind: 'quiz', from: 'all', rounds: 6 }], seed);
      const slides = expandDeck(deck, bundle, { canPlayKorean: true }).slides.filter(isSoundQuiz);
      quizzes += slides.length;
      for (const s of slides) faults.push(...slideFaults(s));
    }
    expect(quizzes).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });

  it('finals taught four or more: the quiz adds final rounds (endsWith, 악 안 알 암 압 앙, final tiles only)', () => {
    const blocks: LectureBlock[] = [
      { kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:nieun', 'jamo:digeut', 'jamo:rieul', 'jamo:a', 'jamo:eo'] },
      { kind: 'jamo-set', jamoIds: [...FINAL_QUIZ_JAMO_IDS] },
      { kind: 'quiz', from: 'all', rounds: 6 },
    ];
    const finalTexts = new Set(jamoBatchim.map((j) => jamoVoice(j, 'sound').text));
    expect([...finalTexts].sort()).toEqual(['악', '안', '알', '암', '압', '앙'].sort());
    for (const seed of SEEDS) {
      const quiz = expandDeck(deckOf(blocks, seed), bundle, { canPlayKorean: true }).slides.filter(isSoundQuiz);
      const finals = quiz.filter((s) => s.prompt.ask === 'sound' && s.prompt.frame === 'endsWith');
      expect(quiz).toHaveLength(6);
      expect(finals).toHaveLength(3);
      for (const s of finals) expect(s.prompt.ask === 'sound' && finalTexts.has(s.prompt.spoken.text)).toBe(true);
      expect(quiz.flatMap(slideFaults)).toEqual([]);
    }
  });

  it('every Stage 1 episode deck, seeds 1-20 (the match-sound steps and quizzes reuse the shipped pools)', () => {
    const stage1 = episodesAll.filter((e) => e.id.startsWith('episode:stage1-'));
    expect(stage1.length).toBeGreaterThanOrEqual(5);
    const faults: string[] = [];
    let quizzes = 0;
    for (const episode of stage1) {
      for (const seed of SEEDS) {
        const slides = expandDeck(deckOf([{ kind: 'episode', id: episode.id }], seed), bundle, { canPlayKorean: true }).slides.filter(isSoundQuiz);
        quizzes += slides.length;
        for (const s of slides) faults.push(...slideFaults(s).map((f) => `${episode.id} seed ${seed}: ${f}`));
      }
    }
    expect(quizzes).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });

  it('every lecture preset at every length, on a first visit and at each stage, seeds 1-20', () => {
    const contexts: PresetContext[] = [{ catalog: CATALOG }, ...StageKeySchema.options.map((stage): PresetContext => ({ catalog: CATALOG, stage }))];
    const faults: string[] = [];
    let quizzes = 0;
    for (const preset of LECTURE_PRESETS) {
      for (const length of PRESET_LENGTHS[preset]) {
        for (const ctx of contexts) {
          const resolved = resolvePreset(preset, length, ctx);
          for (const seed of SEEDS) {
            const meta = { id: 'lecture:voicepools', title: 'Pools', createdAt: '2026-10-29T00:00:00Z', seed, source: 'quick' as const };
            const slides = expandDeck(LectureDeckSchema.parse(presetDeck(resolved, meta)), bundle, { canPlayKorean: true }).slides.filter(isSoundQuiz);
            quizzes += slides.length;
            for (const s of slides) faults.push(...slideFaults(s).map((f) => `${preset} ${length} ${ctx.stage ?? 'first'} seed ${seed}: ${f}`));
          }
        }
      }
    }
    expect(quizzes).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });

  it('a warm-up whose letters crowd a consonant (ㄷ with ㅣ ㅡ) is topped up so its quiz still has four rounds', () => {
    for (const seed of SEEDS) {
      const { slides, skipped } = expandDeck(deckOf([{ kind: 'revisit', chars: ['ㄷ', 'ㅣ', 'ㅡ', 'ㄹ'] }], seed), bundle, { canPlayKorean: true });
      const quiz = slides.filter(isSoundQuiz);
      expect(skipped).toEqual([]);
      expect(quiz).toHaveLength(4);
      expect(quiz.flatMap(slideFaults)).toEqual([]);
    }
  });
});
