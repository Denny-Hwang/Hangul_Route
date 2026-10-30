import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  type Quest,
} from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { LECTURE_MINUTES_DECKS } from '@hangul-route/content-schema/testing/lecture-decks';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { findJamo, jamoAll, jamoKnown } from '../../content/jamo';
import { lessonQuests } from '../../content/lessons';
import { PLACEMENT_BANK } from '../../content/placement.generated';
import { storiesAll } from '../../content/stories';
import { finalLine, loneLetterQuestion, loneLetterVoice } from '../audio/jamo-lines';
import { jamoVoice, type JamoQuestion } from '../audio/jamo-voice';
import { listenPickSpeech } from '../audio/listen-pick-speech';
import { wrongAnswerBubble } from '../audio/prompt-view';
import { isLoneJamo } from '../audio/speech-guard';
import type { AudioCapability } from '../audio/capability';
import { lectureBundle, soundCheckSpec } from '../lecture/content';
import { expandDeck, type Slide } from '../lecture/deck-builder';
import { letterSecondSound, slideSound } from '../lecture/slide-view';
import { minigameScopes, scopeFor, type MinigameScope } from '../minigame-config';
import { promptView } from '../placement/item-view';
import { buildMatchSoundRounds, buildTraceStrokeRounds } from '../round-builder';
import { buildDiscover } from '../stage1/discover-flow';
import { buildHangulCheck } from '../stage1/hangul-check';

/**
 * AMENDMENTS-AUDIO-CLIPS section 6.2, `voice-surfaces.test.ts` (row JV-2): every surface of section 6.1
 * that speaks a lone jamo, over every shipped scope, says `jamoVoice(target, type).text`, where the type
 * is the surface's (JV-A1): a letter question says an initial's or a vowel's NAME (ㄴ is 니은), a sound
 * question the syllable (나), and a final is never said by name, only by its closed syllable (안).
 *
 * The table below is the list of surface builders. It is checked against a scan of the source for the
 * calls that say a jamo (`playJamo`, `jamoVoice`, `spokenFor` and the lone-letter helpers), so a surface
 * added later without a row here fails. A surface that speaks a jamo through `speak()` or a `KoText`
 * directly is caught by the speech guard of JV-A2 (a lone jamo text throws in tests) and by JV-4's e2e.
 */

interface Said {
  /** Where it was said, for the failure message. */
  where: string;
  target: Jamo;
  /** What the surface says. */
  spoken: string;
}

