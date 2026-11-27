import type { AssessmentResponse, RouteCatalog, RouteQuest, StageKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  bankLookup,
  reportPage,
  OLDER_SENTENCE_ID,
  REVISED_SENTENCE_ID,
  symbolText,
  startChoices,
  startingSpotRow,
  strandExamples,
  type BankEntry,
  type ReportPageInput,
} from '../report-page';
import { PLACEMENT_BANK } from '../../../content/placement.generated';
import { gate, placementResult } from './fixtures';

const quest = (n: number, stage: StageKey = 'stage1', extra: Partial<RouteQuest> = {}): RouteQuest => ({
  id: `quest:q${n}`,
  episodeId: `episode:e${n}`,
  stage,
  theme: 'letters',
  order: n,
  teaches: [],
  playable: true,
  grid: true,
  ...extra,
});

/** Five Stage 1 quests, one Stage 2 quest, a shelf quest and one not yet playable. */
const catalog: RouteCatalog = {
  quests: [
    quest(1),
    quest(2),
    quest(3),
    quest(4, 'stage1', { playable: false }),
    quest(5),
    quest(6, 'stage2'),
    quest(7, 'stage1', { grid: false }),
  ],
};

const BANK: Readonly<Record<string, BankEntry>> = {
  'pitem:sb-a': { format: 'hear-pick-written', gate: 'sound-basic', tags: ['sym:ㄱ', 'group:basic'] },
  'pitem:sb-b': { format: 'see-pick-sound', gate: 'sound-basic', tags: ['sym:ㄴ', 'group:basic'] },
  'pitem:sb-c': { format: 'hear-pick-written', gate: 'sound-basic', tags: ['sym:ㅏ', 'group:basic'] },
  'pitem:sr-a': { format: 'hear-pick-written', gate: 'sound-rest', tags: ['sym:ㅕ', 'group:rest'] },
  'pitem:sr-b': { format: 'hear-pick-written', gate: 'sound-rest', tags: ['sym:ㄱ', 'group:rest'] },
  'pitem:cv-a': { format: 'build-syllable', gate: 'syl-cv', tags: ['sym:ㄴ', 'sym:ㅏ', 'shape:cv'] },
  'pitem:cvc-a': { format: 'hear-pick-written', gate: 'syl-cvc', tags: ['sym:ㄱ', 'sym:ㅏ', 'sym:ㄴ/final', 'shape:cvc'] },
  'pitem:vocab-a': { format: 'hear-pick-picture', gate: 'vocab', tags: ['word:bap'] },
};
const lookup = (id: string): BankEntry | undefined => BANK[id];

const response = (questionId: string, outcome: AssessmentResponse['outcome'], extra: Partial<AssessmentResponse> = {}): AssessmentResponse => ({
  questionId,
  outcome,
  chosenOptionId: outcome === 'skipped' ? null : 'a',
  assisted: false,
  ms: 1000,
  ...extra,
});

const input = (over: Partial<ReportPageInput> = {}): ReportPageInput => ({
  placements: [placementResult()],
  catalog,
  completedQuestIds: new Set(),
  isEntitled: (stage) => stage === 'stage1',
  profileType: 'child',
  lookup,
  ...over,
});

describe('strandExamples (section 3.9: a plain example per decoding strand)', () => {
  it('lists symbols answered right as known and symbols missed, skipped or revealed as new, in the order they first came up', () => {
    const result = placementResult({
      responses: [
        response('pitem:sb-a', 'correct'),
        response('pitem:sb-b', 'wrong'),
        response('pitem:sb-c', 'correct'),
        response('pitem:sr-a', 'skipped'),
        response('pitem:sr-b', 'correct', { assisted: true }),
        response('pitem:cv-a', 'correct'),
        response('pitem:vocab-a', 'correct'),
      ],
    });
    expect(strandExamples(result, lookup)).toEqual({
      // ㄱ was right in sound-basic but revealed in sound-rest: it is new, never both.
      'sound-letter': { known: ['ㅏ'], fresh: ['ㄱ', 'ㄴ', 'ㅕ'] },
      'syllable-reading': { known: ['ㄴ', 'ㅏ'], fresh: [] },
    });
  });

  it('leaves out prompts that could not play, ids not in the bank and strands with nothing to show', () => {
    const result = placementResult({
      responses: [
        response('pitem:sb-a', 'skipped', { noSound: true }),
        response('pitem:gone', 'correct'),
        response('pitem:cvc-a', 'wrong'),
      ],
    });
    expect(strandExamples(result, lookup)).toEqual({
      'syllable-reading': { known: [], fresh: ['ㄱ', 'ㅏ', 'ㄴ/final'] },
    });
  });

  it('shows at most six symbols in each list', () => {
    const many: Record<string, BankEntry> = {};
    const responses: AssessmentResponse[] = [];
    ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅇ', 'ㅏ', 'ㅓ'].forEach((sym, i) => {
      many[`pitem:m${i}`] = { format: 'hear-pick-written', gate: 'sound-basic', tags: [`sym:${sym}`] };
      responses.push(response(`pitem:m${i}`, 'correct'));
    });
    const examples = strandExamples(placementResult({ responses }), (id) => many[id]);
    expect(examples['sound-letter']?.known).toEqual(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅇ']);
  });
});

