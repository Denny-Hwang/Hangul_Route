import { LECTURE_MAX_BLOCKS, type LectureBlock, type UiLocale } from '@hangul-route/content-schema';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as LectureParts from '@/components/console/LectureParts';
import { LectureCatalogueSection, LectureOptionsSection, LectureOutlineSection, LectureSourceSection, blockText } from '@/components/console/LectureParts';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';
import type { PlanView } from '@/lib/console/api';
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
const l = getMessages('en').console.lecture;
/** The page splits "Revisit together: …" around the jamo (`aroundSlot`); join it back so the message reads as one text node. */
const joined = (html: string): string => html.split(`<span lang="ko">${jamo}</span>`).join(jamo);
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

  it('the catalogue (the grouped lesson picker), with one item added', () => {
    const html = renderToStaticMarkup(<LectureCatalogueSection blocks={[{ kind: 'quest', id: quest.id }]} onChange={noop} />);
    // It opens on the stage of what is chosen, with the chosen lesson ticked.
    expect(html).toContain(`data-testid="lecture-picker-lesson-${quest.id}" checked=""`);
    expect(html).toContain('data-testid="lecture-picker-group-stage1"');
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
    const catalogue = renderToStaticMarkup(<LectureCatalogueSection blocks={full} onChange={noop} />);
    // Every box that would add a block is off; the outline's full line says why.
    const boxes = catalogue.match(/<input type="checkbox"[^>]*>/g) ?? [];
    expect(boxes.length).toBeGreaterThan(5);
    for (const box of boxes) expect(box).toContain('disabled');
    expect(catalogue).toContain(getMessages(PSEUDO).console.lecture.outline.full(LECTURE_MAX_BLOCKS));
  });

  it('the empty outline', () => {
    expectAllPseudo(renderToStaticMarkup(<LectureOutlineSection blocks={[]} codeBlock={null} onChange={noop} onAdd={noop} />));
  });

  it('options, with the presenter language when more than one locale has shipped', () => {
    const html = renderToStaticMarkup(<LectureOptionsSection value={{ romanization: 'tap', strokeGuide: true, sound: false, uiLocale: 'en' }} available={['en', 'es', 'ko']} onChange={noop} />);
    expect(html).toContain('<legend');
    expectAllPseudo(html, (['en', 'es', 'ko'] as const).map((k) => LOCALE_META[k].endonym));
  });

  it('has no helper picker section (LV-H)', () => {
    expect(Object.keys(LectureParts)).not.toContain('LecturePickerSection');
  });
});

describe('row words', () => {
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
