import {
  ROMANIZATION_EXCEPTIONS,
  RealiaReadRoundSchema,
  RealiaSchema,
  checkRomanization,
  realiaReadIssues,
  type KoText,
  type RealiaReadRound,
} from '@hangul-route/content-schema';
import { layout } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { REALIA_FIXTURES } from '../../navigation/realia-read-e2e-fixture';
import {
  REALIA_READ_TIMING,
  lineBaseLabel,
  lineGloss,
  lineSpeech,
  lineViews,
  playableRealia,
  realiaArrangement,
  realiaHeaderView,
  realiaOptionColumns,
  realiaOptionView,
  realiaStatus,
  sheetKind,
  sheetSummary,
  shuffleRealiaOptions,
  startRealiaRead,
  stepRealiaRead,
  titleView,
  type RealiaReadEvent,
  type RealiaReadState,
} from '../realia-read-flow';

/** F-CURR-001 row G-2; design/wireframes/minigame/realia-read.md, design/screens/minigame-realia-read/README.md. */
const en = getMessages('en');
const COPY = en.learner.minigame;
const A11Y = en.a11y.minigame;
const KOREAN_ITEM = en.a11y.koreanItem;

const menu = playableRealia(REALIA_FIXTURES.menu)!;
const q1 = menu.rounds[0]!;
const always = { romanizationMode: 'always' as const };
const tapMode = { romanizationMode: 'tap' as const };

function run(state: RealiaReadState, events: RealiaReadEvent[]): { state: RealiaReadState; effects: unknown[] } {
  let s = state;
  const effects: unknown[] = [];
  for (const e of events) {
    const out = stepRealiaRead(s, e);
    s = out.state;
    effects.push(...out.effects);
  }
  return { state: s, effects };
}

const tap = (optionId: string, at: number, answerId = q1.answerId): RealiaReadEvent => ({ type: 'tap', optionId, answerId, at });

describe('the fixtures are valid Realia Read content', () => {
  it.each(Object.entries(REALIA_FIXTURES))('%s parses and cross-checks', (_name, scope) => {
    const realia = RealiaSchema.parse(scope.realiaRead.realia);
    const rounds = scope.realiaRead.rounds.map((r) => RealiaReadRoundSchema.parse(r));
    expect(realiaReadIssues(realia, rounds)).toEqual([]);
    expect(playableRealia(scope)?.rounds).toHaveLength(rounds.length);
  });

  // Listed in romanization-registry.ts (F-CNT-002 §3.4) as a test fixture checked here: every Hangul-only text is checked with the
  // converter; a figure with digits (2,000원, 3:00) is read by its authored romanization.
  it('romanizes every Hangul-only text as the converter does', () => {
    const texts: KoText[] = Object.values(REALIA_FIXTURES).flatMap((scope) => {
      const realia = RealiaSchema.parse(scope.realiaRead.realia);
      const rounds = scope.realiaRead.rounds.map((r) => RealiaReadRoundSchema.parse(r));
      return [
        ...(realia.title ? [realia.title] : []),
        ...realia.entries.flatMap((e) => [e.text, ...(e.value ? [e.value] : [])]),
        ...rounds.flatMap((r) => [...(r.key ? [r.key] : []), ...r.options.flatMap((o) => (o.text ? [o.text] : []))]),
      ];
    });
    const plain = texts.filter((t) => !/\d/.test(t.ko));
    expect(plain.length).toBeGreaterThan(20);
    for (const t of plain) expect(checkRomanization(t.ko, t.romanization, { exceptions: ROMANIZATION_EXCEPTIONS }), t.ko).toEqual([]);
  });

  it('keeps every price a round practice amount in won, up to 10,000 (OD-11)', () => {
    const prices = Object.values(REALIA_FIXTURES).flatMap((s) =>
      s.realiaRead.realia.entries.flatMap((e) => [...(e.value?.ko.matchAll(/([\d,]+)원/g) ?? [])].map((m) => Number(m[1]!.replace(/,/g, '')))),
    );
    expect(prices.length).toBeGreaterThan(0);
    for (const p of prices) {
      expect(p % 1000).toBe(0);
      expect(p).toBeLessThanOrEqual(10000);
    }
  });
});