describe('startChoices (the "Choose a different start" list)', () => {
  it('lists the playable, entitled grid quests in route order with their state', () => {
    const seed = {
      level: { stage: 'stage1' as const, band: 1 as const },
      oralStage: null,
      startQuestId: 'quest:q3',
      startEpisodeId: 'episode:e3',
      placedOutQuestIds: ['quest:q1'],
      priorityTokens: [],
      themeOrder: [],
      beyondContent: false,
      needsStage: null,
    };
    expect(startChoices(seed, catalog, new Set(['quest:q2']), (s) => s === 'stage1')).toEqual([
      { questId: 'quest:q1', state: 'placedOut' },
      { questId: 'quest:q2', state: 'done' },
      { questId: 'quest:q3', state: 'start' },
      { questId: 'quest:q5', state: 'ahead' },
    ]);
  });
});

describe('startChoices leaves out a cell\'s later volume (F-CURR-002 row CM-41)', () => {
  it('a Volume 2 quest is no start a grown-up can choose', () => {
    const seed = {
      level: { stage: 'stage1' as const, band: 0 as const },
      oralStage: null,
      startQuestId: 'quest:q1',
      startEpisodeId: 'episode:e1',
      placedOutQuestIds: [],
      priorityTokens: [],
      themeOrder: [],
      beyondContent: false,
      needsStage: null,
    };
    const withLater: RouteCatalog = { quests: [quest(1), quest(8, 'stage1', { laterVolume: true })] };
    expect(startChoices(seed, withLater, new Set(), () => true)).toEqual([{ questId: 'quest:q1', state: 'start' }]);
  });
});

describe('startingSpotRow (the dashboard row)', () => {
  it('is null without a result', () => {
    expect(startingSpotRow([])).toBeNull();
    expect(startingSpotRow(undefined)).toBeNull();
  });

  it('shows the highest level reached, the date of the newest check and whether a grown-up changed the start', () => {
    const older = placementResult({ id: 'placement:old', completedAt: '2026-10-01T10:00:00.000Z', level: { stage: 'stage1', band: 2 } });
    const newer = placementResult({ id: 'placement:new', completedAt: '2026-10-05T10:00:00.000Z', level: { stage: 'stage1', band: 1 } });
    expect(startingSpotRow([newer, older])).toEqual({ level: { stage: 'stage1', band: 2 }, takenAt: newer.completedAt, overridden: false });
    const changed = { ...older, override: { by: 'parent' as const, at: '2026-10-06T00:00:00.000Z', startQuestId: 'quest:q1' } };
    expect(startingSpotRow([changed, newer])?.overridden).toBe(true);
  });

  it('a later, higher check raises the row; two checks finished at the same instant keep their order', () => {
    const first = placementResult({ id: 'placement:first', level: { stage: 'stage1', band: 1 } });
    const second = placementResult({ id: 'placement:second', level: { stage: 'stage2', band: 0 } });
    expect(startingSpotRow([first, second])?.level).toEqual({ stage: 'stage2', band: 0 });
    expect(startingSpotRow([second, first])?.level).toEqual({ stage: 'stage2', band: 0 });
  });
});

