import { borderWidth, layout, spacing, touchTarget, typography } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { StatusChip } from '../../../logic/lecture/tools';
import { byTestId, hostNodes, press, render, textOf } from '../../../test-support/render';
import { ControlBar, type ControlBarProps } from '../ControlBar';
import { PresenterViewProvider } from '../presenter-context';
import {
  BAR_BAND,
  BAR_GROUP_GAP,
  BAR_ROW_GAP,
  NAV_CLEARANCE,
  NEXT_MIN_WIDTH,
  PHONE_RAIL,
  PHONE_RAIL_COMPACT,
  PHONE_RAIL_GAP,
  RAIL_BUTTON,
  RAIL_BUTTON_COMPACT,
  RAIL_LABEL_ROOM,
  STAGE_PADDING,
  STATUS_MIN,
} from '../stage-metrics';

/**
 * The docked control bar (AMENDMENTS-PRESENTER-NAV section 5.1, owner choices O6 and O9, row PN-3; mock
 * design/screens/presenter/stage-and-bar.md "Navigation (PN-0b)", "Docked bar"): its order and focus order,
 * the wide touch order, the wrap rule on measured widths (the tools above, Previous and Next on the bottom
 * row, More when two rows do not hold the tools), and the pinned pair outside the fading view (PN-2) in
 * every order. The render lane has no layout engine, so the test hands each control the width a browser
 * measures, through the `onLayout` the bar gives it.
 */

const noop = (): void => undefined;

function bar(overrides: Partial<ControlBarProps> = {}, locale: UiLocale = 'en'): React.ReactElement {
  const props: ControlBarProps = {
    hidden: false,
    revealNext: false,
    muted: false,
    fullscreenSupported: true,
    fullscreen: false,
    onPrev: noop,
    onNext: noop,
    onSound: noop,
    onFullscreen: noop,
    onExit: noop,
    onTimer: noop,
    onBlank: noop,
    onGrid: noop,
    onHelp: noop,
    chips: [] as StatusChip[],
    onTurnSoundOn: noop,
    onFocusWithin: noop,
    ...overrides,
  };
  return (
    <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>
      <ControlBar {...props} />
    </PresenterViewProvider>
  );
}

/** The band's test ids in drawing (DOM) order, which is the focus order: the band's buttons and its More. */
const BUTTONS = new Set(['presenter-back', 'presenter-next', 'presenter-sound', 'presenter-timer', 'presenter-blank-button', 'presenter-grid-button', 'presenter-fullscreen', 'presenter-exit', 'presenter-more']);
function order(r: ReactTestRenderer): string[] {
  const band = byTestId(r.root, 'presenter-bar-band')[0]!;
  return hostNodes(band, (n) => n.props.role === 'button' && BUTTONS.has(String(n.props['data-testid']))).map((n) => String(n.props['data-testid']));
}

/** The composite node a test id names that takes an `onLayout` (the bar's measuring hook). */
function measured(r: ReactTestRenderer, id: string): ReactTestInstance {
  return r.root.find((n) => typeof n.type !== 'string' && n.props.testID === id && typeof n.props.onLayout === 'function');
}

function layoutOf(node: ReactTestInstance, width: number, height: number = touchTarget.hero): void {
  act(() => {
    (node.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });
}

/** PN-0b's measured tool widths: en 635 px of tools, es 744 (stage-and-bar.md "Navigation (PN-0b)"). */
const WIDTHS: Record<'en' | 'es', Record<string, number>> = {
  en: { 'presenter-exit': 96, 'presenter-fullscreen': 115, 'presenter-grid-button': 96, 'presenter-blank-button': 96, 'presenter-timer': 96, 'presenter-sound': 96 },
  es: { 'presenter-exit': 96, 'presenter-fullscreen': 144, 'presenter-grid-button': 130, 'presenter-blank-button': 96, 'presenter-timer': 142, 'presenter-sound': 96 },
};

/** A browser's layout pass at a window width: the row's room (the band less its gutters) and every control's width. */
function measure(r: ReactTestRenderer, windowWidth: number, lang: 'en' | 'es' = 'en'): void {
  layoutOf(measured(r, 'presenter-bar-docked'), windowWidth - 2 * layout.gutter.regular);
  layoutOf(measured(r, 'presenter-back'), touchTarget.hero);
  layoutOf(measured(r, 'presenter-next'), NEXT_MIN_WIDTH);
  for (const [id, width] of Object.entries(WIDTHS[lang])) {
    const node = r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id && typeof n.props.onLayout === 'function')[0];
    if (node) layoutOf(node, width);
  }
}