describe('playableRealia', () => {
  const base = REALIA_FIXTURES.menu.realiaRead;
  const round = (over: Partial<RealiaReadRound>): RealiaReadRound => ({ ...base.rounds[0]!, ...over });

  it('skips a question with fewer than two options, duplicate ids, an answer outside them or an unknown line', () => {
    const rounds = [
      round({ id: 'ok' }),
      round({ id: 'one', options: [base.rounds[0]!.options[0]!] }),
      round({ id: 'dup', options: [base.rounds[0]!.options[0]!, base.rounds[0]!.options[0]!] }),
      round({ id: 'noanswer', answerId: 'zzz' }),
      round({ id: 'noline', answerEntryId: 'zzz' }),
      round({ id: 'noentry', answerEntryId: undefined }),
    ];
    expect(playableRealia({ realiaRead: { realia: base.realia, rounds } })?.rounds.map((r) => r.id)).toEqual(['ok', 'noentry']);
  });

  it('is empty without a scope, without lines or without a playable question', () => {
    expect(playableRealia({})).toBeNull();
    expect(playableRealia({ realiaRead: { realia: { ...base.realia, entries: [] }, rounds: base.rounds } })).toBeNull();
    expect(playableRealia({ realiaRead: { realia: base.realia, rounds: [round({ answerId: 'zzz' })] } })).toBeNull();
  });
});