describe('reportPage (section 3.9)', () => {
  it('is empty without a result', () => {
    expect(reportPage(input({ placements: [] }))).toEqual({ kind: 'empty' });
  });

  it('reads the newest result for "What we saw" and the route in force for where it starts', () => {
    const older = placementResult({
      id: 'placement:old',
      completedAt: '2026-10-01T10:00:00.000Z',
      level: { stage: 'stage1', band: 1 },
      placedOutQuestIds: ['quest:q1', 'quest:q2'],
    });
    const newer = placementResult({
      id: 'placement:new',
      completedAt: '2026-10-03T10:00:00.000Z',
      testLocale: 'es',
      gates: [gate('sound-basic', 'decode', 'fail', 1)],
      responses: [response('pitem:sb-a', 'correct')],
    });
    const page = reportPage(input({ placements: [older, newer], completedQuestIds: new Set(['quest:q3']) }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.resultId).toBe('placement:new');
    expect(page.takenAt).toBe(newer.completedAt);
    expect(page.testLocale).toBe('es');
    // A lower retake never moves the route back: band 1 and q1, q2 stay placed out; q3 is done.
    expect(page.level).toEqual({ stage: 'stage1', band: 1 });
    expect(page.startQuestId).toBe('quest:q5');
    expect(page.view.rungs).toEqual([{ gate: 'sound-basic', form: 'decode', status: 'getting-there', counts: [{ correct: 1, asked: 3 }], note: null }]);
    expect(page.examples).toEqual({ 'sound-letter': { known: ['ㄱ'], fresh: [] } });
    expect(page.choices.map((c) => c.state)).toEqual(['placedOut', 'placedOut', 'done', 'start']);
    expect(page.overridden).toBe(false);
    expect(page.needsStage).toBeNull();
    expect(page.retakeHidden).toBeNull();
    expect(page.shortHint).toBe(false);
  });

  it('a parent override in force moves the start earlier and is reported', () => {
    const result = placementResult({
      placedOutQuestIds: ['quest:q1', 'quest:q2', 'quest:q3'],
      override: { by: 'parent', at: '2026-10-02T00:00:00.000Z', startQuestId: 'quest:q2' },
    });
    const page = reportPage(input({ placements: [result] }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.startQuestId).toBe('quest:q2');
    expect(page.overridden).toBe(true);
  });

  it('notes a stage the account does not include, without a start', () => {
    const result = placementResult({ level: { stage: 'stage2', band: 0 }, placedOutQuestIds: ['quest:q1', 'quest:q2', 'quest:q3', 'quest:q5'] });
    const page = reportPage(input({ placements: [result] }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.startQuestId).toBeNull();
    expect(page.needsStage).toBe('stage2');
    expect(page.beyondContent).toBe(false);
  });

  it('offers the retake with the sound guide hidden on a child profile only (a self profile has it on the result)', () => {
    const notTested = placementResult({
      revealMode: 'always',
      mode: 'deep',
      strands: {
        'hangul-recognition': 'secure',
        'sound-letter': 'not-tested',
        'syllable-reading': 'not-tested',
        vocabulary: 'getting-there',
        sentences: 'not-yet',
      },
    });
    const child = reportPage(input({ placements: [notTested], profileType: 'child' }));
    const self = reportPage(input({ placements: [notTested], profileType: 'self' }));
    if (child.kind !== 'report' || self.kind !== 'report') throw new Error('expected reports');
    expect(child.retakeHidden).toEqual({ mode: 'deep' });
    expect(self.retakeHidden).toBeNull();
    // A Standard run stripped of `mode` by an older reader retakes as Standard.
    const { mode: _m, ...legacy } = { ...notTested, mode: 'standard' as const };
    const old = reportPage(input({ placements: [legacy], profileType: 'child' }));
    if (old.kind !== 'report') throw new Error('expected a report');
    expect(old.retakeHidden).toEqual({ mode: 'standard' });
  });

  it('carries the Short hint for every profile type', () => {
    const short = placementResult({
      mode: 'short',
      length: 'quick',
      gates: [gate('sound-basic', 'decode', 'pass', 3), gate('syl-cv', 'decode', 'fail', 2)],
    });
    for (const profileType of ['self', 'child'] as const) {
      const page = reportPage(input({ placements: [short], profileType }));
      if (page.kind !== 'report') throw new Error('expected a report');
      expect(page.shortHint).toBe(true);
      expect(page.view.shortNotTested).toBe(true);
    }
  });

  it('shows letter examples only under a strand the check measured', () => {
    const result = placementResult({
      strands: {
        'hangul-recognition': 'secure',
        'sound-letter': 'getting-there',
        'syllable-reading': 'not-tested',
        vocabulary: 'not-tested',
        sentences: 'not-tested',
      },
      responses: [response('pitem:sb-a', 'correct'), response('pitem:cv-a', 'correct')],
    });
    const page = reportPage(input({ placements: [result] }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.examples).toEqual({ 'sound-letter': { known: ['ㄱ'], fresh: [] } });
  });

  it('finds Spelling with tiles by looking the response up in the bank', () => {
    const deep = placementResult({ mode: 'deep', responses: [response('pitem:cv-a', 'correct'), response('pitem:gone', 'wrong')] });
    const page = reportPage(input({ placements: [deep] }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.view.spellingTiles).toBe('secure');
  });
});

describe('reportPage: the block and the older sentence questions (AMENDMENTS-PLC-VALIDITY section 3.8, PV-4)', () => {
  const decoded = () => [
    gate('sound-basic', 'decode', 'pass', 3),
    gate('syl-cv', 'decode', 'pass', 3),
    gate('sound-rest', 'decode', 'pass', 3),
    gate('syl-cvc', 'decode', 'pass', 3),
  ];
  const asked = (...ids: string[]) => ids.map((id) => response(id, 'correct'));
  const OLD_IDS = ['pitem:sent-n-read-horangiyeyo', 'pitem:sent-v-read-babeulmeogeoyo', 'pitem:sent-reply-2'];
  const NEW_IDS = ['pitem:sent-read-run-bear', 'pitem:sent-read-sleep-cat', 'pitem:sent-reply-2'];
  /** A stage 3 result: the whole reading ladder and the sentence read passed, on the sentence items `ids`. */
  const sentenceRead = (over: Parameters<typeof placementResult>[0] = {}) =>
    placementResult({
      level: { stage: 'stage3', band: 0 },
      gates: [...decoded(), gate('vocab', 'read', 'pass', 3), gate('sentence', 'read', 'pass', 3)],
      responses: asked(...OLD_IDS),
      ...over,
    });
  const olderOf = (placements: Parameters<typeof placementResult>[0][]): boolean | undefined => {
    const page = reportPage(input({ placements: placements.map((p) => placementResult(p)), isEntitled: () => true }));
    return page.kind === 'report' ? page.olderSentences : undefined;
  };

  it('the heritage listener: reading at the beginning, listening at the sentences, per-form rows, route at Stage 1', () => {
    const result = placementResult({
      gates: [gate('sound-basic', 'decode', 'fail', 1), gate('vocab', 'oral', 'pass', 3), gate('sentence', 'oral', 'pass', 3)],
      strands: {
        'hangul-recognition': 'not-tested',
        'sound-letter': 'getting-there',
        'syllable-reading': 'not-tested',
        vocabulary: 'secure',
        sentences: 'secure',
      },
      level: { stage: 'stage1', band: 0 },
      oralStage: 'stage3',
    });
    const page = reportPage(input({ placements: [result] }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.view.skills).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: 'stage3', ahead: true });
    expect(page.view.strands.find((s) => s.strand === 'vocabulary')?.forms).toEqual([{ form: 'oral', status: 'secure' }]);
    expect(page.view.strands.find((s) => s.strand === 'sentences')?.forms).toEqual([{ form: 'oral', status: 'secure' }]);
    expect(page.level).toEqual({ stage: 'stage1', band: 0 });
    expect(page.olderSentences).toBe(false);
  });

  it('the block reads the newest result, not the route in force', () => {
    const older = sentenceRead({ id: 'placement:old', completedAt: '2026-10-01T10:00:00.000Z', responses: asked(...NEW_IDS) });
    const newer = placementResult({
      id: 'placement:new',
      completedAt: '2026-10-05T10:00:00.000Z',
      gates: [gate('sound-basic', 'decode', 'fail', 1)],
      strands: { ...placementResult().strands, 'sound-letter': 'getting-there' },
      level: { stage: 'stage1', band: 0 },
      oralStage: 'stage2',
    });
    const page = reportPage(input({ placements: [older, newer], isEntitled: () => true }));
    if (page.kind !== 'report') throw new Error('expected a report');
    expect(page.level.stage).toBe('stage3');
    expect(page.view.skills).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: 'stage2', ahead: true });
  });

  it('shows the older-sentences line only for a Stage 3 route that the older sentence items placed, whatever the bank version', () => {
    // The ids decide: a result that was asked a retired picture item, at any version.
    for (const bankVersion of [1, 2, 3, 4]) expect(olderOf([sentenceRead({ bankVersion })]), `v${bankVersion}`).toBe(true);
    // The revised predicate pictures (and the replies both banks share) stand for themselves, at any version.
    for (const bankVersion of [1, 2, 3, 4]) expect(olderOf([sentenceRead({ bankVersion, responses: asked(...NEW_IDS) })]), `v${bankVersion}`).toBe(false);
    // Replies alone say nothing about the picture items, and a result that stored no sentence id does not show it.
    expect(olderOf([sentenceRead({ responses: asked('pitem:sent-reply-2') })])).toBe(false);
    expect(olderOf([sentenceRead({ responses: [] })])).toBe(false);
    // A route below Stage 3 never shows it, even for an older check.
    expect(olderOf([placementResult({ bankVersion: 1, level: { stage: 'stage2', band: 0 } })])).toBe(false);
    // An older result whose sentence read did not pass (Stage 3 came from nowhere else) is not the cause.
    expect(olderOf([sentenceRead({ bankVersion: 1, gates: [...decoded(), gate('vocab', 'read', 'pass', 3), gate('sentence', 'read', 'fail', 1)] })])).toBe(false);
    // Only a sentence read counts, not a sentence heard.
    expect(olderOf([sentenceRead({ bankVersion: 1, gates: [...decoded(), gate('vocab', 'read', 'pass', 3), gate('sentence', 'oral', 'pass', 3)] })])).toBe(false);
  });

  it('a later check on the revised bank that also passed the sentences takes the line away; one that did not leaves it', () => {
    const old = sentenceRead({ id: 'placement:v1', bankVersion: 1, completedAt: '2026-10-01T10:00:00.000Z' });
    const revised = sentenceRead({ id: 'placement:v3', bankVersion: 3, completedAt: '2026-11-30T10:00:00.000Z', responses: asked(...NEW_IDS) });
    const lower = placementResult({ id: 'placement:v3b', bankVersion: 3, completedAt: '2026-11-30T10:00:00.000Z', level: { stage: 'stage2', band: 0 } });
    const of = (placements: ReturnType<typeof placementResult>[]) => {
      const page = reportPage(input({ placements, isEntitled: () => true }));
      return page.kind === 'report' ? page.olderSentences : undefined;
    };
    expect(of([old, revised])).toBe(false);
    // A lower retake never moves the route back, so the old pass still stands behind Stage 3.
    expect(of([old, lower])).toBe(true);
  });
});

describe('the older and revised sentence id patterns follow the bundled bank (PV-4)', () => {
  // The line keys on the ids a result stores, so a rename in the sentence bank must not drift from the patterns.
  const sentences = PLACEMENT_BANK.templates.filter((t) => t.gate === 'sentence');

  it('every older-pattern sentence item (N-ieyo, N-eul V) is an older id, and no other sentence item is', () => {
    expect(sentences.length).toBeGreaterThan(0);
    for (const t of sentences) {
      const tags = t.question.tags;
      const older = tags.includes('pattern:n-ieyo') || tags.includes('pattern:n-eul-v');
      expect(OLDER_SENTENCE_ID.test(t.id), t.id).toBe(older);
    }
  });

  it('every predicate-picture item (N-i V) is a revised id, and no older or reply item is', () => {
    for (const t of sentences) {
      const revised = t.question.tags.includes('pattern:n-i-v');
      expect(REVISED_SENTENCE_ID.test(t.id), t.id).toBe(revised);
    }
    expect(REVISED_SENTENCE_ID.test('pitem:sent-reply-1')).toBe(false);
  });
});

describe('bankLookup and symbolText (what the screen feeds the page)', () => {
  it('looks a response id up in the bank: format, gate and tags; unknown ids are undefined', () => {
    const template = {
      id: 'pitem:sb-x',
      gate: 'sound-basic' as const,
      question: { format: 'hear-pick-written' as const, tags: ['sym:ㄱ'] },
    };
    const look = bankLookup({ templates: [template] });
    expect(look('pitem:sb-x')).toEqual({ format: 'hear-pick-written', gate: 'sound-basic', tags: ['sym:ㄱ'] });
    expect(look('pitem:none')).toBeUndefined();
  });

  it('draws a symbol key as its letter and sound value; a final uses the final sound', () => {
    const jamo = [
      { char: 'ㄱ', kind: 'consonant' as const, romanization: 'g/k' },
      { char: 'ㄱ', kind: 'batchim' as const, romanization: 'k' },
      { char: 'ㅏ', kind: 'vowel' as const, romanization: 'a' },
    ];
    expect(symbolText('ㄱ', jamo)).toEqual({ ko: 'ㄱ', romanization: 'g/k' });
    expect(symbolText('ㄱ/final', jamo)).toEqual({ ko: 'ㄱ', romanization: 'k' });
    expect(symbolText('ㅏ', jamo)).toEqual({ ko: 'ㅏ', romanization: 'a' });
    expect(symbolText('ㅎ', jamo)).toBeUndefined();
  });
});
