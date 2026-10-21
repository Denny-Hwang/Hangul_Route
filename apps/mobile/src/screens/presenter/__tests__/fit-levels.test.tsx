import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { REALIA_DRESSINGS, presenter, spacing } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { questsAll } from '../../../content';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { MARKER_BODY_FACTOR } from '../../../logic/lecture/stage-constants';
import { cleanup, render, unmount } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP_INNER } from '../stage-metrics';
import { pictureCrowded, QuizOptions } from '../slides/QuizParts';
import { QuizSlide } from '../slides/QuizSlide';
import { RealiaQuestionSlide, isRealiaQuestion, type RealiaQuestionBody } from '../slides/RealiaQuestionSlide';
import { RealiaSheetStage } from '../slides/RealiaSheetStage';
import { WriteTogetherSlide, type WriteTogetherBody } from '../slides/WriteTogetherSlide';

/**
 * The presenter's fit levels that only the Linux-font Playwright runs met before (design/screens/presenter/slide-quiz.md
 * "Notes", slide-realia.md "Fit", slide-write-together.md "The sound table on a phone"): the crowded picture grid
 * (`pictureCrowded`, in the shared quiz options) and what the quiz and realia question slides do with it, the realia
 * question's tight sheet (same widths, less height, for every sheet kind), and the name round's levels 1 and 2 (at 2 the
 * table's rows on one shared outline, the slide's gaps at `spacing.xs`). Drawn at one stage unit, so a length in units is
 * a length in pixels.
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

/** One stage unit: the picture card's marker, its `spacing.md` padding and its border, as OptionCard works them out. */
const CARD = { marker: MARKER_BODY_FACTOR * presenter.size.body, padV: spacing.md, line: Math.max(STAGE_BORDER_MIN, STAGE_BORDER) };
/** The shortest row a picture card fits in: its marker, with the padding and the border above and below it. */
const ROOM = CARD.marker + 2 * (CARD.padV + CARD.line);

type Node = ReactTestInstance;
const flat = (s: unknown): Record<string, unknown> => (Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : ((s ?? {}) as Record<string, unknown>));
const styleOf = (node: Node): Record<string, unknown> => flat(node.props.style);
/** The composite component carrying `testID` (its props as the slide wrote them, before react-native-web turns them into DOM). */
function composite(root: Node, id: string): Node {
  const node = root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id)[0];
  if (node === undefined) throw new Error(`no composite with testID ${id}`);
  return node;
}
/** The composite Views under `root` whose own style matches, in tree order. */
const views = (root: Node, match: (style: Record<string, unknown>) => boolean): Node[] =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.style !== undefined && match(styleOf(n)));
const named = (root: Node, name: string): Node[] => root.findAll((n) => typeof n.type === 'function' && n.type.name === name);

const atOneUnit = (element: React.ReactElement): React.ReactElement => (
  <PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}>{element}</PresenterViewProvider>
);

/**
 * A tree at one stage unit with its own node mock (the stage speaker listens on its node, and a `contentRef` reads
 * `offsetHeight`), mounted through the shared helper so the render setup's cleanup unmounts it if a test fails first.
 */
function mount(element: React.ReactElement, heights: Record<string, number> = {}): Promise<ReactTestRenderer> {
  return render(atOneUnit(element), {
    createNodeMock: (el) => {
      const id = (el.props as { 'data-testid'?: string })['data-testid'];
      return { addEventListener: () => undefined, removeEventListener: () => undefined, offsetHeight: id !== undefined ? (heights[id] ?? 0) : 0 };
    },
  });
}

/** Fires the layout of the composite with `testID`, as react-native-web reports a box's height. */
async function layout(r: ReactTestRenderer, id: string, height: number): Promise<void> {
  const onLayout = composite(r.root, id).props.onLayout as ((e: { nativeEvent: { layout: { width: number; height: number; x: number; y: number } } }) => void) | undefined;
  if (onLayout === undefined) throw new Error(`${id} takes no layout`);
  await act(async () => {
    onLayout({ nativeEvent: { layout: { width: 1000, height, x: 0, y: 0 } } });
  });
}

const fitOf = (r: ReactTestRenderer, id: string): string => (composite(r.root, id).props.dataSet as { fit: string }).fit;

/** Runs the fit hook's settle timer, which re-measures each content box through its `contentRef`. */
async function settle(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  // The fit hook re-measures after a settle timer; fake timers keep that inside each test.
  vi.useFakeTimers();
});
afterEach(async () => {
  // Unmount first, so no fit timer of a tree a failed test left behind fires once the timers are real again.
  await cleanup();
  vi.useRealTimers();
});