describe('shuffleRealiaOptions', () => {
  it('is deterministic per seed, keeps every option and leaves the input alone', () => {
    const a = shuffleRealiaOptions(q1, 7);
    expect(shuffleRealiaOptions(q1, 7)).toEqual(a);
    expect(a.options.map((o) => o.id).sort()).toEqual(q1.options.map((o) => o.id).sort());
    expect(q1.options[0]!.id).toBe('samcheon');
    const orders = new Set(Array.from({ length: 20 }, (_, s) => shuffleRealiaOptions(q1, s).options[0]!.id));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('stepRealiaRead', () => {
  it('starts asking, or empty with nothing to play (and stays empty)', () => {
    expect(startRealiaRead(3)).toMatchObject({ status: 'asking', roundIdx: 0, total: 3, wrongIds: [], lookHere: false });
    const empty = startRealiaRead(0);
    expect(empty.status).toBe('empty');
    expect(startRealiaRead(-2).total).toBe(0);
    expect(stepRealiaRead(empty, tap('samcheon', 1))).toEqual({ state: empty, effects: [] });
  });

  it('a right tap scores, speaks the option and schedules the next question', () => {
    const out = stepRealiaRead(startRealiaRead(3), tap('samcheon', 100));
    expect(out.state.status).toBe('resolved');
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: true },
      { type: 'haptic', kind: 'success' },
      { type: 'play-option', optionId: 'samcheon' },
      { type: 'schedule-advance', ms: REALIA_READ_TIMING.advanceDelayMs },
    ]);
    expect(REALIA_READ_TIMING.advanceDelayMs).toBe(700);
  });

  it('a miss locks the option and nudges; the second miss rings the line; the realia stays', () => {
    const one = run(startRealiaRead(3), [tap('icheon', 100)]);
    expect(one.state).toMatchObject({ status: 'asking', wrongIds: ['icheon'], lookHere: false });
    expect(one.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'haptic', kind: 'nudge' },
    ]);
    // The same locked option again does nothing.
    expect(stepRealiaRead(one.state, tap('icheon', 500)).effects).toEqual([]);
    const two = run(one.state, [tap('ocheon', 500)]);
    expect(two.state).toMatchObject({ wrongIds: ['icheon', 'ocheon'], lookHere: true });
  });

  it('drops a second touch inside the 50 ms window', () => {
    const one = run(startRealiaRead(3), [tap('icheon', 100)]);
    expect(stepRealiaRead(one.state, tap('samcheon', 100 + REALIA_READ_TIMING.touchWindowMs - 1)).effects).toEqual([]);
    expect(stepRealiaRead(one.state, tap('samcheon', 100 + REALIA_READ_TIMING.touchWindowMs)).state.status).toBe('resolved');
  });

  it('a line tap plays the line and reveals it, never scores, and is ignored after a hit', () => {
    const out = stepRealiaRead(startRealiaRead(3), { type: 'line', entryId: 'ramyeon' });
    expect(out.effects).toEqual([
      { type: 'haptic', kind: 'light' },
      { type: 'play-line', entryId: 'ramyeon' },
    ]);
    expect(out.state.revealed).toEqual(['ramyeon']);
    // Again: plays again, the reveal list is unchanged (same state object).
    const again = stepRealiaRead(out.state, { type: 'line', entryId: 'ramyeon' });
    expect(again.state).toBe(out.state);
    expect(again.effects).toHaveLength(2);
    const hit = stepRealiaRead(out.state, tap('samcheon', 10)).state;
    expect(stepRealiaRead(hit, { type: 'line', entryId: 'gimbap' })).toEqual({ state: hit, effects: [] });
  });

  it('advances through the questions, keeps reveals, then completes once', () => {
    let s = run(startRealiaRead(2), [{ type: 'line', entryId: 'gimbap' }, tap('icheon', 10), tap('samcheon', 100)]).state;
    // advance only from resolved
    expect(stepRealiaRead(startRealiaRead(2), { type: 'advance' }).effects).toEqual([]);
    const next = stepRealiaRead(s, { type: 'advance' });
    expect(next.state).toMatchObject({ status: 'asking', roundIdx: 1, wrongIds: [], lookHere: false, lastTapAt: null, revealed: ['gimbap'] });
    expect(next.effects).toEqual([]);
    s = run(next.state, [tap('icheon', 1000, 'icheon')]).state;
    const done = stepRealiaRead(s, { type: 'advance' });
    expect(done).toEqual({ state: { ...s, status: 'done' }, effects: [{ type: 'complete' }] });
    expect(stepRealiaRead(done.state, { type: 'advance' }).effects).toEqual([]);
    expect(stepRealiaRead(done.state, tap('samcheon', 5000)).effects).toEqual([]);
  });
});

describe('realiaHeaderView', () => {
  it('practice: a bar and n / N that only fills', () => {
    expect(realiaHeaderView('quest', startRealiaRead(4), COPY)).toEqual({ kind: 'bar', title: undefined, value: 1, max: 4, label: '1 / 4' });
  });

  it('check and review: fill-only dots, the Check titled', () => {
    const resolved = { ...startRealiaRead(2), status: 'resolved' as const };
    expect(realiaHeaderView('check', resolved, COPY)).toEqual({ kind: 'dots', title: 'Quick check', value: 1, max: 2, label: undefined });
    expect(realiaHeaderView('review', startRealiaRead(2), COPY)).toMatchObject({ kind: 'dots', title: undefined, value: 0 });
  });
});

describe('realiaArrangement', () => {
  it('side by side from 700 wide (tablet portrait and landscape phones), stacked below', () => {
    expect(realiaArrangement(699, layout.sideBySideMin)).toBe('stacked');
    expect(realiaArrangement(700, layout.sideBySideMin)).toBe('side');
    expect(realiaArrangement(768, layout.sideBySideMin)).toBe('side');
    expect(realiaArrangement(320, layout.sideBySideMin)).toBe('stacked');
  });
});

