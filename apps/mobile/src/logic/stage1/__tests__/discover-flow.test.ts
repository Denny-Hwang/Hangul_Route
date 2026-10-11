import { localize, type DiscoverPage, type Overlays } from '@hangul-route/content-schema';
import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  buildDiscover as buildDiscoverWith,
  pageRender as pageRenderWith,
  startDiscover,
  stepDiscover,
  type DiscoverEvent,
  type DiscoverState,
} from '../discover-flow';

const messages = getMessages('en');
const COPY = messages.learner.quest.discover;
const buildDiscover = (pages: DiscoverPage[]): ReturnType<typeof buildDiscoverWith> =>
  buildDiscoverWith(pages, COPY, messages.a11y);
const pageRender = (
  model: Parameters<typeof pageRenderWith>[0],
  state: Parameters<typeof pageRenderWith>[1],
  mode: Parameters<typeof pageRenderWith>[2],
): ReturnType<typeof pageRenderWith> => pageRenderWith(model, state, mode, COPY);

const ko = (text: string, romanization: string, en: string, extra: Record<string, unknown> = {}) => ({
  ko: text,
  romanization,
  en,
  ...extra,
});

const pageOne: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:a', example: ko('나', 'na', 'I, me') },
    { type: 'jamo', jamoId: 'jamo:eo', example: ko('너', 'neo', 'you') },
  ],
};
const pageTwo: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:giyeok', example: ko('가구', 'gagu', 'furniture') },
    { type: 'jamo', jamoId: 'jamo:nieun', example: ko('나무', 'namu', 'tree', { spokenKo: '나무' }) },
  ],
  captionEn: 'The sound ga',
};
const wordsPage: DiscoverPage = {
  items: [
    { type: 'word', word: ko('아버지', 'abeoji', 'father', { syllables: ['a', 'beo', 'ji'], audioRef: 'audio/words/abeoji.mp3' }), picture: 'card:family-table' },
    { type: 'word', word: ko('아기', 'agi', 'baby', { spokenKo: '아기' }), noteEn: 'Also a pet name' },
  ],
};
const batchimPage: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:nieun-batchim', example: ko('문', 'mun', 'door') },
    { type: 'jamo', jamoId: 'jamo:rieul-batchim', example: ko('달', 'dal', 'moon') },
  ],
};

const run = (state: DiscoverState, ...events: DiscoverEvent[]): ReturnType<typeof stepDiscover> => {
  let out = { state, effects: [] as ReturnType<typeof stepDiscover>['effects'] };
  for (const e of events) out = stepDiscover(out.state, e);
  return out;
};

describe('buildDiscover: the sound hint in the UI language (F-I18N-001 §3.6)', () => {
  const overlays = { es: { 'jamo:giyeok': { soundHint: 'como la g de gato' } }, ko: {} };

  it('shows the overlay hint next to the unchanged glyph and romanization in the Spanish UI', () => {
    const es = buildDiscoverWith([pageTwo], COPY, messages.a11y, 'es', overlays).pages[0]!.items[0]!;
    const en = buildDiscoverWith([pageTwo], COPY, messages.a11y, 'en', overlays).pages[0]!.items[0]!;
    expect(es.soundHint).toBe('como la g de gato');
    expect(es.glyph).toBe(en.glyph);
    expect(es.romanization).toBe(en.romanization);
    expect(es.accessibilityLabel).toBe(messages.a11y.discoverLetter(en.romanization, 'como la g de gato'));
    expect(en.soundHint).toBeUndefined();
  });

  it('defaults to English and the generated overlays', () => {
    expect(buildDiscoverWith([pageTwo], COPY, messages.a11y)).toEqual(buildDiscover([pageTwo]));
  });
});