const rowOf = (r: ReactTestRenderer): ReactTestInstance => byTestId(r.root, 'presenter-bar-docked')[0]!;

describe('the docked order (O6): Previous first, Next last, Sound between Exit and Next', () => {
  it('draws Previous, Exit, Full screen, Slides, Blank, Timer, Sound, Next, in that focus order', async () => {
    const r = await render(bar());
    measure(r, 1180);
    expect(rowOf(r).props['data-rows']).toBe('1');
    expect(rowOf(r).props['data-order']).toBe('o6');
    expect(order(r)).toEqual(['presenter-back', 'presenter-exit', 'presenter-fullscreen', 'presenter-grid-button', 'presenter-blank-button', 'presenter-timer', 'presenter-sound', 'presenter-next']);
  });

  it('Exit is never beside Next: Sound is the last tool, right before Next', async () => {
    const r = await render(bar({ fullscreenSupported: false }));
    measure(r, 1180);
    const ids = order(r);
    expect(ids.indexOf('presenter-sound')).toBe(ids.indexOf('presenter-next') - 1);
    expect(ids.indexOf('presenter-exit')).toBeLessThan(ids.indexOf('presenter-sound'));
    expect(ids).not.toContain('presenter-fullscreen');
  });

  it('puts the status chips between Previous and the tools, with their basis kept on one row', async () => {
    const r = await render(bar({ chips: ['offline'] }));
    measure(r, 1180);
    const band = byTestId(r.root, 'presenter-bar-band')[0]!;
    const ids = hostNodes(band, (n) => ['presenter-back', 'presenter-status', 'presenter-exit', 'presenter-next'].includes(String(n.props['data-testid']))).map((n) => n.props['data-testid']);
    expect(ids).toEqual(['presenter-back', 'presenter-status', 'presenter-exit', 'presenter-next']);
    expect(byTestId(r.root, 'presenter-status')[0]!.props.role).toBe('status');
  });

  it('mounts the status region with the band, before any chip, so a chip that arrives is announced', async () => {
    const r = await render(bar());
    expect(byTestId(r.root, 'presenter-status')).toHaveLength(1);
    expect(byTestId(r.root, 'presenter-status')[0]!.props.role).toBe('status');
  });

  it('is one toolbar named Lesson controls', async () => {
    const r = await render(bar());
    expect(rowOf(r).props.role).toBe('toolbar');
    expect(rowOf(r).props['aria-label']).toBe(getMessages('en').learner.presenter.bar.label);
  });
});

describe('the wide touch order (O9: 1600 px and wider with touch seen)', () => {
  it('moves Previous to just before Next', async () => {
    const r = await render(bar({ wideTouch: true, pinNav: true }));
    measure(r, 1920);
    expect(rowOf(r).props['data-order']).toBe('o9');
    expect(order(r)).toEqual(['presenter-exit', 'presenter-fullscreen', 'presenter-grid-button', 'presenter-blank-button', 'presenter-timer', 'presenter-sound', 'presenter-back', 'presenter-next']);
  });
});