describe('the sheet', () => {
  it('draws each kind, and the plain sheet without one', () => {
    expect(sheetKind(menu.realia)).toBe('menu');
    expect(sheetKind({ ...menu.realia, kind: undefined })).toBe('plain');
  });

  it('names the group by kind and line count', () => {
    expect(sheetSummary(menu.realia, A11Y)).toBe('Menu, 4 lines');
    expect(sheetSummary(REALIA_FIXTURES.ticket.realiaRead.realia, A11Y)).toBe('Train ticket, 2 lines');
    expect(sheetSummary(REALIA_FIXTURES.sign.realiaRead.realia, A11Y)).toBe('Trail sign, 3 lines');
    expect(sheetSummary(REALIA_FIXTURES.priceCards.realiaRead.realia, A11Y)).toBe('Price cards, 3 lines');
    expect(sheetSummary({ ...menu.realia, kind: undefined }, A11Y)).toBe('Reading sheet, 4 lines');
    expect(sheetSummary(menu.realia, getMessages('ko').a11y.minigame)).toBe('메뉴판, 4줄');
  });

  it('names a line by its Korean, romanization, value and direction', () => {
    const [ramyeon] = menu.realia.entries.filter((e) => e.id === 'ramyeon');
    expect(lineBaseLabel(ramyeon!, A11Y)).toBe('라면, ramyeon, 3,000원, samcheon won');
    const summit = REALIA_FIXTURES.sign.realiaRead.realia.entries[0]!;
    expect(lineBaseLabel(summit, A11Y)).toBe('정상, jeongsang, 1시간, han sigan, to the right');
    expect(lineBaseLabel({ id: 'x', text: { ko: 'ㅇ', romanization: 'silent/ng', en: 'x' } }, A11Y)).toBe('ㅇ, silent or ng');
    expect(lineGloss(ramyeon!)).toBe('instant noodles, 3,000 won');
    expect(lineGloss(REALIA_FIXTURES.sign.realiaRead.realia.entries[1]!)).toBe('entrance');
  });

  it('asking: no marks and no glosses; tap mode hides romanization until a line is tapped', () => {
    const views = lineViews(menu.realia, q1, startRealiaRead(3), always, A11Y);
    expect(views.every((v) => v.mark === 'none' && v.gloss === undefined)).toBe(true);
    expect(views[2]).toMatchObject({ text: { ko: '라면', romanization: 'ramyeon' }, value: { ko: '3,000원', romanization: 'samcheon won' } });
    const tapped = { ...startRealiaRead(3), revealed: ['ramyeon'] };
    const hidden = lineViews(menu.realia, q1, tapped, tapMode, A11Y);
    expect(hidden[0]!.text.romanization).toBe('');
    expect(hidden[0]!.value?.romanization).toBe('');
    expect(hidden[2]!.text.romanization).toBe('ramyeon');
    // The setting hides a visual line, not information.
    expect(hidden[0]!.accessibilityLabel).toBe('김밥, gimbap, 2,000원, icheon won');
  });

  it('second miss: the answer line is ringed and its name says so', () => {
    const state = run(startRealiaRead(3), [tap('icheon', 1), tap('ocheon', 100)]).state;
    const views = lineViews(menu.realia, q1, state, always, A11Y);
    expect(views.map((v) => v.mark)).toEqual(['none', 'none', 'lookHere', 'none']);
    expect(views[2]!.accessibilityLabel).toBe('라면, ramyeon, 3,000원, samcheon won. Look here');
  });

  it('hit: the answer line is found, with its gloss in view and in its name', () => {
    const state = run(startRealiaRead(3), [tap('samcheon', 1)]).state;
    const views = lineViews(menu.realia, q1, state, always, A11Y);
    expect(views[2]).toMatchObject({ mark: 'found', gloss: 'instant noodles, 3,000 won' });
    expect(views[2]!.accessibilityLabel).toBe('라면, ramyeon, 3,000원, samcheon won. instant noodles, 3,000 won. Found here');
    expect(lineViews(menu.realia, q1, { ...state, status: 'done' }, always, A11Y)[2]!.mark).toBe('found');
  });

  it('a question with no answer line marks nothing', () => {
    const state = run(startRealiaRead(3), [tap('icheon', 1), tap('ocheon', 100)]).state;
    expect(lineViews(menu.realia, { ...q1, answerEntryId: undefined }, state, always, A11Y).every((v) => v.mark === 'none')).toBe(true);
    expect(lineViews(menu.realia, undefined, state, always, A11Y).every((v) => v.mark === 'none')).toBe(true);
  });

  it('carries a sign board direction and a card goods', () => {
    const sign = lineViews(REALIA_FIXTURES.sign.realiaRead.realia, undefined, startRealiaRead(1), always, A11Y);
    expect(sign.map((v) => v.dir)).toEqual(['right', 'left', 'left']);
    expect(sign[1]!.value).toBeUndefined();
    const cards = lineViews(REALIA_FIXTURES.priceCards.realiaRead.realia, undefined, startRealiaRead(1), always, A11Y);
    expect(cards.map((v) => v.goods)).toEqual(['apples', 'fan', 'hanji']);
  });

  it('the title shows its romanization in always mode, and is always named with it', () => {
    expect(titleView(menu.realia, always)).toEqual({ ko: '메뉴', romanization: 'menyu', label: '메뉴, menyu' });
    expect(titleView(menu.realia, tapMode)).toEqual({ ko: '메뉴', romanization: '', label: '메뉴, menyu' });
    expect(titleView(REALIA_FIXTURES.priceCards.realiaRead.realia, always)).toBeUndefined();
  });

  it('a line tap speaks the line, then its value; a voiced word uses its spoken form and clip', () => {
    expect(lineSpeech(menu.realia.entries[2]!)).toEqual({ text: '라면 3,000원', audioRef: undefined });
    expect(lineSpeech({ id: 'x', text: { ko: '입구', romanization: 'ipgu', en: 'entrance', audioRef: 'a.mp3' } })).toEqual({ text: '입구', audioRef: 'a.mp3' });
    expect(lineSpeech({ id: 'x', text: { ko: '3:00', romanization: 'se si', en: '3:00', spokenKo: '세 시' } }).text).toBe('세 시');
  });
});