interface Surface {
  name: string;
  /** The source files that build what this surface says (relative to `src/`). Empty for content-only surfaces. */
  files: readonly string[];
  /** The question the surface asks about `target` (JV-A1). */
  type: (target: Jamo) => JamoQuestion;
  said: () => Said[];
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const letterOrFinal = (target: Jamo): JamoQuestion => (target.kind === 'batchim' ? 'sound' : 'letter');
const jamoOf = (id: string): Jamo => {
  const found = jamoKnown.find((j) => j.id === id);
  if (!found) throw new Error(`unknown jamo ${id}`);
  return found;
};

/** Every minigame scope a learner meets: the hand-written ones and every quest and lesson step's. */
function everyScope(): Array<[string, MinigameScope]> {
  const out = new Map<string, MinigameScope>(Object.entries(minigameScopes));
  for (const quest of [...questsAll, ...lessonQuests]) {
    for (const step of quest.steps) {
      const ref = step.minigameRef;
      if (ref === undefined || out.has(ref)) continue;
      const scope = scopeFor(ref);
      if (scope) out.set(ref, scope);
    }
  }
  return [...out];
}

const everyQuest = (): Quest[] => [...new Map([...questsAll, ...lessonQuests].map((q) => [q.id, q])).values()];

// ---- the lecture decks: every quest and episode, every preset at every length, the console's fixture decks --

const deckOf = (blocks: LectureBlock[], id = 'lecture:voice001') =>
  LectureDeckSchema.parse({ v: 1, id, title: 'Voice', createdAt: '2026-10-29T09:00:00Z', seed: 3, blocks });

function everyLectureSlide(): Slide[] {
  const shipped = lectureBundle('en');
  const voice = { canPlayKorean: true };
  const blocks: LectureBlock[] = [
    ...episodesAll.filter((e) => e.status !== 'preview' && e.questIds.length > 0).map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
    ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
  ];
  const slides: Slide[] = [];
  // In groups, each ending in a quiz over all it taught, so the sound quiz of every Stage 1 letter is built too.
  for (let i = 0; i < blocks.length; i += 6) {
    slides.push(...expandDeck(deckOf([...blocks.slice(i, i + 6), { kind: 'quiz', from: 'all', rounds: 6 }]), shipped, voice).slides);
  }
  const contexts: PresetContext[] = [
    { catalog: CATALOG },
    ...StageKeySchema.options.map((stage): PresetContext => ({ catalog: CATALOG, stage })),
    { catalog: CATALOG, revisitChars: ['ㅓ', 'ㄹ', 'ㄴ', 'ㅑ'] },
  ];
  const meta = { id: 'lecture:preset01', title: 'Preset', createdAt: '2026-10-29T09:00:00Z', seed: 7, source: 'quick' as const };
  for (const ctx of contexts) {
    for (const preset of LECTURE_PRESETS) {
      for (const minutes of PRESET_LENGTHS[preset]) {
        slides.push(...expandDeck(LectureDeckSchema.parse(presetDeck(resolvePreset(preset, minutes, ctx), meta)), shipped, voice).slides);
      }
    }
  }
  for (const fixture of LECTURE_MINUTES_DECKS) slides.push(...expandDeck(deckOf(fixture.blocks), shipped, voice).slides);
  return slides;
}

const LECTURE_SLIDES = everyLectureSlide();
const letterSlides = LECTURE_SLIDES.filter((s): s is Extract<Slide, { kind: 'letter' }> => s.kind === 'letter');
const soundQuizzes = LECTURE_SLIDES.filter(
  (s): s is Extract<Slide, { kind: 'quiz' }> & { prompt: { ask: 'sound' } } => s.kind === 'quiz' && s.prompt.ask === 'sound',
);

/** The jamo a quiz's correct tile names: its glyph and romanization (an initial ㄴ and a final ㄴ look alike until JV-3, M3). */
function quizTargets(slide: (typeof soundQuizzes)[number]): Jamo[] {
  const answer = slide.options.find((o) => o.correct);
  return jamoKnown.filter((j) => answer !== undefined && 'ko' in answer && j.char === answer.ko && j.romanization === answer.romanization);
}

// ---- the surfaces of section 6.1 ---------------------------------------------------------------------------

const SURFACES: readonly Surface[] = [
  {
    name: 'Match Sound (prompt, replay, Hear it and the wrong-answer bubble)',
    files: ['screens/minigames/MatchSoundGame.tsx', 'logic/audio/prompt-view.ts'],
    type: letterOrFinal,
    said: () =>
      everyScope()
        .filter(([, scope]) => scope.kind === 'match-sound')
        .flatMap(([ref, scope]) =>
          SEEDS.flatMap((seed) =>
            buildMatchSoundRounds({
              scopeJamoIds: [...(scope.jamoIds ?? [])],
              rounds: scope.rounds ?? 4,
              ...(scope.focusJamoIds ? { focusJamoIds: [...scope.focusJamoIds] } : {}),
              seed,
            }).flatMap((round, i): Said[] => {
              const where = `${ref} seed ${seed} round ${i + 1}`;
              const bubble = wrongAnswerBubble(round.promptJamo, getMessages('en').learner.audio);
              return [
                { where, target: round.promptJamo, spoken: loneLetterVoice(round.promptJamo).text },
                { where: `${where} bubble`, target: round.promptJamo, spoken: bubble.korean ?? '' },
              ];
            }),
          ),
        ),
  },
  {
    name: 'Listen & Pick letter rounds (lp:sym) of every quest and lesson',
    files: ['logic/scope-builders.ts'],
    type: () => 'letter',
    said: () =>
      everyScope().flatMap(([ref, scope]) =>
        (scope.listenPick?.rounds ?? [])
          .filter((round) => round.id.startsWith('lp:sym:'))
          .map((round): Said => ({ where: `${ref} ${round.id}`, target: jamoOf(round.answerId), spoken: listenPickSpeech(round).text })),
      ),
  },
  {
    name: 'Hangul Check, all 30 symbols (letters by name, finals by syllable options)',
    files: ['logic/stage1/hangul-check.ts', 'logic/scope-builders.ts'],
    type: letterOrFinal,
    said: () =>
      SEEDS.slice(0, 3).flatMap((seed) =>
        buildHangulCheck({ seed })
          .items.filter((item) => item.kind === 'symbol')
          .map((item): Said => ({ where: `seed ${seed} ${item.id}`, target: jamoOf(item.id), spoken: listenPickSpeech(item.round).text })),
      ),
  },
  {
    name: 'Trace Stroke, every config (initials and vowels by name, finals by their closed syllable)',
    files: ['screens/minigames/TraceStrokeGame.tsx'],
    type: letterOrFinal,
    said: () =>
      everyScope()
        .filter(([, scope]) => scope.kind === 'trace-stroke')
        .flatMap(([ref, scope]) =>
          buildTraceStrokeRounds({ scopeJamoIds: [...(scope.jamoIds ?? [])], rounds: scope.jamoIds?.length ?? 0, seed: 1 }).map(
            (round): Said => ({ where: ref, target: round.jamo, spoken: loneLetterVoice(round.jamo).text }),
          ),
        ),
  },
  {
    name: 'Discover, every page: Hear it',
    files: ['logic/stage1/discover-flow.ts', 'screens/quest/DiscoverStep.tsx'],
    type: letterOrFinal,
    said: () => discoverSaid('hear'),
  },
  {
    name: 'Discover, every consonant page: Hear it with a vowel',
    files: ['logic/stage1/discover-flow.ts'],
    type: () => 'sound',
    said: () => discoverSaid('soundWith'),
  },
  {
    name: 'Lecture letter slide, main speaker (an initial or a vowel by name; a final by its closed syllable)',
    files: ['logic/lecture/deck-builder.ts', 'screens/presenter/slides/LetterSlide.tsx'],
    type: letterOrFinal,
    said: () => letterSlides.map((s): Said => ({ where: s.key, target: jamoOf(s.jamoId), spoken: slideSound(s)?.spoken.text ?? '' })),
  },
  {
    name: 'Lecture letter slide, second speaker (a consonant on a vowel)',
    files: ['logic/lecture/deck-builder.ts'],
    type: () => 'sound',
    said: () =>
      letterSlides
        .filter((s) => s.sound !== undefined)
        .map((s): Said => ({ where: s.key, target: jamoOf(s.jamoId), spoken: letterSecondSound(s)?.spoken.text ?? '' })),
  },
  {
    name: 'Presenter sound check',
    files: ['logic/lecture/content.ts'],
    type: () => 'sound',
    said: () => {
      const clipsOnly: AudioCapability = { tts: { state: 'none', reason: 'no_korean_voice' }, clips: true, unlocked: true };
      const spec = soundCheckSpec(clipsOnly, () => true);
      return [{ where: 'clips, no Korean voice', target: jamoAll[0]!, spoken: spec.text }];
    },
  },
  {
    name: 'Placement sound-letter items (consonants by their sound, AU-OD-3; vowels by name = sound)',
    files: [],
    type: (target) => (target.kind === 'consonant' ? 'sound' : 'letter'),
    said: () =>
      PLACEMENT_BANK.templates.flatMap((t): Said[] => {
        if (t.strand !== 'sound-letter' || t.question.format !== 'hear-pick-written') return [];
        const answer = t.question.options.find((o) => o.isCorrect);
        const prompt = promptView({ ...t.question, id: t.id }, false);
        return [{ where: t.id, target: jamoOf(`jamo:${answer!.id}`), spoken: prompt.kind === 'speaker' ? prompt.text : '' }];
      }),
  },
];

/** The two Discover buttons of every symbol page of every quest and lesson. */
function discoverSaid(button: 'hear' | 'soundWith'): Said[] {
  const m = getMessages('en');
  return everyQuest().flatMap((quest) =>
    quest.steps.flatMap((step) => {
      if (step.kind !== 'discover' || !step.discover) return [];
      return buildDiscover(step.discover.pages, m.learner.quest.discover, m.a11y).pages.flatMap((page) =>
        page.items.flatMap((item): Said[] => {
          if (item.kind !== 'symbol') return [];
          const target = jamoOf(item.key.split('#')[0]!);
          const action = button === 'hear' ? item.hear : item.soundWith?.action;
          return action ? [{ where: `${quest.id} ${item.key}`, target, spoken: action.spec.text }] : [];
        }),
      );
    }),
  );
}

describe('voice surfaces: every surface says what its question asks (AMENDMENTS-AUDIO-CLIPS section 6.2, JV-2)', () => {
  it.each(SURFACES.map((s) => [s.name, s] as const))('%s', (_, surface) => {
    const said = surface.said();
    expect(said.length, surface.name).toBeGreaterThan(0);
    const wrong = said
      .map((s) => ({ ...s, expected: jamoVoice(s.target, surface.type(s.target)).text }))
      .filter((s) => s.spoken !== s.expected)
      .map((s) => `${s.where}: ${s.target.id} said "${s.spoken}", expected "${s.expected}"`);
    expect(wrong).toEqual([]);
    // Never a lone jamo, never a final asked by name.
    expect(said.filter((s) => isLoneJamo(s.spoken)).map((s) => s.where)).toEqual([]);
  });

  it('a letter question on a consonant says its name, never its carrier syllable (the owner\'s "ㄴ should be 니은")', () => {
    const nieun = findJamo('jamo:nieun')!;
    const matchSound = SURFACES[0]!.said().filter((s) => s.target.id === 'jamo:nieun');
    expect(matchSound.length).toBeGreaterThan(0);
    expect(new Set(matchSound.map((s) => s.spoken))).toEqual(new Set(['니은']));
    expect(jamoVoice(nieun, 'sound').text).toBe('나');
    expect(wrongAnswerBubble(nieun, getMessages('en').learner.audio)).toMatchObject({ korean: '니은', romanization: 'nieun' });
  });

  it('covers finals on the surfaces that show them: the lecture final slides, the final trace and the Hangul Check', () => {
    const finalSlides = letterSlides.filter((s) => s.final === true);
    expect(finalSlides.length).toBeGreaterThan(0);
    // A final's slide has no letter name and shows the finalLine.
    for (const s of finalSlides) {
      expect(s.nameKo, s.key).toBeUndefined();
      expect(s.sound, s.key).toBeUndefined();
    }
    const trace = SURFACES[3]!.said().filter((s) => s.where === 'minigame:s1-nature-q3-apply');
    expect(trace.map((s) => s.spoken).sort()).toEqual(['알', '암', '압', '앙']);
    const mieumFinal = jamoOf('jamo:mieum-batchim');
    expect(finalLine(mieumFinal, getMessages('en').learner.audio)).toBe('ㅁ at the bottom: 암 · am');
    expect(loneLetterQuestion(mieumFinal)).toBe('sound');
    // ㅁ and ㅇ in the same trace game: both by name now (M11).
    const q2 = SURFACES[3]!.said().filter((s) => s.where === 'minigame:s1-letters-q2-apply');
    expect(Object.fromEntries(q2.map((s) => [s.target.char, s.spoken]))).toMatchObject({ ㅁ: '미음', ㅇ: '이응' });
  });

  it('the lecture sound quiz says a letter by its name and a final by its closed syllable', () => {
    expect(soundQuizzes.length).toBeGreaterThan(20);
    const wrong = soundQuizzes.flatMap((s) => {
      const targets = quizTargets(s);
      const expected = targets.map((t) => loneLetterVoice(t).text);
      return targets.length > 0 && expected.includes(s.prompt.spoken.text) ? [] : [`${s.key}: "${s.prompt.spoken.text}" not in ${expected.join(', ')}`];
    });
    expect(wrong).toEqual([]);
  });

  it('story jamo keywords and check targets: until JV-3 (M8) only story:shapes-of-hangeul speaks a bare jamo', () => {
    const entries: Array<{ story: string; ko: string; spokenKo?: string }> = [];
    const walk = (story: string, value: unknown): void => {
      if (Array.isArray(value)) value.forEach((v) => walk(story, v));
      else if (value !== null && typeof value === 'object') {
        const { ko, spokenKo } = value as { ko?: unknown; spokenKo?: unknown };
        if (typeof ko === 'string' && isLoneJamo(ko)) entries.push({ story, ko, ...(typeof spokenKo === 'string' ? { spokenKo } : {}) });
        Object.values(value).forEach((v) => walk(story, v));
      }
    };
    for (const story of storiesAll) walk(story.id, story);
    expect(entries.length).toBeGreaterThan(0);
    const named = (ko: string) => {
      const letter = jamoKnown.find((j) => j.char === ko && j.kind !== 'batchim');
      return letter ? jamoVoice(letter, 'letter').text : undefined;
    };
    // A keyword with a spoken form says the letter's name.
    expect(entries.filter((e) => e.spokenKo !== undefined && e.spokenKo !== named(e.ko))).toEqual([]);
    // The ones without are the M8 rows JV-3 fixes; no other story may join them.
    expect([...new Set(entries.filter((e) => e.spokenKo === undefined).map((e) => e.story))]).toEqual(
      entries.some((e) => e.spokenKo === undefined) ? ['story:shapes-of-hangeul'] : [],
    );
  });
});

// ---- the table is the list of surfaces: a scan of the source finds no other caller -------------------------

const SRC = join(__dirname, '..', '..');
/** The voice itself and the platform plumbing: not surfaces. */
const PLUMBING = new Set([
  'logic/audio/jamo-voice.ts',
  'logic/audio/jamo-lines.ts',
  'logic/audio/spoken.ts',
  'logic/audio/controller.ts',
  'logic/audio/speech-guard.ts',
  'platform/audio.ts',
  'platform/audio.web.ts',
]);
const SAYS_A_JAMO = /\b(?:playJamo|jamoVoice|spokenFor|loneLetterVoice|loneLetterQuestion)\(/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === '__generated__' || entry.name === 'test-support') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe('the surface table is complete (section 6.2)', () => {
  const files = sourceFiles(SRC).map((path) => ({ rel: relative(SRC, path).split('\\').join('/'), source: readFileSync(path, 'utf8') }));

  it('every file that says a jamo is a row of the table, and every row names a file that does', () => {
    const callers = files.filter((f) => !PLUMBING.has(f.rel) && SAYS_A_JAMO.test(f.source)).map((f) => f.rel);
    const listed = new Set(SURFACES.flatMap((s) => s.files));
    expect(callers.filter((f) => !listed.has(f)), 'a surface that says a jamo needs a row in SURFACES').toEqual([]);
    // DiscoverStep and LetterSlide render what their builders said, and the Hangul Check builds its letter rounds
    // with `lp.sym`; every other listed file calls the voice itself.
    const throughAnother = new Set(['screens/quest/DiscoverStep.tsx', 'screens/presenter/slides/LetterSlide.tsx', 'logic/stage1/hangul-check.ts']);
    expect([...listed].filter((f) => !throughAnother.has(f) && !callers.includes(f)).sort()).toEqual([]);
  });

  it('no screen or component imports spokenFor: they say a jamo through jamoVoice (JV-A1)', () => {
    const offenders = files
      .filter((f) => /^(screens|components)\//.test(f.rel) && /\bspokenFor\b/.test(f.source))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});