describe('pictureCrowded: a picture card never draws below its marker (QuizOptions)', () => {
  it('a row shorter than its marker and the card padding is crowded', () => {
    expect(pictureCrowded({ picture: true, rowHeight: ROOM - 2, ...CARD })).toBe(true);
    expect(pictureCrowded({ picture: true, rowHeight: 40, ...CARD })).toBe(true);
  });

  it('a row that holds the marker and the padding is not, with a pixel of rounding allowed', () => {
    expect(pictureCrowded({ picture: true, rowHeight: ROOM, ...CARD })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: ROOM - 1, ...CARD })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: ROOM + 100, ...CARD })).toBe(false);
  });

  it('a row height not measured yet (Infinity before the grid lays out, or NaN) is not crowded', () => {
    expect(pictureCrowded({ picture: true, rowHeight: Infinity, ...CARD })).toBe(false);
    expect(pictureCrowded({ picture: true, rowHeight: Number.NaN, ...CARD })).toBe(false);
  });

  it('a card with no picture is never crowded by its marker (a gloss has its own check)', () => {
    expect(pictureCrowded({ picture: false, rowHeight: 10, ...CARD })).toBe(false);
  });
});

describe('RealiaSheetStage tight: the same lines at the same width, less room around them (slide-realia.md "Fit")', () => {
  const menu = REALIA_ALL.find((s) => s.prompt.sheet.kind === 'menu')!;
  const sheetsByKind = [...new Map(REALIA_ALL.map((s) => [s.prompt.sheet.kind, s] as const)).values()];
  const draw = (slide: RealiaQuestionBody, tight: boolean): Promise<ReactTestRenderer> =>
    render(atOneUnit(<RealiaSheetStage sheet={slide.prompt.sheet} rom width={512} answer={{ entryId: slide.prompt.answerEntryId, shown: false }} tight={tight} />));

  it('the shipped Stage 6 realia questions carry every kind of sheet: a menu, a ticket, a trail sign, price cards and the plain sheet', () => {
    expect(new Set(sheetsByKind.map((s) => s.prompt.sheet.kind))).toEqual(new Set(['menu', 'ticket', 'sign', 'price-card', 'plain']));
  });

  it('a menu: the dressing strip at spacing.sm, not spacing.xl', async () => {
    const loose = await draw(menu, false);
    const tight = await draw(menu, true);
    expect(named(loose.root, 'Dressing').map((n) => n.props.height)).toEqual([spacing.xl]);
    expect(named(tight.root, 'Dressing').map((n) => n.props.height)).toEqual([spacing.sm]);
  });

  it("a menu: the paper's top and bottom padding at spacing.xxs, and no gap between lines", async () => {
    const onPaper = (r: ReactTestRenderer) => views(r.root, (s) => s.paddingVertical !== undefined && s.paddingHorizontal === spacing.md);
    const lines = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'list');
    const loose = await draw(menu, false);
    const tight = await draw(menu, true);
    expect(onPaper(loose).map((n) => [styleOf(n).paddingVertical, styleOf(n).gap])).toEqual([[spacing.md, spacing.xs]]);
    expect(onPaper(tight).map((n) => [styleOf(n).paddingVertical, styleOf(n).gap])).toEqual([[spacing.xxs, 0]]);
    expect(lines(loose).map((n) => styleOf(n).gap)).toEqual([spacing.xs]);
    expect(lines(tight).map((n) => styleOf(n).gap)).toEqual([0]);
  });

  /**
   * What `tight` changes on each kind, as `property: loose -> tight` on the sheet's views in tree order: the top strip
   * (menu, ticket, sign), the padded box's top and bottom padding (menu, plain, ticket, price cards), the gap between a title and
   * its lines and between boards (`spacing.sm` to `spacing.xxs`), and the gap between lines (`spacing.xs` to none).
   */
  const STRIP = `height: ${spacing.xl} -> ${spacing.sm}`;
  const PAD = `paddingVertical: ${spacing.md} -> ${spacing.xxs}`;
  const INNER = `gap: ${spacing.sm} -> ${spacing.xxs}`;
  const ROWS = `gap: ${spacing.xs} -> 0`;
  const EXPECTED: Record<'menu' | 'plain' | 'ticket' | 'sign' | 'price-card', string[]> = {
    // The strip, the paper (its padding, and its gap between the title and the lines) and the lines.
    menu: [STRIP, PAD, ROWS, ROWS],
    // The menu's paper with no dressing.
    plain: [PAD, ROWS, ROWS],
    // The strip in the band, the inner column (its padding and its gap) and the lines.
    ticket: [STRIP, PAD, INNER, ROWS],
    // The strip, the gap around the title and the gap between boards.
    sign: [STRIP, INNER, INNER],
    // The card's body: its padding and its gap.
    'price-card': [PAD, INNER],
  };

  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])('a %s: only its strip, its padding and its gaps get smaller', async (kind) => {
    expect(REALIA_DRESSINGS[kind].top !== undefined).toBe(EXPECTED[kind].includes(STRIP));
    const slide = sheetsByKind.find((s) => s.prompt.sheet.kind === kind)!;
    const styles = async (tight: boolean): Promise<Record<string, unknown>[]> => views(composite((await draw(slide, tight)).root, 'presenter-realia-sheet'), () => true).map(styleOf);
    const loose = await styles(false);
    const tight = await styles(true);
    // The same views in the same order: tight draws the same lines, so the two trees zip.
    expect(tight.length).toBe(loose.length);
    const changes = loose.flatMap((before, i) => {
      const after = tight[i]!;
      return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]).map((k) => `${k}: ${String(before[k])} -> ${String(after[k])}`);
    });
    expect(changes.sort()).toEqual([...EXPECTED[kind]].sort());
  });

  it('every kind keeps its width and its horizontal padding, so no line wraps anew', async () => {
    for (const slide of sheetsByKind) {
      const widths = async (tight: boolean): Promise<unknown[]> => {
        const root = composite((await draw(slide, tight)).root, 'presenter-realia-sheet');
        return [styleOf(root).width, ...views(root, () => true).map((n) => [styleOf(n).width, styleOf(n).paddingHorizontal, styleOf(n).minWidth])];
      };
      expect(await widths(true), slide.prompt.sheet.kind).toEqual(await widths(false));
    }
  });
});