describe('the wrap rule (measured, section 5.1)', () => {
  it('1180 x 820 holds one row in English; the band is BAR_BAND', async () => {
    const r = await render(bar());
    measure(r, 1180);
    expect(rowOf(r).props['data-rows']).toBe('1');
    expect(BAR_BAND).toBe(touchTarget.hero + 2 * spacing.md);
  });

  it.each([1024, 1080, 1133, 820])('at %i px wide the tools wrap above; Previous and Next stay on the bottom row at its two ends', async (width) => {
    const r = await render(bar());
    measure(r, width);
    expect(rowOf(r).props['data-rows']).toBe('2');
    expect(rowOf(r).props['data-more']).toBe('false');
    // The bottom row is the flow (Previous, the chips, Next); the tools row is drawn above it, out of the flow.
    const tools = byTestId(r.root, 'presenter-bar-tools')[0]!;
    const toolsStyle = flatStyle(tools);
    expect(toolsStyle.position).toBe('absolute');
    expect(toolsStyle.top).toBe('0px');
    expect(toolsStyle.right).toBe('0px');
    // The row makes room above its bottom row for one row of tools and the row gap: the band grows by BAR_BAND.
    expect(flatStyle(rowOf(r)).paddingTop).toBe(`${touchTarget.hero + BAR_ROW_GAP}px`);
    expect(touchTarget.hero + BAR_ROW_GAP + touchTarget.hero + 2 * spacing.md).toBe(2 * BAR_BAND);
    const ids = order(r);
    expect(ids[0]).toBe('presenter-back');
    expect(ids[ids.length - 1]).toBe('presenter-next');
    for (const id of ['presenter-back', 'presenter-next']) expect(isInside(byTestId(r.root, id)[0]!, tools), id).toBe(false);
    expect(byTestId(r.root, 'presenter-more')).toHaveLength(0);
  });

  it('Spanish wraps at 1180 x 820 and keeps every tool on the band', async () => {
    const r = await render(bar({}, 'es'));
    measure(r, 1180, 'es');
    expect(rowOf(r).props['data-rows']).toBe('2');
    expect(rowOf(r).props['data-more']).toBe('false');
  });

  it('Spanish at 768 x 1024 takes the More fallback: Timer, Blank and Slides in More on the bottom row before Next', async () => {
    const onMore = vi.fn();
    const r = await render(bar({ onMore }, 'es'));
    measure(r, 768, 'es');
    expect(rowOf(r).props['data-rows']).toBe('2');
    expect(rowOf(r).props['data-more']).toBe('true');
    expect(order(r)).toEqual(['presenter-back', 'presenter-exit', 'presenter-fullscreen', 'presenter-sound', 'presenter-more', 'presenter-next']);
    const more = byTestId(r.root, 'presenter-more')[0]!;
    expect(isInside(more, byTestId(r.root, 'presenter-bar-tools')[0]!)).toBe(false);
    expect(more.props['aria-haspopup']).toBe('dialog');
    expect(more.props['aria-expanded']).toBe(false);
    await press(more);
    expect(onMore).toHaveBeenCalledWith(true);
  });

  it('More opens a sheet over the stage with the three tools it took, and they run their tool', async () => {
    const onTimer = vi.fn();
    const onMore = vi.fn();
    const r = await render(bar({ moreOpen: true, onMore, onTimer }, 'es'));
    measure(r, 744, 'es');
    const sheet = byTestId(r.root, 'presenter-more-sheet')[0]!;
    expect(sheet.props.role).toBe('dialog');
    const inSheet = hostNodes(sheet, (n) => n.props.role === 'button').map((n) => n.props['data-testid']);
    expect(inSheet).toEqual(['presenter-more-close', 'presenter-grid-button', 'presenter-timer', 'presenter-blank-button']);
    // It sits above the band, never in it (the band clips its own content).
    expect(isInside(sheet, byTestId(r.root, 'presenter-bar-band')[0]!)).toBe(false);
    await press(hostNodes(sheet, (n) => n.props['data-testid'] === 'presenter-timer')[0]!);
    expect(onMore).toHaveBeenCalledWith(false);
    expect(onTimer).toHaveBeenCalledTimes(1);
  });

  it('a band that no longer needs More closes its sheet', async () => {
    const onMore = vi.fn();
    const r = await render(bar({ moreOpen: true, onMore }, 'es'));
    measure(r, 768, 'es');
    expect(onMore).not.toHaveBeenCalled();
    layoutOf(measured(r, 'presenter-bar-docked'), 1920 - 2 * layout.gutter.regular);
    expect(onMore).toHaveBeenCalledWith(false);
  });

  it('under O9 the wrapped band keeps Previous and Next together at the end of the bottom row, More before Previous', async () => {
    const r = await render(bar({ wideTouch: true, pinNav: true }, 'es'));
    measure(r, 768, 'es');
    expect(order(r)).toEqual(['presenter-exit', 'presenter-fullscreen', 'presenter-sound', 'presenter-more', 'presenter-back', 'presenter-next']);
  });

  it('lays out one row until it has measured, and never shrinks a tool (each keeps its own width)', async () => {
    const r = await render(bar());
    expect(rowOf(r).props['data-rows']).toBe('1');
    measure(r, 1024);
    for (const id of ['presenter-exit', 'presenter-sound']) expect(flatStyle(byTestId(r.root, id)[0]!).flexShrink ?? '0').toBe('0');
  });

  it('a language change mid-lesson keeps the last widths until the new labels report: the band stays wrapped, Next never clipped', async () => {
    const r = await render(bar());
    measure(r, 1024);
    expect(rowOf(r).props['data-rows']).toBe('2');
    // The device language follows to Korean: only Full screen's box changes (102 px); Exit, Previous,
    // Next and the 96 px tools keep their boxes, so they fire no new layout.
    await act(async () => {
      r.update(bar({}, 'ko'));
    });
    expect(rowOf(r).props['data-rows']).toBe('2');
    layoutOf(r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-fullscreen' && typeof n.props.onLayout === 'function')[0]!, 102);
    expect(rowOf(r).props['data-rows']).toBe('2');
    expect(flatStyle(rowOf(r)).paddingTop).toBe(`${touchTarget.hero + BAR_ROW_GAP}px`);
  });

  it('a shorter label after a language change takes its new, smaller width (a fresh set of widths per labels)', async () => {
    const r = await render(bar({}, 'es'));
    measure(r, 1180, 'es');
    expect(rowOf(r).props['data-rows']).toBe('2');
    await act(async () => {
      r.update(bar({}, 'en'));
    });
    measure(r, 1180, 'en');
    expect(rowOf(r).props['data-rows']).toBe('1');
  });

  it('a band too narrow for the tools More leaves wraps them on a second tools row (rows 3), never clipping one', async () => {
    const r = await render(bar({}, 'es'));
    layoutOf(measured(r, 'presenter-bar-docked'), 400);
    layoutOf(measured(r, 'presenter-back'), touchTarget.hero);
    layoutOf(measured(r, 'presenter-next'), NEXT_MIN_WIDTH);
    for (const id of ['presenter-exit', 'presenter-fullscreen', 'presenter-grid-button', 'presenter-blank-button', 'presenter-timer', 'presenter-sound']) {
      const node = r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id && typeof n.props.onLayout === 'function')[0];
      if (node) layoutOf(node, NEXT_MIN_WIDTH);
    }
    expect(rowOf(r).props['data-rows']).toBe('3');
    expect(rowOf(r).props['data-more']).toBe('true');
    expect(flatStyle(rowOf(r)).paddingTop).toBe(`${2 * (touchTarget.hero + BAR_ROW_GAP)}px`);
    expect(flatStyle(byTestId(r.root, 'presenter-bar-tools')[0]!).flexWrap).toBe('wrap');
  });

  it('reports the band height so the stage shrinks to match', async () => {
    const onBandHeight = vi.fn();
    const r = await render(bar({ onBandHeight }));
    layoutOf(measured(r, 'presenter-bar-band'), 1024, 2 * BAR_BAND);
    expect(onBandHeight).toHaveBeenCalledWith(2 * BAR_BAND);
  });
});

