import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { borderWidth, presenter, realiaPaper, spacing } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { questsAll } from '../../../content';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { MARKER_BODY_FACTOR } from '../../../logic/lecture/stage-constants';
import { byTestId, render } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { pictureCrowded, QuizOptions } from '../slides/QuizParts';
import { RealiaQuestionSlide, isRealiaQuestion, type RealiaQuestionBody } from '../slides/RealiaQuestionSlide';
import { RealiaSheetStage } from '../slides/RealiaSheetStage';
import { WriteTogetherSlide, type WriteTogetherBody } from '../slides/WriteTogetherSlide';

/**
 * The presenter's fit levels that only the Linux-font Playwright runs met before (design/screens/presenter/slide-quiz.md
 * "Notes", slide-realia.md "Fit", slide-write-together.md "The sound table on a phone"): the crowded picture grid
 * (`pictureCrowded`, in the shared quiz options), the realia question's tight sheet (same widths, less height) and its
 * question at body size beside a crowded grid, and the name round's level 2 (the table's rows on one shared outline, the
 * slide's gaps at `spacing.xs`). Drawn at one stage unit, so a length in units is a length in pixels.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The letter slide's animated stroke guide needs Reanimated's animated SVG, which the render setup stills; no slide here draws it.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');
const QUESTION: ReadonlySet<BuildName> = new Set(['question']);

function slidesOf(blocks: LectureBlock[]): Slide[] {
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:fit001', title: 'Fit', createdAt: '2026-10-20T09:00:00Z', seed: 3, blocks });
  return expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides;
}

/** Every realia question of the shipped Stage 6 lessons: menus, tickets, signs and price cards, with word, figure and picture options. */
const REALIA_ALL = slidesOf(questsAll.filter((q) => q.id.startsWith('quest:stage6-')).map((q): LectureBlock => ({ kind: 'quest', id: q.id }))).filter(
  (s): s is RealiaQuestionBody => isRealiaQuestion(s),
);
const ownName = slidesOf([{ kind: 'quest', id: 'quest:stage7-letters-q3' }]).find((s): s is WriteTogetherBody => s.kind === 'write-together' && s.variant === 'own-name')!;

type Node = ReactTestInstance;
const flat = (s: unknown): Record<string, unknown> => (Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : ((s ?? {}) as Record<string, unknown>));
const styleOf = (node: Node): Record<string, unknown> => flat(node.props.style);
/** The composite component carrying `testID` (its props as the slide wrote them, before react-native-web turns them into DOM). */
const composite = (root: Node, id: string): Node => root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id)[0]!;
/** The composite Views under `root` whose own style matches. */
const views = (root: Node, match: (style: Record<string, unknown>) => boolean): Node[] =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.style !== undefined && match(styleOf(n)));
const named = (root: Node, name: string): Node[] => root.findAll((n) => typeof n.type === 'function' && n.type.name === name);

/** A tree at one stage unit with its own node mock: the stage speaker listens on its node, and a `contentRef` reads `offsetHeight`. */
async function mount(element: React.ReactElement, heights: Record<string, number> = {}): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}>{element}</PresenterViewProvider>, {
      createNodeMock: (el) => {
        const id = (el.props as { 'data-testid'?: string })['data-testid'];
        return { addEventListener: () => undefined, removeEventListener: () => undefined, offsetHeight: id !== undefined ? (heights[id] ?? 0) : 0 };
      },
    });
  });
  return r;
}

/** Fires the layout of the composite with `testID`, as react-native-web reports a box's height. */
async function layout(r: ReactTestRenderer, id: string, height: number): Promise<void> {
  await act(async () => {
    (composite(r.root, id).props.onLayout as (e: { nativeEvent: { layout: { width: number; height: number; x: number; y: number } } }) => void)({
      nativeEvent: { layout: { width: 1000, height, x: 0, y: 0 } },
    });
  });
}

const fitOf = (r: ReactTestRenderer, id: string): string => (composite(r.root, id).props.dataSet as { fit: string }).fit;

