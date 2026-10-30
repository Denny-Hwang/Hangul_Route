import { layout, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import {
  DOCKED_TOOLS,
  MORE_TOOLS,
  WIDE_TOUCH_MIN,
  bandTools,
  dockedBarLayout,
  dockedBarMeasured,
  dockedOrder,
  moreTools,
  toolsWidth,
  wideTouchWindow,
  type DockedBarFit,
  type DockedTool,
} from '../bar-layout';
import { STATUS_MIN_REM } from '../stage-constants';

const HERO = touchTarget.hero;
const NEXT = 1.5 * HERO;
const STATUS_MIN = STATUS_MIN_REM * typography.size.bodySm;
/** The band's side padding (`layout.gutter.regular` each side). */
const roomOf = (windowWidth: number): number => windowWidth - 2 * layout.gutter.regular;

/**
 * Tool widths as PN-0b measured them (stage-and-bar.md "Navigation (PN-0b)", the More fallback): the
 * English tools row is 635 px, the Korean 622, the Spanish 744 (Pantalla completa, Diapositivas and
 * Temporizador widen their buttons). Each list sums to that with five `spacing.sm` gaps.
 */
const EN: Record<DockedTool, number> = { exit: HERO, fullscreen: 115, grid: HERO, blank: HERO, timer: HERO, sound: HERO };
const KO: Record<DockedTool, number> = { exit: HERO, fullscreen: 102, grid: HERO, blank: HERO, timer: HERO, sound: HERO };
const ES: Record<DockedTool, number> = { exit: HERO, fullscreen: 144, grid: 130, blank: HERO, timer: 142, sound: HERO };

function fit(windowWidth: number, tools: Record<DockedTool, number>, present: readonly DockedTool[] = DOCKED_TOOLS): DockedBarFit {
  return { room: roomOf(windowWidth), prev: HERO, next: NEXT, tools, present, statusMin: STATUS_MIN, gap: spacing.lg, toolGap: spacing.sm };
}

describe('the docked bar order (AMENDMENTS-PRESENTER-NAV section 5.1, O6 and O9)', () => {
  it('lists the tools Exit, Full screen, Slides, Blank, Timer, Sound: Sound sits between Exit and Next', () => {
    expect(DOCKED_TOOLS).toEqual(['exit', 'fullscreen', 'grid', 'blank', 'timer', 'sound']);
    expect(DOCKED_TOOLS[DOCKED_TOOLS.length - 1]).toBe('sound');
  });

  it('O6: Previous first and Next last; the chips and the tools between them', () => {
    expect(dockedOrder({ rows: 1, more: false }, false)).toEqual(['prev', 'chips', 'tools', 'next']);
    expect(dockedOrder({ rows: 2, more: false }, false)).toEqual(['prev', 'chips', 'tools', 'next']);
  });

  it('O9: on a wide touch window Previous sits just before Next', () => {
    expect(dockedOrder({ rows: 1, more: false }, true)).toEqual(['chips', 'tools', 'prev', 'next']);
  });

  it('the More fallback keeps the step pair first and last for focus: More just before Next, or before Previous under O9', () => {
    expect(dockedOrder({ rows: 2, more: true }, false)).toEqual(['prev', 'chips', 'tools', 'more', 'next']);
    expect(dockedOrder({ rows: 2, more: true }, true)).toEqual(['chips', 'tools', 'more', 'prev', 'next']);
  });

  it('a wide touch window is touch seen at WIDE_TOUCH_MIN (1600) px or wider', () => {
    expect(WIDE_TOUCH_MIN).toBe(1600);
    expect(wideTouchWindow(1600, true)).toBe(true);
    expect(wideTouchWindow(1599, true)).toBe(false);
    expect(wideTouchWindow(1920, false)).toBe(false);
  });
});

describe('the wrap rule, on the windows PN-0b measured', () => {
  it.each([
    ['1180 x 820, en: one row', 1180, EN, { rows: 1, more: false }],
    ['1180 x 820, ko: one row', 1180, KO, { rows: 1, more: false }],
    ['1180 x 820, es: the tools wrap above', 1180, ES, { rows: 2, more: false }],
    ['1920 x 1080, es: one row', 1920, ES, { rows: 1, more: false }],
    ['1024 x 768, en: wrapped', 1024, EN, { rows: 2, more: false }],
    ['1080 x 810, en: wrapped', 1080, EN, { rows: 2, more: false }],
    ['1133 x 744, en: wrapped', 1133, EN, { rows: 2, more: false }],
    ['820 x 1180, en: wrapped', 820, EN, { rows: 2, more: false }],
    ['820 x 1180, es: wrapped (744 of 772 px)', 820, ES, { rows: 2, more: false }],
    ['768 x 1024, en: wrapped (635 of 720 px)', 768, EN, { rows: 2, more: false }],
    ['768 x 1024, ko: wrapped (622 of 720 px)', 768, KO, { rows: 2, more: false }],
    ['768 x 1024, es: More (744 of 720 px)', 768, ES, { rows: 2, more: true }],
    ['744 x 1133, es: More (744 of 696 px)', 744, ES, { rows: 2, more: true }],
  ] as const)('%s', (_label, width, tools, expected) => {
    expect(dockedBarLayout(fit(width, tools))).toEqual(expected);
  });

  it('measures the PN-0b tools rows: en 635, ko 622, es 744 px', () => {
    expect(toolsWidth(DOCKED_TOOLS, EN, spacing.sm)).toBe(635);
    expect(toolsWidth(DOCKED_TOOLS, KO, spacing.sm)).toBe(622);
    expect(toolsWidth(DOCKED_TOOLS, ES, spacing.sm)).toBe(744);
  });

  it('one row holds Previous, the chips basis, the tools and Next exactly; one px more wraps', () => {
    const tools = toolsWidth(DOCKED_TOOLS, EN, spacing.sm)!;
    const exact = HERO + STATUS_MIN + tools + NEXT + 3 * spacing.lg;
    const at = (room: number) => dockedBarLayout({ ...fit(0, EN), room });
    expect(at(exact)).toEqual({ rows: 1, more: false });
    expect(at(exact - 1)).toEqual({ rows: 2, more: false });
    expect(at(tools)).toEqual({ rows: 2, more: false });
    expect(at(tools - 1)).toEqual({ rows: 2, more: true });
  });

  it('a browser without full screen counts no Full screen button', () => {
    const present = DOCKED_TOOLS.filter((t) => t !== 'fullscreen');
    expect(toolsWidth(present, ES, spacing.sm)).toBe(744 - 144 - spacing.sm);
    // Spanish at 768 x 1024 then fits two rows without More.
    expect(dockedBarLayout(fit(768, ES, present))).toEqual({ rows: 2, more: false });
  });

  it('lays out one row until every control is measured', () => {
    const { timer: _timer, ...partial } = ES;
    expect(dockedBarLayout(fit(744, partial as Record<DockedTool, number>))).toEqual({ rows: 1, more: false });
    expect(dockedBarLayout({ ...fit(744, ES), prev: undefined })).toEqual({ rows: 1, more: false });
    expect(dockedBarLayout({ ...fit(744, ES), next: undefined })).toEqual({ rows: 1, more: false });
    expect(dockedBarLayout({ ...fit(744, ES), room: 0 })).toEqual({ rows: 1, more: false });
    expect(dockedBarLayout({ ...fit(744, ES), room: Number.NaN })).toEqual({ rows: 1, more: false });
    expect(dockedBarMeasured(fit(744, ES))).toBe(true);
    expect(dockedBarMeasured({ ...fit(744, ES), room: 0 })).toBe(false);
    expect(dockedBarMeasured({ ...fit(744, ES), next: undefined })).toBe(false);
    expect(dockedBarMeasured(fit(744, partial as Record<DockedTool, number>))).toBe(false);
  });
});

describe('More (the wrapped band fallback)', () => {
  it('takes Timer, Blank and Slides; the band keeps Exit, Full screen and Sound', () => {
    expect([...MORE_TOOLS].sort()).toEqual(['blank', 'grid', 'timer']);
    expect(bandTools(DOCKED_TOOLS, true)).toEqual(['exit', 'fullscreen', 'sound']);
    expect(bandTools(DOCKED_TOOLS, false)).toEqual(DOCKED_TOOLS);
  });

  it('its sheet lists Slides, Timer, Blank, as the phone sheet does', () => {
    expect(moreTools(DOCKED_TOOLS)).toEqual(['grid', 'timer', 'blank']);
    expect(moreTools(['exit', 'sound'])).toEqual([]);
  });

  it('an empty tools row is 0 px wide', () => {
    expect(toolsWidth([], EN, spacing.sm)).toBe(0);
  });
});