describe('pinNav (PN-2) in every order: Previous and Next outside the fading view', () => {
  it.each([
    ['O6, one row', 1180, false, 'en'],
    ['O6, wrapped', 1024, false, 'en'],
    ['O6, More', 768, false, 'es'],
    ['O9, one row', 1920, true, 'en'],
    ['O9, More', 768, true, 'es'],
  ] as const)('%s', async (_label, width, wideTouch, lang) => {
    const r = await render(bar({ pinNav: true, hidden: true, wideTouch }, lang));
    measure(r, width, lang);
    const row = rowOf(r);
    for (const id of ['presenter-nav-prev', 'presenter-nav-next']) {
      const slot = byTestId(r.root, id)[0]!;
      expect(slot.props['data-pinned'], id).toBe('true');
      // Not inside a faded group: every opacity from the button up is 1.
      expect(opacityUp(slot), id).toBe(1);
    }
    // The tools, the chips and More fade; the row itself does not.
    expect(flatStyle(row).opacity ?? '1').toBe('1');
    expect(Number(flatStyle(byTestId(r.root, 'presenter-bar-tools')[0]!).opacity)).toBe(0);
    if (lang === 'es' && width === 768) expect(opacityUp(byTestId(r.root, 'presenter-more')[0]!)).toBe(0);
  });

  it('mouse only (no pin), the whole row fades and the pair follows it', async () => {
    const r = await render(bar({ pinNav: false, hidden: true }));
    measure(r, 1180);
    expect(Number(flatStyle(rowOf(r)).opacity)).toBe(0);
    expect(byTestId(r.root, 'presenter-nav-prev')[0]!.props['data-pinned']).toBe('false');
    expect(opacityUp(byTestId(r.root, 'presenter-next')[0]!)).toBe(0);
  });
});