beforeEach(() => {
  // The fit hook re-measures after a settle timer; fake timers keep that inside each test.
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('pictureCrowded: a picture card never draws below its marker (QuizOptions)', () => {
  // One stage unit: the 80-unit marker, the card's spacing.md padding and its border on each side.
  const card = { marker: MARKER_BODY_FACTOR * presenter.size.body, padV: spacing.md, line: borderWidth.thick };
  const room = card.marker + 2 * (card.padV + card.line);

  it('a row shorter than its marker and the card padding is crowded', () => {
    expect(pictureCrowded({ picture: true, rowHeight: room - 2, ...card })).toBe(true);
    expect(pictureCrowded({ picture: true, rowHeight: 40, ...card })).toBe(true);
  });

  it('a row that holds the marker and the padding is not, with a pixel of rounding allowed', () => {
    expect(pictureCrowded({ picture: true, rowHeight: room, ...card })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: room - 1, ...card })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: room + 100, ...card })).toBe(false);
  });

  it('a row height not measured yet (Infinity before the grid lays out, or NaN) is not crowded', () => {
    expect(pictureCrowded({ picture: true, rowHeight: Infinity, ...card })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: Number.NaN, ...card })).toBe(false);
  });

  it('a card with no picture is never crowded by its marker (a gloss has its own check)', () => {
    expect(pictureCrowded({ picture: false, rowHeight: 10, ...card })).toBe(false);
  });
});

describe('RealiaSheetStage tight: the same lines at the same width, less room around them (slide-realia.md "Fit")', () => {
  const menu = REALIA_ALL.find((s) => s.prompt.sheet.kind === 'menu')!;
  const sheetsByKind = [...new Map(REALIA_ALL.map((s) => [s.prompt.sheet.kind, s.prompt.sheet] as const)).values()];

  it('the shipped Stage 6 realia questions carry a menu and more than one kind of sheet', () => {
    expect(menu).toBeDefined();
    expect(sheetsByKind.length).toBeGreaterThan(1);
  });

  it('a menu: the dressing strip at spacing.sm, not spacing.xl', async () => {
    const loose = await render(<PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}><RealiaSheetStage sheet={menu.prompt.sheet} rom width={480} /></PresenterViewProvider>);
    const tight = await render(<PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}><RealiaSheetStage sheet={menu.prompt.sheet} rom width={480} tight /></PresenterViewProvider>);
    expect(named(loose.root, 'Dressing').map((n) => n.props.height)).toEqual([spacing.xl]);
    expect(named(tight.root, 'Dressing').map((n) => n.props.height)).toEqual([spacing.sm]);
  });

  it("a menu: the paper's top and bottom padding at spacing.xxs, and no gap between lines", async () => {
    const paper = realiaPaper('menu');
    const draw = (tight: boolean) =>
      render(<PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}><RealiaSheetStage sheet={menu.prompt.sheet} rom width={480} answer={{ entryId: menu.prompt.answerEntryId, shown: false }} tight={tight} /></PresenterViewProvider>);
    const onPaper = (r: ReactTestRenderer) => views(r.root, (s) => s.backgroundColor === paper.backgroundColor && s.paddingVertical !== undefined);
    const lines = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'list');
    const loose = await draw(false);
    const tight = await draw(true);
    expect(onPaper(loose).map((n) => [styleOf(n).paddingVertical, styleOf(n).gap])).toEqual([[spacing.md, spacing.xs]]);
    expect(onPaper(tight).map((n) => [styleOf(n).paddingVertical, styleOf(n).gap])).toEqual([[spacing.xxs, 0]]);
    expect(lines(loose).map((n) => styleOf(n).gap)).toEqual([spacing.xs]);
    expect(lines(tight).map((n) => styleOf(n).gap)).toEqual([0]);
  });

  it('every kind keeps its width and its horizontal padding, so no line wraps anew', async () => {
    for (const sheet of sheetsByKind) {
      const widths = async (tight: boolean): Promise<unknown[]> => {
        const r = await render(<PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}><RealiaSheetStage sheet={sheet} rom width={512} tight={tight} /></PresenterViewProvider>);
        const root = composite(r.root, 'presenter-realia-sheet');
        return [styleOf(root).width, ...views(root, () => true).map((n) => [styleOf(n).width, styleOf(n).paddingHorizontal, styleOf(n).minWidth])];
      };
      expect(await widths(true), sheet.kind).toEqual(await widths(false));
    }
  });
});