describe('realiaOptionView', () => {
  const option = (id: string) => q1.options.find((o) => o.id === id)!;

  it('a Korean option is named as Korean with its romanization, hidden in tap mode until answered', () => {
    const idle = realiaOptionView(q1, option('icheon'), startRealiaRead(3), always, A11Y, KOREAN_ITEM);
    expect(idle).toMatchObject({ cardState: 'idle', ko: '이천 원', romanization: 'icheon won', accessibilityLabel: 'Korean: 이천 원, icheon won' });
    expect(realiaOptionView(q1, option('icheon'), startRealiaRead(3), tapMode, A11Y, KOREAN_ITEM).romanization).toBe('');
    const missed = run(startRealiaRead(3), [tap('icheon', 1)]).state;
    const wrong = realiaOptionView(q1, option('icheon'), missed, tapMode, A11Y, KOREAN_ITEM);
    expect(wrong).toMatchObject({ cardState: 'wrong', romanization: 'icheon won', accessibilityLabel: 'Not this one: Korean: 이천 원, icheon won' });
  });

  it('never rings the right option after two misses (the line is ringed instead)', () => {
    const state = run(startRealiaRead(3), [tap('icheon', 1), tap('ocheon', 100)]).state;
    expect(realiaOptionView(q1, option('samcheon'), state, always, A11Y, KOREAN_ITEM).cardState).toBe('idle');
  });

  it('after the hit: the right card is correct, the rest disabled', () => {
    const state = run(startRealiaRead(3), [tap('samcheon', 1)]).state;
    expect(realiaOptionView(q1, option('samcheon'), state, always, A11Y, KOREAN_ITEM)).toMatchObject({
      cardState: 'correct',
      accessibilityLabel: 'Right answer: Korean: 삼천 원, samcheon won',
    });
    expect(realiaOptionView(q1, option('cheon'), state, always, A11Y, KOREAN_ITEM).cardState).toBe('disabled');
  });

  it('a figure is its own label; a picture is named by its label, else "Picture"', () => {
    const ticket = REALIA_FIXTURES.ticket.realiaRead.rounds[0]!;
    expect(realiaOptionView(ticket, ticket.options[0]!, startRealiaRead(1), always, A11Y, KOREAN_ITEM)).toMatchObject({ label: '3:00', ko: undefined, accessibilityLabel: '3:00' });
    const pic = { id: 'p', pictureRef: 'word:apple', labelEn: 'apple' };
    const round = { ...ticket, options: [pic, ...ticket.options] };
    expect(realiaOptionView(round, pic, startRealiaRead(1), always, A11Y, KOREAN_ITEM)).toMatchObject({ pictureRef: 'word:apple', label: 'apple', accessibilityLabel: 'apple' });
    expect(realiaOptionView(round, { id: 'q', pictureRef: 'word:x' }, startRealiaRead(1), always, A11Y, KOREAN_ITEM).label).toBe('Picture');
    expect(realiaOptionView(round, { id: 'z' }, startRealiaRead(1), always, A11Y, KOREAN_ITEM).label).toBe('');
  });
});