describe('the clearance on the docked band (section 5.0)', () => {
  it('stage padding at the smallest docked unit plus the band padding is at least NAV_CLEARANCE (32 px)', () => {
    expect(NAV_CLEARANCE).toBe(spacing.xxl);
    // The smallest docked stage is layout.breakpoint.regular (600) wide: unit 600 / 1280.
    const smallestUnit = layout.breakpoint.regular / 1280;
    expect(STAGE_PADDING * smallestUnit + spacing.md).toBeGreaterThanOrEqual(NAV_CLEARANCE);
    // PN-0b's 1024 x 768 (unit 0.8): 38.4 + 12.
    expect(STAGE_PADDING * 0.8 + spacing.md).toBeCloseTo(50.4, 5);
  });

  it('keeps the chips basis and the gaps PN-0b drew', () => {
    expect(STATUS_MIN).toBe(192);
    expect(BAR_GROUP_GAP).toBe(spacing.lg);
    expect(BAR_ROW_GAP).toBe(2 * spacing.md);
  });
});

/**
 * The phone rail (AMENDMENTS-PRESENTER-NAV section 5.2, owner choices O1 a, O3 a and O10 a, row PN-4;
 * mock stage-and-bar.md "Navigation (PN-0b)", "Phone rail"): a vertical toolbar beside the stage, More
 * at the top, Next / Reveal and Previous as a pair centred in its height, Sound at the bottom; never
 * hidden; the compact rail's icon buttons named by their labels; the label fallback measured on the
 * real words (the render lane has no layout engine, so the test hands each probe word the width
 * PN-0b measured in Chromium, through its `onLayout`).
 */
const RAIL_IDS = ['presenter-more', 'presenter-next', 'presenter-back', 'presenter-sound'];
const NOTCH = { top: 0, right: 47, bottom: 21, left: 47 };

function railOrder(r: ReactTestRenderer): string[] {
  const rail = byTestId(r.root, 'presenter-rail')[0]!;
  return hostNodes(rail, (n) => n.props.role === 'button').map((n) => String(n.props['data-testid']));
}

/** PN-0b "Rail labels": the longest word of each label at 18 px bold in the iOS system font. */
const WORDS: Record<'en' | 'es' | 'ko', { full: number[]; more: number[] }> = {
  en: { full: [44.0, 56.7, 40.2, 74.7, 55.2], more: [44.0] },
  es: { full: [35.7, 67.8, 81.4, 70.8, 59.8], more: [35.7] },
  ko: { full: [31.1, 31.1, 31.1, 31.1, 31.1], more: [31.1] },
};

/** Hands the rail's word probe its measured widths: the full-rail words first (More, Next, Reveal, Previous, Sound), then More's. */
function measureWords(r: ReactTestRenderer, words: { full: number[]; more: number[] }): void {
  const probes = r.root.findAll((n) => typeof n.type !== 'string' && typeof n.props.testID === 'string' && n.props.testID.startsWith('presenter-rail-word-') && typeof n.props.onLayout === 'function');
  const full = probes.filter((n) => String(n.props.testID).startsWith('presenter-rail-word-full-'));
  const more = probes.filter((n) => String(n.props.testID).startsWith('presenter-rail-word-more-'));
  full.forEach((node, i) => layoutOf(node, words.full[Math.min(i, words.full.length - 1)]!, 24));
  more.forEach((node, i) => layoutOf(node, words.more[Math.min(i, words.more.length - 1)]!, 24));
}