describe('buildDiscover: example and word glosses in the UI language (F-I18N-001 §3.5 rule 4)', () => {
  it('shows the glosses of a localized quest step; the Korean and its romanization stay', () => {
    const quest = { id: 'quest:discover-demo', steps: [{ id: 'discover', discover: { pages: [pageTwo, wordsPage] } }] };
    const overlays: Overlays = {
      es: {
        [quest.id]: {
          'steps.discover.discover.pages.0.caption': 'El sonido ga',
          'steps.discover.discover.pages.0.items.0.example.gloss': 'muebles',
          'steps.discover.discover.pages.1.items.0.word.gloss': 'padre',
          'steps.discover.discover.pages.1.items.1.note': 'También un apodo',
        },
      },
      ko: {},
    };
    const pages = localize(quest, quest.id, 'es', overlays).steps[0]!.discover.pages;
    const es = buildDiscoverWith(pages, COPY, messages.a11y, 'es', overlays).pages;
    const en = buildDiscover([pageTwo, wordsPage]).pages;
    expect(es[0]!.title).toBe('El sonido ga');
    expect(es[0]!.items[0]!.example).toEqual({ ...en[0]!.items[0]!.example, gloss: 'muebles' });
    expect(es[1]!.items[0]).toMatchObject({ glyph: '아버지', romanization: en[1]!.items[0]!.romanization, gloss: 'padre' });
    expect(es[1]!.items[0]!.accessibilityLabel).toBe('아버지, abeoji, padre');
    expect(es[1]!.items[1]!.note).toBe('También un apodo');
  });

  it("uses the jamo's translated example gloss when the page shows that jamo's own example word", () => {
    const overlays: Overlays = { es: { 'jamo:nieun': { 'exampleWord.gloss': 'árbol' }, 'jamo:giyeok': { 'exampleWord.gloss': 'familia' } }, ko: {} };
    const [giyeok, nieun] = buildDiscoverWith([pageTwo], COPY, messages.a11y, 'es', overlays).pages[0]!.items;
    // ㄴ: the page shows 나무 "tree", the jamo's own example word, so its Spanish gloss is used.
    expect(nieun!.example).toMatchObject({ ko: '나무', romanization: 'namu', gloss: 'árbol' });
    // ㄱ: the page shows 가구, not the jamo's 가족, so the page's gloss stays.
    expect(giyeok!.example!.gloss).toBe('furniture');
  });

  it("keeps the page gloss when it differs from the jamo's English example gloss (another sense) or was translated itself", () => {
    const overlays: Overlays = { es: { 'jamo:nieun': { 'exampleWord.gloss': 'árbol' } }, ko: {} };
    const wood: DiscoverPage = { items: [{ type: 'jamo', jamoId: 'jamo:nieun', example: ko('나무', 'namu', 'wood') }] };
    expect(buildDiscoverWith([wood], COPY, messages.a11y, 'es', overlays).pages[0]!.items[0]!.example!.gloss).toBe('wood');
    const translated: DiscoverPage = { items: [{ type: 'jamo', jamoId: 'jamo:nieun', example: ko('나무', 'namu', 'un árbol') }] };
    expect(buildDiscoverWith([translated], COPY, messages.a11y, 'es', overlays).pages[0]!.items[0]!.example!.gloss).toBe('un árbol');
    expect(buildDiscoverWith([pageTwo], COPY, messages.a11y, 'en', overlays).pages[0]!.items[1]!.example!.gloss).toBe('tree');
  });
});