describe('realiaOptionColumns', () => {
  it('one column on a narrow phone or for long text, two for short text and pictures', () => {
    expect(realiaOptionColumns(q1, 320)).toBe(1);
    expect(realiaOptionColumns(q1, 375)).toBe(2);
    const long = { ...q1, options: [{ id: 'a', text: { ko: '아주아주아주 긴 대답이에요', romanization: 'x', en: 'x' } }, q1.options[0]!] };
    expect(realiaOptionColumns(long, 375)).toBe(1);
    expect(realiaOptionColumns({ ...q1, options: [{ id: 'p', pictureRef: 'word:apple', labelEn: 'apple' }, q1.options[0]!] }, 375)).toBe(2);
    const ticket = REALIA_FIXTURES.ticket.realiaRead.rounds[0]!;
    expect(realiaOptionColumns(ticket, 375)).toBe(2);
    expect(realiaOptionColumns({ ...ticket, options: [{ id: 'z' }, { id: 'y' }] } as RealiaReadRound, 375)).toBe(2);
  });
});

describe('realiaStatus', () => {
  it('nothing until a miss; Hoya after a miss; the ringed line announced after the second', () => {
    expect(realiaStatus(menu.realia, q1, startRealiaRead(3), 'quest', COPY, A11Y)).toEqual({ hoya: undefined, lookHere: undefined });
    const one = run(startRealiaRead(3), [tap('icheon', 1)]).state;
    expect(realiaStatus(menu.realia, q1, one, 'quest', COPY, A11Y)).toEqual({ hoya: 'Look again', lookHere: undefined });
    const two = run(one, [tap('ocheon', 100)]).state;
    expect(realiaStatus(menu.realia, q1, two, 'quest', COPY, A11Y)).toEqual({
      hoya: 'Look again',
      lookHere: 'Look here: 라면, ramyeon, 3,000원, samcheon won',
    });
    expect(realiaStatus(menu.realia, { ...q1, answerEntryId: undefined }, two, 'quest', COPY, A11Y).lookHere).toBeUndefined();
  });

  it('says nothing in a review or once the question is answered', () => {
    const one = run(startRealiaRead(3), [tap('icheon', 1)]).state;
    expect(realiaStatus(menu.realia, q1, one, 'review', COPY, A11Y).hoya).toBeUndefined();
    const hit = run(one, [tap('samcheon', 100)]).state;
    expect(realiaStatus(menu.realia, q1, hit, 'quest', COPY, A11Y).hoya).toBeUndefined();
  });
});