describe('the phone rail (section 5.2): order, role, place', () => {
  it.each(['full', 'compact'] as const)('the %s rail: More, Next, Previous, Sound top to bottom, in that focus order', async (size) => {
    const r = await render(bar({ compact: true, rail: size, railHeight: 390 }));
    expect(railOrder(r)).toEqual(RAIL_IDS);
    // Nothing of the docked band or the floating bar.
    expect(byTestId(r.root, 'presenter-bar-band')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-bar-compact')).toHaveLength(0);
  });

  it('is a vertical toolbar named Lesson controls', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390 }));
    const toolbar = byTestId(r.root, 'presenter-rail-toolbar')[0]!;
    expect(toolbar.props.role).toBe('toolbar');
    expect(toolbar.props['aria-orientation']).toBe('vertical');
    expect(toolbar.props['aria-label']).toBe(getMessages('en').learner.presenter.bar.label);
  });

  it('centres Next and Previous as a pair: two equal flexible sections above and below it', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390 }));
    const pair = byTestId(r.root, 'presenter-rail-pair')[0]!;
    expect(hostNodes(pair, (n) => n.props.role === 'button').map((n) => n.props['data-testid'])).toEqual(['presenter-next', 'presenter-back']);
    const top = flatStyle(byTestId(r.root, 'presenter-rail-top')[0]!);
    const bottom = flatStyle(byTestId(r.root, 'presenter-rail-bottom')[0]!);
    expect(top.flexGrow).toBe('1');
    expect(bottom.flexGrow).toBe('1');
    expect(top.flexBasis).toBe(bottom.flexBasis);
    expect(top.justifyContent).toBe('flex-start');
    expect(bottom.justifyContent).toBe('flex-end');
    expect(isInside(byTestId(r.root, 'presenter-more')[0]!, byTestId(r.root, 'presenter-rail-top')[0]!)).toBe(true);
    expect(isInside(byTestId(r.root, 'presenter-sound')[0]!, byTestId(r.root, 'presenter-rail-bottom')[0]!)).toBe(true);
  });

  it('sits at the right inside the right inset, full height between the insets, with the inert gap on its stage side', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 369, insets: NOTCH }));
    const rail = flatStyle(byTestId(r.root, 'presenter-rail')[0]!);
    expect(rail.width).toBe(`${PHONE_RAIL}px`);
    expect(rail.marginRight).toBe(`${NOTCH.right}px`);
    expect(rail.marginBottom).toBe(`${NOTCH.bottom}px`);
    expect(rail.marginTop).toBe('0px');
    // The border.strong rule and the padding together are the 12 px no button reaches.
    expect(rail.borderLeftWidth).toBe(`${borderWidth.base}px`);
    expect(Number.parseFloat(rail.paddingLeft!) + borderWidth.base).toBe(PHONE_RAIL_GAP);
    expect(Number.parseFloat(rail.paddingLeft!) + borderWidth.base + RAIL_BUTTON + Number.parseFloat(rail.paddingRight!)).toBe(PHONE_RAIL);
  });

  it('the numbers: full 104 with 88 px buttons, compact 80 with 64 px squares, the gap 12, the label room 84 and 52', () => {
    expect(PHONE_RAIL).toBe(104);
    expect(PHONE_RAIL_COMPACT).toBe(80);
    expect(PHONE_RAIL_GAP).toBe(spacing.md);
    expect(RAIL_BUTTON).toBe(88);
    expect(RAIL_BUTTON_COMPACT).toBe(touchTarget.min);
    expect(RAIL_LABEL_ROOM).toEqual({ full: 84, more: 52 });
    // The clearance at the smallest rail stage (unit 0.4375): 21 px of stage padding plus the 12 px gap.
    expect(STAGE_PADDING * 0.4375 + PHONE_RAIL_GAP).toBeGreaterThanOrEqual(NAV_CLEARANCE);
  });

  it('never hides: hidden from the presenter changes nothing, and it takes taps at once (no grace)', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390, hidden: true }));
    const rail = byTestId(r.root, 'presenter-rail')[0]!;
    expect(opacityUp(rail)).toBe(1);
    for (const id of RAIL_IDS) {
      const node = byTestId(r.root, id)[0]!;
      expect(opacityUp(node), id).toBe(1);
      for (let at: ReactTestInstance | null = node; at; at = at.parent) {
        if (typeof at.type === 'string') expect(at.props.style?.pointerEvents === 'none' || at.props.pointerEvents === 'none', id).toBe(false);
      }
    }
  });

  it('presses: More opens the sheet, Next, Previous and Sound run their own action', async () => {
    const onMore = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onSound = vi.fn();
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390, onMore, onNext, onPrev, onSound }));
    await press(byTestId(r.root, 'presenter-more')[0]!);
    expect(onMore).toHaveBeenCalledWith(true);
    await press(byTestId(r.root, 'presenter-next')[0]!);
    await press(byTestId(r.root, 'presenter-back')[0]!);
    await press(byTestId(r.root, 'presenter-sound')[0]!);
    expect([onNext.mock.calls.length, onPrev.mock.calls.length, onSound.mock.calls.length]).toEqual([1, 1, 1]);
    expect(byTestId(r.root, 'presenter-more')[0]!.props['aria-haspopup']).toBe('dialog');
  });

  it('More open: the sheet sits over the stage beside the rail, never over it', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 369, insets: NOTCH, moreOpen: true }));
    const sheet = byTestId(r.root, 'presenter-more-sheet')[0]!;
    expect(isInside(sheet, byTestId(r.root, 'presenter-rail')[0]!)).toBe(false);
    expect(flatStyle(sheet).right).toBe(`${NOTCH.right + PHONE_RAIL + spacing.sm}px`);
    expect(flatStyle(sheet).left).toBe(`${NOTCH.left + spacing.sm}px`);
    expect(byTestId(r.root, 'presenter-more')[0]!.props['aria-expanded']).toBe(true);
    // The rail stays as it was (it never hides, the sheet is beside it).
    expect(railOrder(r)).toEqual(RAIL_IDS);
  });
});

