import { layout, spacing, touchTarget } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { StatusChip } from '../../../logic/lecture/tools';
import { byTestId, hostNodes, press, render } from '../../../test-support/render';
import { ControlBar, type ControlBarProps } from '../ControlBar';
import { PresenterViewProvider } from '../presenter-context';
import { BAR_BAND, BAR_GROUP_GAP, BAR_ROW_GAP, NAV_CLEARANCE, NEXT_MIN_WIDTH, STAGE_PADDING, STATUS_MIN } from '../stage-metrics';

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

// ---- helpers ----

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
