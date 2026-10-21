import { LECTURE_MAX_BLOCKS, type LectureBlock, type UiLocale } from '@hangul-route/content-schema';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as LectureParts from '@/components/console/LectureParts';
import { LectureChooserSection, LectureOptionsSection, LectureOutlineSection, LectureSourceSection, blockText } from '@/components/console/LectureParts';
import { LectureCustomize, LectureFooter, LecturePresetsLoading, LecturePresetsSection } from '@/components/console/LecturePresetParts';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';
import type { PlanView } from '@/lib/console/api';
import { presetCardWords } from '@/lib/console/lecture-presets';
import { aroundSlot } from '@/lib/i18n/slot';
import { expectAllPseudo } from './pseudo-text';
import { STAGE1_EPISODES, STAGE1_TITLES, questsOfCell } from './stage1-catalog';

/**
 * F-TCH-004 §3.11 with F-I18N-001 §3.11: the loaded states of the lecture setup page's
 * sections take every word from `console.lecture` (the page test reaches first paint only,
 * because effects do not run in a server render). Content titles, the plan title, taught
 * jamo and locale endonyms are data.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const episode = STAGE1_EPISODES[0]!;
const quest = questsOfCell(episode)[0]!;
const contentTitles = [
  ...STAGE1_TITLES,
  ...LECTURE_STORIES.map((s) => s.titleEn),
  ...LECTURE_VOCAB_TOPICS.map((t) => t.titleEn),
];
const plan: PlanView = {
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [{ kind: 'quest', id: quest.id }],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
};
const jamo = 'ㄱ ㅓ ㅎ';
const revisit: LectureBlock = { kind: 'revisit', chars: ['ㄱ', 'ㅓ', 'ㅎ'] };
const noop = (): void => undefined;
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const l = getMessages('en').console.lecture;
/** The page splits "Revisit together: …" around the jamo (`aroundSlot`); join it back so the message reads as one text node. */
const joined = (html: string): string => html.split(`<span lang="ko">${jamo}</span>`).join(jamo);
/** The chosen Slides language hint is split around the endonym (`aroundSlot`); join it back the same way. */
const joinedHint = (html: string, locale: UiLocale): string => html.split(`<span lang="${LOCALE_META[locale].htmlLang}">${LOCALE_META[locale].endonym}</span>`).join(LOCALE_META[locale].endonym);
/** A row's words inside its buttons' names ("Move up: <row>") are data there (the row's own message). */
const rowWords = (blocks: readonly LectureBlock[]): string[] => blocks.map((b) => blockText(b, getMessages(PSEUDO).console.lecture));