describe('buildDiscover: the view model of the pages', () => {
  it('builds a symbol item with its sound, example and hear actions', () => {
    const model = buildDiscover([pageTwo]);
    expect(model.pages).toHaveLength(1);
    const page = model.pages[0]!;
    expect(page.items.map((i) => i.key)).toEqual(['jamo:giyeok', 'jamo:nieun']);
    const g = page.items[0]!;
    expect(g.kind).toBe('symbol');
    expect(g.glyph).toBe('ㄱ');
    expect(g.romanization).toBe('g/k');
    // The main button plays the SOUND (가), never the letter name (기역); the name is a second button.
    expect(g.hear.spec.text).toBe('가');
    expect(g.spokenRomanization).toBe('ga');
    expect(g.letterName).toMatchObject({ ko: '기역', romanization: 'giyeok' });
    expect(g.letterName?.action.spec.text).toBe('기역');
    expect(g.example).toMatchObject({ ko: '가구', romanization: 'gagu', gloss: 'furniture' });
    expect(g.example?.hear.spec.text).toBe('가구');
    // ids of the three buttons are distinct
    const ids = [g.hear.id, g.letterName?.action.id, g.example?.hear.id];
    expect(new Set(ids).size).toBe(3);
  });

  it('example audio uses spokenKo when the content has one, and an audioRef when present', () => {
    const page = buildDiscover([{ items: [{ type: 'jamo', jamoId: 'jamo:a', example: ko('아이', 'ai', 'child', { spokenKo: '아이이', audioRef: 'audio/words/ai.mp3' }) }] }]).pages[0]!;
    expect(page.items[0]!.example?.hear.spec).toEqual({ text: '아이이', audioRef: 'audio/words/ai.mp3' });
  });

  it('vowels and the silent initial have no separate letter-name button', () => {
    const vowel = buildDiscover([pageOne]).pages[0]!.items[0]!;
    expect(vowel.letterName).toBeUndefined();
    const silent = buildDiscover([{ items: [{ type: 'jamo', jamoId: 'jamo:ieung', example: ko('아이', 'ai', 'child') }] }]).pages[0]!.items[0]!;
    expect(silent.letterName).toBeUndefined();
    // ㅇ is spoken by its name, and shows "silent", never the empty-set sign
    expect(silent.hear.spec.text).toBe('이응');
    expect(silent.romanization).toBe('silent/ng');
    expect(silent.accessibilityLabel).not.toContain('∅');
    expect(silent.accessibilityLabel).toContain('silent/ng');
  });

  it('a batchim item carries a block diagram built from the example, final lit', () => {
    const item = buildDiscover([batchimPage]).pages[0]!.items[0]!;
    expect(item.glyph).toBe('ㄴ');
    expect(item.hear.spec.text).toBe('안');
    expect(item.letterName).toBeUndefined();
    expect(item.block).toEqual({ vowel: 'under', hasFinal: true, highlight: 'final', parts: ['ㅁ', 'ㅜ', 'ㄴ'] });
    expect(item.batchimLine).toBe(COPY.batchimLine);
    expect(item.accessibilityLabel).toBe('Korean final consonant n');
    const beside = buildDiscover([batchimPage]).pages[0]!.items[1]!;
    expect(beside.block).toEqual({ vowel: 'beside', hasFinal: true, highlight: 'final', parts: ['ㄷ', 'ㅏ', 'ㄹ'] });
  });

  it('a batchim whose example lacks the symbol still gets a generic block', () => {
    const item = buildDiscover([{ items: [{ type: 'jamo', jamoId: 'jamo:mieum-batchim', example: ko('나무', 'namu', 'tree') }] }]).pages[0]!.items[0]!;
    expect(item.block).toEqual({ vowel: 'beside', hasFinal: true, highlight: 'final', parts: ['ㅇ', 'ㅏ', 'ㅁ'] });
    expect(item.example?.blocks.some((b) => b.emphasised)).toBe(false);
  });

  it('a consonant or vowel has no block diagram', () => {
    expect(buildDiscover([pageOne]).pages[0]!.items[0]!.block).toBeUndefined();
    expect(buildDiscover([pageOne]).pages[0]!.items[0]!.batchimLine).toBeUndefined();
  });

  it('emphasises the syllable block of the example that holds the symbol', () => {
    const items = buildDiscover([{ items: [
      { type: 'jamo', jamoId: 'jamo:mieum', example: ko('나무', 'namu', 'tree') },
      { type: 'jamo', jamoId: 'jamo:ieung', example: ko('아이', 'ai', 'child') },
    ] }]).pages[0]!.items;
    expect(items[0]!.example?.blocks).toEqual([{ text: '나', emphasised: false }, { text: '무', emphasised: true }]);
    // initial ㅇ counts as the symbol in 아
    expect(items[1]!.example?.blocks).toEqual([{ text: '아', emphasised: true }, { text: '이', emphasised: false }]);
  });

  it('emphasises only the first matching block', () => {
    const item = buildDiscover([{ items: [{ type: 'jamo', jamoId: 'jamo:nieun', example: ko('나나', 'nana', 'two') }] }]).pages[0]!.items[0]!;
    expect(item.example?.blocks.map((b) => b.emphasised)).toEqual([true, false]);
  });

  it('carries the sound hint and the hint-bearing accessible name', () => {
    const item = buildDiscover([pageOne]).pages[0]!.items[0]!;
    expect(item.accessibilityLabel).toBe('Korean letter a');
    expect(item.soundHint).toBeUndefined();
  });

  it('builds a word item: romanization joined with a thin separator in the teaching UI only', () => {
    const [a, b] = buildDiscover([wordsPage]).pages[0]!.items;
    expect(a).toMatchObject({ kind: 'word', glyph: '아버지', romanization: 'a·beo·ji', gloss: 'father', picture: 'card:family-table' });
    expect(a!.spokenRomanization).toBe('abeoji');
    expect(a!.hear.spec).toEqual({ text: '아버지', audioRef: 'audio/words/abeoji.mp3' });
    expect(b).toMatchObject({ romanization: 'agi', note: 'Also a pet name' });
    expect(b!.hear.spec).toEqual({ text: '아기' });
    expect(a!.example).toBeUndefined();
    expect(a!.letterName).toBeUndefined();
    expect(a!.accessibilityLabel).toBe('아버지, abeoji, father');
  });

  it('skips an unresolvable item and drops a page that has nothing left', () => {
    const model = buildDiscover([
      { items: [{ type: 'jamo', jamoId: 'jamo:nope', example: ko('가', 'ga', 'ga') }] },
      { items: [{ type: 'jamo', jamoId: 'jamo:nope', example: ko('가', 'ga', 'ga') }, pageOne.items[0]!] },
    ]);
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0]!.items.map((i) => i.key)).toEqual(['jamo:a']);
  });

  it('titles a page: its caption, else "words you can read now" for an all-word page', () => {
    const model = buildDiscover([pageTwo, wordsPage, pageOne]);
    expect(model.pages.map((p) => p.title)).toEqual(['The sound ga', COPY.wordsTitle, undefined]);
  });

  it('keeps the same word twice apart with distinct keys', () => {
    const items = buildDiscover([{ items: [wordsPage.items[0]!] }, { items: [wordsPage.items[0]!] }]).pages.map((p) => p.items[0]!.key);
    expect(new Set(items).size).toBe(2);
  });
});