describe('RealiaQuestionSlide: the sheet fits on its own, and a crowded picture grid draws the question at body size', () => {
  // A menu whose options are words or figures: they stand in rows, which measure with the slide's own fit.
  const menuRows = REALIA_ALL.find((s) => s.prompt.sheet.kind === 'menu' && s.options.every((o) => o.picture === undefined))!;

  it('a sheet taller than the room steps its own fit to 1 and draws tight; the slide content, which fits, stays at level 0', async () => {
    expect(menuRows).toBeDefined();
    const r = await mount(<RealiaQuestionSlide slide={menuRows} shown={QUESTION} romanization="always" />, {
      'presenter-realia-question-sheet': 560,
      'presenter-realia-question-content': 300,
    });
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('0');
    expect(r.root.findByType(RealiaSheetStage).props.tight).toBe(false);
    await layout(r, 'presenter-realia-question', 504);
    await layout(r, 'presenter-realia-question-content', 300);
    await layout(r, 'presenter-realia-question-sheet', 560);
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('1');
    expect(fitOf(r, 'presenter-realia-question-content')).toBe('0');
    const sheet = r.root.findByType(RealiaSheetStage);
    expect(sheet.props.tight).toBe(true);
    expect(named(sheet, 'Dressing').map((n) => n.props.height)).toEqual([spacing.sm]);
    // After the settle the sheet does not fall back to loose, and the content's own re-measure keeps it at 0.
    await settle();
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('1');
    expect(fitOf(r, 'presenter-realia-question-content')).toBe('0');
    // One level only: a sheet still too tall stays tight, it never steps further.
    await layout(r, 'presenter-realia-question-sheet', 560);
    await settle();
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('1');
    expect(fitOf(r, 'presenter-realia-question-content')).toBe('0');
    await unmount(r);
  });

  it('a sheet that fits its room stays loose', async () => {
    const r = await mount(<RealiaQuestionSlide slide={menuRows} shown={QUESTION} romanization="always" />);
    await layout(r, 'presenter-realia-question', 504);
    await layout(r, 'presenter-realia-question-sheet', 400);
    expect(fitOf(r, 'presenter-realia-question-sheet')).toBe('0');
    expect(r.root.findByType(RealiaSheetStage).props.tight).toBe(false);
    await unmount(r);
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
      await unmount(r);
    }
    expect(grid, 'a Stage 6 realia question draws its pictures in the 2 x 2 grid').toBeDefined();
    const question = (): unknown => styleOf(composite(grid!.root, 'presenter-quiz-question')).fontSize;
    expect(question()).toBe(presenter.size.prompt);
    // Rows that hold their markers keep the question at prompt size.
    await layout(grid!, 'presenter-quiz-options', 400);
    expect(question()).toBe(presenter.size.prompt);
    // A key row that wraps above the grid leaves two rows of 70 units, shorter than an 80-unit marker.
    await layout(grid!, 'presenter-quiz-options', 70 * 2 + STAGE_GAP_INNER);
    expect(question()).toBe(presenter.size.body);
    expect(fitOf(grid!, 'presenter-realia-question-content')).toBe('0');
    await unmount(grid!);
  });
});