describe('RealiaQuestionSlide: the sheet fits on its own, and a crowded picture grid draws the question at body size', () => {
  it('a sheet taller than the room steps its own fit to 1 and draws tight; the slide itself stays at level 0', async () => {
    const slide = REALIA_ALL.find((s) => s.prompt.sheet.kind === 'menu')!;
    const r = await mount(<RealiaQuestionSlide slide={slide} shown={QUESTION} romanization="always" />, { 'presenter-realia-question-sheet': 560 });
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('0');
    expect(r.root.findByType(RealiaSheetStage).props.tight).toBe(false);
    await layout(r, 'presenter-realia-question', 504);
    await layout(r, 'presenter-realia-question-sheet', 560);
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('1');
    expect(fitOf(r, 'presenter-realia-question-content')).toBe('0');
    const sheet = r.root.findByType(RealiaSheetStage);
    expect(sheet.props.tight).toBe(true);
    expect(named(sheet, 'Dressing').map((n) => n.props.height)).toEqual([spacing.sm]);
    // One level only: a sheet still too tall after the settle stays tight, it never steps further.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('1');
    await act(async () => r.unmount());
  });

  it('a sheet that fits its room stays loose', async () => {
    const slide = REALIA_ALL.find((s) => s.prompt.sheet.kind === 'menu')!;
    const r = await mount(<RealiaQuestionSlide slide={slide} shown={QUESTION} romanization="always" />);
    await layout(r, 'presenter-realia-question', 504);
    await layout(r, 'presenter-realia-question-sheet', 400);
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('0');
    expect(r.root.findByType(RealiaSheetStage).props.tight).toBe(false);
    await act(async () => r.unmount());
  });

  it('a picture grid whose rows come out shorter than their markers draws the question at presenter.size.body', async () => {
    const pictures = REALIA_ALL.filter((s) => s.options.some((o) => o.picture !== undefined));
    let grid: ReactTestRenderer | undefined;
    for (const slide of pictures) {
      const r = await mount(<RealiaQuestionSlide slide={slide} shown={QUESTION} romanization="always" />);
      if (r.root.findAllByType(QuizOptions).length > 0) {
        grid = r;
        break;
      }
      await act(async () => r.unmount());
    }
    expect(grid, 'a Stage 6 realia question draws its pictures in the 2 x 2 grid').toBeDefined();
    const question = (): unknown => styleOf(composite(grid!.root, 'presenter-quiz-question')).fontSize;
    expect(question()).toBe(presenter.size.prompt);
    // Rows that hold their markers keep the question at prompt size.
    await layout(grid!, 'presenter-quiz-options', 400);
    expect(question()).toBe(presenter.size.prompt);
    // A key row that wraps above the grid leaves two rows of 70 units, shorter than an 80-unit marker.
    await layout(grid!, 'presenter-quiz-options', 70 * 2 + spacing.xl);
    expect(question()).toBe(presenter.size.body);
    expect(fitOf(grid!, 'presenter-realia-question-content')).toBe('0');
    await act(async () => grid!.unmount());
  });
});

describe('WriteTogetherSlide level 2: the sound table on one shared outline, the slide gaps at spacing.xs (slide-write-together.md)', () => {
  async function at(level: 0 | 2): Promise<ReactTestRenderer> {
    const r = await mount(<WriteTogetherSlide slide={ownName} reveal={1} romanization="always" />, { 'presenter-write-content': 400 });
    await layout(r, 'presenter-write-room', 300);
    for (let i = 0; i < level; i += 1) await layout(r, 'presenter-write-content', 400);
    expect(fitOf(r, 'presenter-write-content')).toBe(String(level));
    return r;
  }

  it('the table rows share one outline: no row gap, and each row over the one above by its border', async () => {
    const r = await at(2);
    const table = composite(r.root, 'presenter-write-table');
    expect(styleOf(table).gap).toBe(0);
    const rows = table.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-write-table-row');
    expect(rows.length).toBeGreaterThan(1);
    const border = styleOf(rows[0]!.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-write-cell')[0]!).borderWidth as number;
    expect(border).toBeGreaterThan(0);
    expect(rows.map((row) => styleOf(row).marginTop)).toEqual(rows.map((_, g) => (g === 0 ? 0 : -border)));
    await act(async () => r.unmount());
  });

  it("the slide's gaps are spacing.xs at level 2, spacing.md at level 0 where the rows stand apart", async () => {
    const tight = await at(2);
    expect(styleOf(composite(tight.root, 'presenter-write')).gap).toBe(spacing.xs);
    expect(styleOf(composite(tight.root, 'presenter-write-content')).gap).toBe(spacing.xs);
    await act(async () => tight.unmount());
    const loose = await at(0);
    expect(styleOf(composite(loose.root, 'presenter-write')).gap).toBe(spacing.md);
    expect(styleOf(composite(loose.root, 'presenter-write-content')).gap).toBe(spacing.md);
    const table = composite(loose.root, 'presenter-write-table');
    expect(styleOf(table).gap).toBe(spacing.xs);
    expect(new Set(table.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-write-table-row').map((row) => styleOf(row).marginTop))).toEqual(new Set([0]));
    await act(async () => loose.unmount());
  });
});