describe('the full rail buttons (88 wide, at least 64 tall, Next 96 unless the rail is under 328 px)', () => {
  it.each([
    [375, 96],
    [328, 96],
    [320, touchTarget.min],
  ])('a rail %i px tall: Next is %i tall and the primary fill; the others 88 x 64', async (railHeight, nextHeight) => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight }));
    const next = flatStyle(byTestId(r.root, 'presenter-next')[0]!);
    expect(next.width).toBe(`${RAIL_BUTTON}px`);
    expect(next.minHeight).toBe(`${nextHeight}px`);
    for (const id of ['presenter-more', 'presenter-back', 'presenter-sound']) {
      const style = flatStyle(byTestId(r.root, id)[0]!);
      expect(style.width, id).toBe(`${RAIL_BUTTON}px`);
      expect(style.minHeight, id).toBe(`${touchTarget.min}px`);
      // No side padding: the label has the button less its borders (84 px).
      expect(style.paddingLeft ?? '0px', id).toBe('0px');
    }
  });

  it('icon above a visible label at the body floor (18 px), centred, a word never broken', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390 }));
    for (const id of RAIL_IDS) {
      const button = byTestId(r.root, id)[0]!;
      const label = hostNodes(button, (n) => n.props.dir === 'auto' || (typeof n.props.style?.fontSize === 'string'))[0]!;
      const style = flatStyle(label);
      expect(style.fontSize, id).toBe(`${typography.size.body}px`);
      expect(style.textAlign, id).toBe('center');
      expect(style.wordBreak, id).toBe('keep-all');
      expect(style.overflowWrap, id).toBe('normal');
    }
    // Previous, Next and Sound carry their glyph above the label; More is text only.
    expect(flatStyle(byTestId(r.root, 'presenter-back')[0]!).flexDirection).toBe('column');
  });

  it.each(['en', 'es', 'ko'] as const)('no full-rail label overflows its button in %s at 18 px: every word PN-0b measured fits the 84 px room', async (lang) => {
    const onRailLabels = vi.fn();
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390, onRailLabels }, lang));
    measureWords(r, WORDS[lang]);
    expect(onRailLabels).not.toHaveBeenCalledWith(false);
    for (const width of WORDS[lang].full) expect(width).toBeLessThanOrEqual(RAIL_LABEL_ROOM.full);
    // The labels the rail shows are the shipped ones.
    const m = getMessages(lang).learner.presenter.bar;
    expect(byTestId(r.root, 'presenter-back')[0]!.props['aria-label']).toBe(m.prev.cta);
    expect(byTestId(r.root, 'presenter-sound')[0]!.props['aria-label']).toBe(m.sound.cta);
    expect(byTestId(r.root, 'presenter-more')[0]!.props['aria-label']).toBe(m.more.cta);
    expect(byTestId(r.root, 'presenter-next')[0]!.props['aria-label']).toBe(getMessages(lang).common.buttons.next);
  });

  it('probes every word of every full-rail label once, Next and Reveal both (so the rail never flips between builds)', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390 }, 'ko'));
    const words = r.root
      .findAll((n) => typeof n.type !== 'string' && String(n.props.testID ?? '').startsWith('presenter-rail-word-full-') && typeof n.props.onLayout === 'function')
      .map((n) => textOf(byTestId(n, String(n.props.testID))[0] ?? n));
    const m = getMessages('ko').learner.presenter.bar;
    const expected = [...new Set([m.more.cta, getMessages('ko').common.buttons.next, m.reveal.cta, m.prev.cta, m.sound.cta].flatMap((label) => label.split(/\s+/)))];
    expect(words).toEqual(expected);
  });
});