describe('QuizSlide: a crowded picture grid takes room from the asked word (slide-quiz.md "Notes")', () => {
  // No shipped meaning quiz carries pictures yet (only listen and realia questions do); the grid and its check are the
  // same shared QuizOptions, so a meaning quiz with a realia question's picture options stands in for one.
  const pictureOptions = REALIA_ALL.find((s) => s.options.length >= 2 && s.options.every((o) => o.picture !== undefined))!.options;
  const meaning: Extract<Slide, { kind: 'quiz' }> = {
    key: 'quiz:fit/q1',
    builds: ['question', 'answer'],
    kind: 'quiz',
    prompt: { ask: 'meaning', ko: '사과', romanization: 'sagwa' },
    options: pictureOptions,
    textPrompt: false,
  };
  const rowsOf = pictureOptions.length > 2 ? 2 : 1;
  const gridFor = (row: number): number => row * rowsOf + STAGE_GAP_INNER * (rowsOf - 1);

  it('the asked word drops from display to prompt size once a row is shorter than its marker and the card padding', async () => {
    const r = await mount(<QuizSlide slide={meaning} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />);
    // The asked word's TaughtKo, whose `size` is its font size.
    const word = (): unknown => composite(r.root, 'presenter-quiz-word').props.size;
    expect(word()).toBe(presenter.size.display);
    // Rows exactly as tall as a picture card needs (and a pixel short, the rounding allowed) keep the word at display size.
    await layout(r, 'presenter-quiz-options', gridFor(ROOM));
    expect(word()).toBe(presenter.size.display);
    await layout(r, 'presenter-quiz-options', gridFor(ROOM - 1));
    expect(word()).toBe(presenter.size.display);
    // Two pixels short: the card asks for room.
    await layout(r, 'presenter-quiz-options', gridFor(ROOM - 2));
    expect(word()).toBe(presenter.size.prompt);
    await unmount(r);
  });
});

describe('WriteTogetherSlide levels 1 and 2: the sound table on one shared outline at 2, the slide gaps at spacing.xs (slide-write-together.md)', () => {
  async function at(level: 0 | 1 | 2): Promise<ReactTestRenderer> {
    const r = await mount(<WriteTogetherSlide slide={ownName} reveal={1} romanization="always" />, { 'presenter-write-content': 400 });
    await layout(r, 'presenter-write-room', 300);
    for (let i = 0; i < level; i += 1) await layout(r, 'presenter-write-content', 400);
    expect(fitOf(r, 'presenter-write-content')).toBe(String(level));
    return r;
  }
  const rowsOf = (r: ReactTestRenderer): Node[] => composite(r.root, 'presenter-write-table').findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-write-table-row');

  it('the table rows share one outline: no row gap, and each row over the one above by its border', async () => {
    const r = await at(2);
    expect(styleOf(composite(r.root, 'presenter-write-table')).gap).toBe(0);
    const rows = rowsOf(r);
    expect(rows.length).toBeGreaterThan(1);
    const border = styleOf(composite(rows[0]!, 'presenter-write-cell')).borderWidth as number;
    expect(border).toBeGreaterThan(0);
    expect(rows.map((row) => styleOf(row).marginTop)).toEqual(rows.map((_, g) => (g === 0 ? 0 : -border)));
    await unmount(r);
  });

  it("the slide's gaps are spacing.xs at level 2, spacing.md at levels 0 and 1 where the rows stand apart", async () => {
    const tight = await at(2);
    expect(styleOf(composite(tight.root, 'presenter-write')).gap).toBe(spacing.xs);
    expect(styleOf(composite(tight.root, 'presenter-write-content')).gap).toBe(spacing.xs);
    await unmount(tight);
    for (const level of [0, 1] as const) {
      const r = await at(level);
      expect(styleOf(composite(r.root, 'presenter-write')).gap, `level ${level}`).toBe(spacing.md);
      expect(styleOf(composite(r.root, 'presenter-write-content')).gap, `level ${level}`).toBe(spacing.md);
      expect(styleOf(composite(r.root, 'presenter-write-table')).gap, `level ${level}`).toBe(spacing.xs);
      expect(new Set(rowsOf(r).map((row) => styleOf(row).marginTop)), `level ${level}`).toEqual(new Set([0]));
      await unmount(r);
    }
  });
});
