import type { AssessmentResponse, RouteCatalog, RouteQuest, StageKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  bankLookup,
  reportPage,
  symbolText,
  startChoices,
  startingSpotRow,
  strandExamples,
  type BankEntry,
  type ReportPageInput,
} from '../report-page';
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