describe('the compact rail (O10 a): 64 px squares, icons with their labels as the accessible names', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: Next, Previous and Sound icon only, named by their labels; More keeps its text', async (lang) => {
    const r = await render(bar({ compact: true, rail: 'compact', railHeight: 360, muted: true }, lang));
    const m = getMessages(lang).learner.presenter.bar;
    const names: Record<string, string> = {
      'presenter-next': getMessages(lang).common.buttons.next,
      'presenter-back': m.prev.cta,
      'presenter-sound': m.sound.cta,
    };
    for (const [id, name] of Object.entries(names)) {
      const button = byTestId(r.root, id)[0]!;
      expect(button.props['aria-label'], id).toBe(name);
      // No visible label: the glyph is the face.
      expect(labelText(button), id).toBe('');
      const style = flatStyle(button);
      expect(style.width, id).toBe(`${touchTarget.min}px`);
      expect(style.height, id).toBe(`${touchTarget.min}px`);
    }
    const more = byTestId(r.root, 'presenter-more')[0]!;
    expect(more.props['aria-label']).toBe(m.more.cta);
    expect(labelText(more)).toBe(m.more.cta);
    expect(flatStyle(byTestId(r.root, 'presenter-rail')[0]!).width).toBe(`${PHONE_RAIL_COMPACT}px`);
  });

  it('Reveal names Next while builds remain', async () => {
    const r = await render(bar({ compact: true, rail: 'compact', railHeight: 360, revealNext: true }));
    expect(byTestId(r.root, 'presenter-next')[0]!.props['aria-label']).toBe('Reveal');
  });
});

describe('the rail label fallback (PN-0b N8): a word wider than its room', () => {
  it('a full-rail word over 84 px (Previous at 125 % text, 93 px) asks for the compact rail', async () => {
    const onRailLabels = vi.fn();
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390, onRailLabels }));
    measureWords(r, { full: [55, 70.9, 50.3, 93.4, 69], more: [55] });
    expect(onRailLabels).toHaveBeenLastCalledWith(false);
    // Back at the standard size, the rail asks for the full rail again.
    measureWords(r, WORDS.en);
    expect(onRailLabels).toHaveBeenLastCalledWith(true);
  });

  it('on the compact rail, a More word over 52 px shows the `more` glyph, named by the label', async () => {
    const r = await render(bar({ compact: true, rail: 'compact', railHeight: 390 }));
    expect(labelText(byTestId(r.root, 'presenter-more')[0]!)).toBe('More');
    measureWords(r, { full: [55, 70.9, 50.3, 93.4, 69], more: [55] });
    const more = byTestId(r.root, 'presenter-more')[0]!;
    expect(more.props['aria-label']).toBe('More');
    expect(labelText(more)).toBe('');
    expect(more.props['data-glyph']).toBe('more');
  });

  it('the probe takes no pointer and is hidden from screen readers', async () => {
    const r = await render(bar({ compact: true, rail: 'full', railHeight: 390 }));
    const probe = byTestId(r.root, 'presenter-rail-probe')[0]!;
    expect(probe.props['aria-hidden']).toBe(true);
    expect(flatStyle(probe).pointerEvents ?? probe.props.pointerEvents).toBe('none');
    expect(flatStyle(probe).opacity).toBe('0');
    expect(flatStyle(probe).position).toBe('absolute');
  });
});

// ---- helpers ----

/** The words a button draws (its text nodes), not its accessible name. */
function labelText(node: ReactTestInstance): string {
  return hostNodes(node, (n) => n.props.dir === 'auto')
    .flatMap((n) => n.children.filter((c): c is string => typeof c === 'string'))
    .join(' ');
}

/** A host node's style, flattened from react-native-web's inline style (classes carry the rest). */
function flatStyle(node: ReactTestInstance): Record<string, string | undefined> {
  const style = (node.props.style ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(style).map(([k, v]) => [k, v === undefined ? undefined : String(v)]));
}

function isInside(node: ReactTestInstance, container: ReactTestInstance): boolean {
  for (let at: ReactTestInstance | null = node; at; at = at.parent) if (at === container) return true;
  return false;
}

/** The product of every inline opacity from the node up. */
function opacityUp(node: ReactTestInstance): number {
  let out = 1;
  for (let at: ReactTestInstance | null = node; at; at = at.parent) {
    if (typeof at.type !== 'string') continue;
    const style = (at.props.style ?? {}) as { opacity?: number | string };
    if (style.opacity !== undefined) out *= Number(style.opacity);
  }
  return out;
}