describe('stepDiscover: pages, hearing, reveal', () => {
  const model = buildDiscover([pageOne, pageTwo]);

  it('starts on page 1 with nothing heard', () => {
    const s = startDiscover(model);
    expect(s).toMatchObject({ page: 0, pageCount: 2, tapped: [], played: [], text: [], revealed: [] });
  });

  it('Next moves a page; on the last page it finishes with { pages, heard }', () => {
    const s0 = startDiscover(model);
    const a = stepDiscover(s0, { type: 'next' });
    expect(a.state.page).toBe(1);
    expect(a.effects).toEqual([]);
    const b = stepDiscover(a.state, { type: 'next' });
    expect(b.state.page).toBe(1);
    expect(b.effects).toEqual([{ type: 'done', pages: 2, heard: 0 }]);
  });

  it('Hear it asks to play, counts distinct taps once, and a played result adds the heard mark', () => {
    const id = model.pages[0]!.items[0]!.hear.id;
    const first = stepDiscover(startDiscover(model), { type: 'hear', id });
    expect(first.effects).toEqual([{ type: 'play', id }]);
    expect(first.state.tapped).toEqual([id]);
    const again = stepDiscover(first.state, { type: 'hear', id });
    expect(again.state.tapped).toEqual([id]); // distinct
    expect(again.effects).toEqual([{ type: 'play', id }]); // but it plays again
    const played = stepDiscover(again.state, { type: 'audio', id, result: 'played' });
    expect(played.state.played).toEqual([id]);
    expect(played.state.text).toEqual([]);
    const twice = stepDiscover(played.state, { type: 'audio', id, result: 'played' });
    expect(twice.state.played).toEqual([id]);
  });

  it('reports the distinct taps as heard on the last Continue', () => {
    const [a, b] = model.pages[0]!.items;
    const out = run(
      startDiscover(model),
      { type: 'hear', id: a!.hear.id },
      { type: 'hear', id: a!.hear.id },
      { type: 'hear', id: b!.hear.id },
      { type: 'next' },
      { type: 'next' },
    );
    expect(out.effects).toEqual([{ type: 'done', pages: 2, heard: 2 }]);
  });

  it('unavailable or muted audio switches that item to the "say it out loud" text, nothing else', () => {
    const item = model.pages[0]!.items[0]!;
    for (const result of ['unavailable', 'muted'] as const) {
      const out = run(startDiscover(model), { type: 'hear', id: item.hear.id }, { type: 'audio', id: item.hear.id, result });
      expect(out.state.text).toEqual([item.hear.id]);
      expect(out.state.played).toEqual([]);
      expect(out.state.page).toBe(0);
      const render = pageRender(model, out.state, 'always');
      expect(render.items[0]!.sayLines).toEqual([COPY.sayLine('a')]);
      expect(render.items[0]!.heard).toBe(false);
      expect(render.items[1]!.sayLines).toEqual([]);
    }
  });

  it('a later successful play clears the text line', () => {
    const id = model.pages[0]!.items[0]!.hear.id;
    const out = run(startDiscover(model), { type: 'audio', id, result: 'unavailable' }, { type: 'audio', id, result: 'played' });
    expect(out.state.text).toEqual([]);
    expect(out.state.played).toEqual([id]);
  });

  it('the text line says the spoken romanization of the syllable, not the tile value', () => {
    const pageG = buildDiscover([pageTwo]);
    const g = pageG.pages[0]!.items[0]!;
    const out = run(startDiscover(pageG), { type: 'audio', id: g.hear.id, result: 'unavailable' });
    expect(pageRender(pageG, out.state, 'always').items[0]!.sayLines).toEqual([COPY.sayLine('ga')]);
    const batchim = buildDiscover([batchimPage]);
    const k = batchim.pages[0]!.items[0]!;
    const out2 = run(startDiscover(batchim), { type: 'audio', id: k.hear.id, result: 'muted' });
    expect(pageRender(batchim, out2.state, 'always').items[0]!.sayLines).toEqual([COPY.sayLine('an')]);
  });

  it('the example word gets its own say-it line from its romanization', () => {
    const g = model.pages[1]!.items[0]!;
    const out = run(startDiscover(model), { type: 'next' }, { type: 'audio', id: g.example!.hear.id, result: 'unavailable' });
    expect(pageRender(model, out.state, 'always').items[0]!.sayLines).toEqual([COPY.sayLine('gagu')]);
  });

  it('a word item says its romanization', () => {
    const words = buildDiscover([wordsPage]);
    const a = words.pages[0]!.items[0]!;
    const out = run(startDiscover(words), { type: 'audio', id: a.hear.id, result: 'unavailable' });
    expect(pageRender(words, out.state, 'always').items[0]!.sayLines).toEqual([COPY.sayLine('abeoji')]);
  });

  it('shows the letter name after its button was tapped', () => {
    const g = model.pages[1]!.items[0]!;
    const out = run(startDiscover(model), { type: 'next' }, { type: 'hear', id: g.letterName!.action.id });
    expect(out.effects).toEqual([{ type: 'play', id: g.letterName!.action.id }]);
    const render = pageRender(model, out.state, 'always');
    expect(render.items[0]!.nameShown).toBe(true);
    expect(render.items[1]!.nameShown).toBe(false);
  });

  it('marks an item heard when any of its buttons played', () => {
    const g = model.pages[1]!.items[0]!;
    const out = run(startDiscover(model), { type: 'next' }, { type: 'audio', id: g.example!.hear.id, result: 'played' });
    const render = pageRender(model, out.state, 'always');
    expect(render.items.map((i) => i.heard)).toEqual([true, false]);
  });

  it('Continue is always enabled, on every page and with nothing heard', () => {
    let state = startDiscover(model);
    expect(pageRender(model, state, 'always').continueEnabled).toBe(true);
    state = stepDiscover(state, { type: 'next' }).state;
    expect(pageRender(model, state, 'always').continueEnabled).toBe(true);
  });

  it('page dots fill only and the last page says Continue', () => {
    const first = pageRender(model, startDiscover(model), 'always');
    expect(first.dots).toEqual({ value: 1, max: 2 });
    expect(first.isLast).toBe(false);
    const last = pageRender(model, stepDiscover(startDiscover(model), { type: 'next' }).state, 'always');
    expect(last.dots).toEqual({ value: 2, max: 2 });
    expect(last.isLast).toBe(true);
    expect(last.title).toBe('The sound ga');
  });

  it('the first item of a page pulses once', () => {
    expect(pageRender(model, startDiscover(model), 'always').items.map((i) => i.pulse)).toEqual([true, false]);
  });
});