const everyKind: LectureBlock[] = [
  { kind: 'quiz', from: 'previous', rounds: 5 },
  { kind: 'episode', id: episode.episodeId },
  { kind: 'quest', id: quest.id },
  revisit,
  { kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:a'] },
  { kind: 'cards', cardIds: ['card:hanbok'] },
  { kind: 'vocab', topicId: 'vocab-topic:food' },
  { kind: 'activity', preset: 'air-write', minutes: 3 },
  { kind: 'class-code', code: 'ABC234' },
];

describe('lecture setup sections render only dictionary text (en-XA)', () => {
  it('source: this plan, the catalogue, revisit together, the cap note and the plans that did not load', () => {
    const html = renderToStaticMarkup(<LectureSourceSection source="plan" plan={plan} revisit={revisit} plansFailed omitted={4} onChoose={noop} onRetry={noop} />);
    expect(html).toContain('<fieldset');
    expect(html).toContain('<legend');
    expect(html).toContain(`<span lang="ko">${jamo}</span>`);
    expectAllPseudo(joined(html), ['Week three', jamo]);
  });

  it('source with nothing to offer', () => {
    const html = renderToStaticMarkup(<LectureSourceSection source="catalogue" plan={null} revisit={null} plansFailed={false} omitted={0} onChoose={noop} onRetry={noop} />);
    expectAllPseudo(html);
  });

  it('what to add (the grouped chooser as tabs), with one item added', () => {
    const html = renderToStaticMarkup(<LectureChooserSection blocks={[{ kind: 'quest', id: quest.id }]} onChange={noop} />);
    // It opens on the tab and stage of what is chosen, with the chosen lesson ticked.
    expect(html).toContain(`data-testid="lecture-picker-lesson-${quest.id}" checked=""`);
    expect(html).toContain('data-testid="lecture-picker-group-stage1"');
    expect(html).toContain('role="tablist"');
    expectAllPseudo(html, contentTitles);
  });

  it('the outline: every block kind, a quiz with too small a scope, row buttons named after their row', () => {
    const html = renderToStaticMarkup(<LectureOutlineSection blocks={everyKind} codeBlock={{ kind: 'class-code', code: 'ABC234' }} onChange={noop} onAdd={noop} />);
    expect(html.match(/data-testid="quiz-too-small"/g)).toHaveLength(1);
    expect(html).toContain(`<span lang="ko">${jamo}</span>`);
    expect(html).not.toMatch(/>[↑↓]</);
    // The English row names, in the en-XA wrapper, are distinct per row.
    const removeNames = [...html.matchAll(/aria-label="([^"]*)"[^>]*>[^<]*<\/button>/g)].map((m) => m[1]);
    expect(new Set(removeNames).size).toBe(removeNames.length);
    expectAllPseudo(joined(html), [...rowWords(everyKind), ...contentTitles, jamo, 'ABC234']);
  });

  it('the full outline turns every add button off and says why', () => {
    const full: LectureBlock[] = Array.from({ length: LECTURE_MAX_BLOCKS }, () => ({ kind: 'activity', preset: 'stretch-break', minutes: 2 }));
    const html = renderToStaticMarkup(<LectureOutlineSection blocks={full} codeBlock={{ kind: 'class-code', code: 'ABC234' }} onChange={noop} onAdd={noop} />);
    const addRow = html.slice(html.lastIndexOf('<div style="display:flex;gap'));
    expect(addRow.match(/<button[^>]*disabled/g)).toHaveLength(3);
    expectAllPseudo(html, rowWords(full));
    const catalogue = renderToStaticMarkup(<LectureChooserSection blocks={full} onChange={noop} />);
    // Every box that would add a block is off; the outline's full line says why.
    const boxes = catalogue.match(/<input type="checkbox"[^>]*>/g) ?? [];
    expect(boxes.length).toBeGreaterThan(5);
    for (const box of boxes) expect(box).toContain('disabled');
    expect(catalogue).toContain(getMessages(PSEUDO).console.lecture.outline.full(LECTURE_MAX_BLOCKS));
  });

  it('the empty outline', () => {
    expectAllPseudo(renderToStaticMarkup(<LectureOutlineSection blocks={[]} codeBlock={null} onChange={noop} onAdd={noop} />));
  });

  it('the outline on a family space: the family code row and + Family code (AMENDMENTS-LECTURE-V2 section 6)', () => {
    const p = getMessages(PSEUDO).console.lecture.outline;
    const code: LectureBlock = { kind: 'class-code', code: 'ABC234' };
    const family = renderToStaticMarkup(<LectureOutlineSection blocks={[code]} codeBlock={code} family onChange={noop} onAdd={noop} />);
    expect(family).toContain(p.block.familyCode);
    expect(family).toContain(p.addFamilyCode.cta);
    expect(family).not.toContain(p.block.classCode);
    expect(family).not.toContain(p.addClassCode.cta);
    expectAllPseudo(family, [blockText(code, getMessages(PSEUDO).console.lecture, PSEUDO, true), 'ABC234']);
    const klass = renderToStaticMarkup(<LectureOutlineSection blocks={[code]} codeBlock={code} onChange={noop} onAdd={noop} />);
    expect(klass).toContain(p.addClassCode.cta);
    expect(klass).not.toContain(p.addFamilyCode.cta);
  });

  it('the ready-made lessons, one card open with its chips and what it holds', () => {
    const outline: LectureBlock[] = [{ kind: 'episode', id: episode.episodeId }, { kind: 'quiz', from: 'previous', rounds: 4 }, revisit];
    const html = renderToStaticMarkup(
      <LecturePresetsSection
        order={['next-lesson', 'hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up']}
        open="by-stage"
        minutesOf={() => 20}
        stage="stage2"
        stages={['stage1', 'stage2', 'stage3']}
        fallbackOf={() => null}
        note={null}
        planTitle="Week three"
        family={false}
        outline={outline}
        outlineMinutes={null}
        onToggle={noop}
        onMinutes={noop}
        onStage={noop}
      />,
    );
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(5);
    expect(html).toContain('aria-controls="lecture-preset-panel-by-stage"');
    expect(html).not.toContain('aria-pressed');
    // Each card's button is described by its line (its accessible name is "{title}, about {n} minutes").
    expect(html).toContain('aria-describedby="lecture-preset-line-word-review"');
    expect(html).toContain('id="lecture-preset-line-word-review"');
    expectAllPseudo(joined(html), ['Week three', episode.title, jamo, ...rowWords(outline)]);
  });

  it('the open card is named by what it holds once that is not its own outline; the closed cards keep their length', () => {
    const m = getMessages(PSEUDO);
    const html = renderToStaticMarkup(
      <LecturePresetsSection
        order={['hangul-week-1', 'by-stage', 'warm-up', 'next-lesson']}
        open="next-lesson"
        minutesOf={() => 20}
        stage="stage1"
        stages={['stage1']}
        fallbackOf={() => null}
        note={null}
        planTitle="Week three"
        family={false}
        outline={[revisit]}
        outlineMinutes={7}
        onToggle={noop}
        onMinutes={noop}
        onStage={noop}
      />,
    );
    const label = (preset: 'next-lesson' | 'by-stage'): string | undefined => new RegExp(`aria-label="([^"]*)"[^>]*data-testid="lecture-preset-${preset}"`).exec(html)?.[1];
    const html$ = (text: string): string => renderToStaticMarkup(<i title={text} />).slice('<i title="'.length, -'"></i>'.length);
    const p = m.console.lecture.presets;
    expect(label('next-lesson')).toBe(html$(m.a11y.presenter.presetCard(presetCardWords('next-lesson', p, { planTitle: 'Week three', family: false }).title, 7)));
    expect(label('by-stage')).toBe(html$(m.a11y.presenter.presetCard(presetCardWords('by-stage', p, { planTitle: 'Week three', family: false }).title, 20)));
  });

  it('a card that cannot build what it names says so in its line, open or closed; the open card holds the note (section 4.1)', () => {
    const w = getMessages(PSEUDO).console.lecture;
    const fallbacks: Partial<Record<string, string>> = { 'next-lesson': w.presets.fallback.zero, 'word-review': w.presets.fallback.warmUp };
    const html = renderToStaticMarkup(
      <LecturePresetsSection
        order={['hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up', 'next-lesson']}
        open="next-lesson"
        minutesOf={() => 20}
        stage="stage1"
        stages={['stage1']}
        fallbackOf={(preset) => fallbacks[preset] ?? null}
        note={w.source.trimmed(2, LECTURE_MAX_BLOCKS)}
        planTitle={null}
        family={false}
        outline={[revisit]}
        outlineMinutes={null}
        onToggle={noop}
        onMinutes={noop}
        onStage={noop}
      />,
    );
    // Closed Word review and open Next lesson both read their fallback line in place of their usual line.
    expect(html).toMatch(/data-testid="lecture-preset-fallback-word-review"[^>]*>[^<]*/);
    expect(html).toContain(w.presets.fallback.warmUp);
    expect(html).toContain(w.presets.fallback.zero);
    expect(html).not.toContain(w.presets.words.body);
    expect(html).not.toContain(w.presets.next.class);
    expect(html.match(new RegExp(escape(w.presets.fallback.zero), 'g'))).toHaveLength(1);
    // The others keep their lines.
    expect(html).toContain(w.presets.zero.body);
    expect(html).toContain('data-testid="lecture-preset-line-hangul-week-1"');
    expect(html).toContain('data-testid="lecture-preset-note"');
    expect(html).toContain(w.source.trimmed(2, LECTURE_MAX_BLOCKS));
    expectAllPseudo(joined(html), [jamo, ...rowWords([revisit])]);
  });

  it('the footer: the answer to a press and the title problem in two live lines that are always there', () => {
    const w = getMessages(PSEUDO).console.lecture;
    const quiet = renderToStaticMarkup(<LectureFooter minutes={19} status="" alert="" canPresent copied={false} onPresent={noop} onCopy={noop} />);
    expect(quiet).toContain('<p class="hr-lp-foot-note" role="status" data-sticky-extra="" data-testid="lecture-footer-status"></p>');
    expect(quiet).toContain('<p class="hr-lp-foot-note" role="alert" data-sticky-extra="" data-testid="lecture-footer-alert"></p>');
    expect(quiet).toContain('data-stuck="true"');
    expectAllPseudo(quiet, [], 3);
    const loud = renderToStaticMarkup(<LectureFooter minutes={19} status={w.popupBlocked} alert={w.titleProblem.name} canPresent={false} copied onPresent={noop} onCopy={noop} />);
    expect(loud).toContain(w.popupBlocked);
    expect(loud).toContain(w.titleProblem.name);
    expect(loud).toContain(w.copied.cta);
    expect(loud.match(/disabled=""/g)).toHaveLength(2);
    expectAllPseudo(loud, [], 5);
  });

  it('the cards while loading, and Customize closed and open', () => {
    // The heading, the lead and the loading line.
    expectAllPseudo(renderToStaticMarkup(<LecturePresetsLoading loadingLine={getMessages(PSEUDO).console.space.loading} />), [], 3);
    const closed = renderToStaticMarkup(
      <LectureCustomize open={false} onToggle={noop}>
        <p>inside</p>
      </LectureCustomize>,
    );
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('inside');
    // Customize and its lead.
    expectAllPseudo(closed, [], 2);
    const open = renderToStaticMarkup(
      <LectureCustomize open onToggle={noop}>
        <p>inside</p>
      </LectureCustomize>,
    );
    expect(open).toContain('aria-expanded="true"');
    expectAllPseudo(open, ['inside'], 2);
  });

  it('options, with the presenter language when more than one locale has shipped', () => {
    const html = renderToStaticMarkup(<LectureOptionsSection value={{ romanization: 'tap', strokeGuide: true, sound: false, uiLocale: 'en' }} available={['en', 'es', 'ko']} onChange={noop} />);
    expect(html).toContain('<legend');
    expectAllPseudo(joinedHint(html, 'en'), (['en', 'es', 'ko'] as const).map((k) => LOCALE_META[k].endonym));
  });

  it('options, with Same as this device: the copied-link hint', () => {
    const html = renderToStaticMarkup(<LectureOptionsSection value={{ romanization: 'always', strokeGuide: false, sound: true, uiLocale: null }} available={['en', 'es', 'ko']} onChange={noop} />);
    expectAllPseudo(html, (['en', 'es', 'ko'] as const).map((k) => LOCALE_META[k].endonym));
  });

  it('has no helper picker section and no Catalogue section (LV-D7, section 18.3)', () => {
    expect(Object.keys(LectureParts)).not.toContain('LecturePickerSection');
    expect(Object.keys(LectureParts)).not.toContain('LectureCatalogueSection');
  });
});

describe('the Slides language hint follows the choice (AMENDMENTS-LECTURE-V2 section 18.4)', () => {
  // Read inside each test: the en-XA dictionary is on only once `beforeAll` has stubbed the flag.
  const pseudo = () => {
    const o = getMessages(PSEUDO).console.lecture.options;
    return { o, chosen: aroundSlot(o.languageHintChosen) };
  };
  const render = (uiLocale: UiLocale | null): string =>
    renderToStaticMarkup(<LectureOptionsSection value={{ romanization: 'tap', strokeGuide: true, sound: false, uiLocale }} available={['en', 'es', 'ko']} onChange={noop} />);
  const hintOf = (html: string): string => /<span data-testid="lecture-slides-language-hint">([\s\S]*?)<\/span><\/p>/.exec(html)?.[1] ?? '';

  it('Same as this device (no language in the deck): a copied link uses the language of the device that opens it', () => {
    const { o, chosen } = pseudo();
    const hint = hintOf(render(null));
    expect(hint).toMatch(/^\[/);
    expect(hint).toBe(o.languageHint);
    expect(hint).not.toContain(chosen.before);
  });

  it.each(['en', 'es', 'ko'] as const)('%s chosen: the slides show in that language on every device, the endonym marked with its language', (locale) => {
    const { o, chosen } = pseudo();
    const meta = LOCALE_META[locale];
    const hint = hintOf(render(locale));
    expect(hint).toBe(`${chosen.before}<span lang="${meta.htmlLang}">${meta.endonym}</span>${chosen.after}`);
    expect(hint).not.toContain(o.languageHint);
  });

  it('no hint when only one locale has shipped (no select to describe)', () => {
    const html = renderToStaticMarkup(<LectureOptionsSection value={{ romanization: 'tap', strokeGuide: true, sound: false, uiLocale: null }} available={['en']} onChange={noop} />);
    expect(html).not.toContain('lecture-slides-language-hint');
  });

  it('reads as one English sentence in every case', () => {
    const en = getMessages('en').console.lecture.options;
    expect(en.languageHint).toBe('A copied link uses the language of the device that opens it.');
    expect(en.languageHintChosen('한국어')).toBe('Slides show in 한국어 on every device, a copied link too.');
  });
});

describe('row words', () => {
  it('names a Word review by its card cap and the join code by the space kind', () => {
    expect(blockText({ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 5 }, l)).toBe('10 words');
    expect(blockText({ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 10 }, l)).toBe('20 words');
    expect(blockText({ kind: 'class-code', code: 'ABC234' }, l, 'en', true)).toBe('Family code on the last slide');
  });

  it('names every block kind in English', () => {
    expect(everyKind.map((b) => blockText(b, l))).toEqual([
      'Quick quiz: 5 questions',
      episode.title,
      quest.title,
      `Revisit together: ${jamo}`,
      '2 letters',
      '1 heritage card',
      'Food',
      'Write it in the air',
      'Class code on the last slide',
    ]);
  });
});