describe('romanization mode "tap" (reading practice)', () => {
  const model = buildDiscover([pageTwo]);
  const state = startDiscover(model);

  it('always: everything shown, no reveal button', () => {
    const item = pageRender(model, state, 'always').items[0]!;
    expect(item.exampleRomanizationShown).toBe(true);
    expect(item.showReveal).toBe(false);
  });

  it('tap: hides only the example romanization behind "Show how to say it"', () => {
    const item = pageRender(model, state, 'tap').items[0]!;
    expect(item.exampleRomanizationShown).toBe(false);
    expect(item.showReveal).toBe(true);
    // the symbol's own romanization and the example gloss are never hidden
    expect(item.item.romanization).toBe('g/k');
    expect(item.item.example?.gloss).toBe('furniture');
  });

  it('a reveal tap shows it for that item only', () => {
    const out = stepDiscover(state, { type: 'reveal', key: 'jamo:giyeok' });
    expect(out.state.revealed).toEqual(['jamo:giyeok']);
    const render = pageRender(model, out.state, 'tap');
    expect(render.items[0]!.exampleRomanizationShown).toBe(true);
    expect(render.items[0]!.showReveal).toBe(false);
    expect(render.items[1]!.exampleRomanizationShown).toBe(false);
    // revealing twice stays one entry
    expect(stepDiscover(out.state, { type: 'reveal', key: 'jamo:giyeok' }).state.revealed).toEqual(['jamo:giyeok']);
  });

  it('word items have no example, so nothing to reveal and the word romanization stays', () => {
    const words = buildDiscover([wordsPage]);
    const item = pageRender(words, startDiscover(words), 'tap').items[0]!;
    expect(item.showReveal).toBe(false);
    expect(item.item.romanization).toBe('a·beo·ji');
  });
});

describe('an empty Discover step', () => {
  it('has no page, still lets the learner continue and reports heard 0', () => {
    const model = buildDiscover([]);
    const state = startDiscover(model);
    expect(model.pages).toEqual([]);
    expect(state.pageCount).toBe(0);
    const render = pageRender(model, state, 'always');
    expect(render).toMatchObject({ empty: true, continueEnabled: true, isLast: true, items: [] });
    expect(render.emptyLine).toBe(COPY.empty);
    expect(stepDiscover(state, { type: 'next' }).effects).toEqual([{ type: 'done', pages: 0, heard: 0 }]);
  });

  it('a step whose items are all unresolvable behaves the same', () => {
    const model = buildDiscover([{ items: [{ type: 'jamo', jamoId: 'jamo:nope', example: ko('가', 'ga', 'x') }] }]);
    expect(pageRender(model, startDiscover(model), 'always').empty).toBe(true);
  });
});

describe('copy comes from the message subtree it is given (F-I18N-001 §3.4 rule 3)', () => {
  const pseudo = pseudoLocalize(messages);

  it('buildDiscover words the titles and labels from the subtree and a11y messages', () => {
    const model = buildDiscoverWith([wordsPage, batchimPage], pseudo.learner.quest.discover, pseudo.a11y);
    expect(model.pages[0]!.title).toBe(pseudoText(COPY.wordsTitle));
    const item = model.pages[1]!.items[0]!;
    expect(item.batchimLine).toBe(pseudoText(COPY.batchimLine));
    expect(item.accessibilityLabel).toBe(pseudoText('Korean final consonant n'));
  });

  it('pageRender words the empty line and the say-it-out-loud line from the subtree', () => {
    const empty = buildDiscoverWith([], pseudo.learner.quest.discover, pseudo.a11y);
    expect(pageRenderWith(empty, startDiscover(empty), 'always', pseudo.learner.quest.discover).emptyLine).toBe(
      pseudoText(COPY.empty),
    );
  });
});
