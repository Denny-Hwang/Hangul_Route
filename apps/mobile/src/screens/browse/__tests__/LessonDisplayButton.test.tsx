import { borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import { describe, expect, it } from 'vitest';
import { lessonDisplayStyle } from '../browse-ui';

/**
 * The Romanization chip sits in the ScreenHeader row (AMENDMENTS-DISPLAY-NAV section 7.1), which wraps only when its
 * controls cannot share one line. A press focuses the chip before it is released; a chip that grew on focus at that
 * edge moved to the next line under the pointer, and the tap did nothing (All lessons at the Pixel 5 width on CI's
 * fonts). browse.spec.ts presses it at that edge; this pins the box.
 */
function box(style: ReturnType<typeof lessonDisplayStyle>): { across: number; down: number } {
  const border = Number(style.borderWidth);
  return { across: 2 * (border + Number(style.paddingHorizontal)), down: 2 * (border + Number(style.paddingVertical)) };
}

describe('lessonDisplayStyle', () => {
  it('is the paper pill with the strong border at rest and the focus colour on focus', () => {
    expect(lessonDisplayStyle(false)).toMatchObject({ minHeight: touchTarget.min, borderWidth: borderWidth.base, borderColor: colors.border.strong, backgroundColor: colors.surface.paper });
    expect(lessonDisplayStyle(true)).toMatchObject({ borderWidth: borderWidth.thick, borderColor: colors.border.focus });
  });

  it('focus keeps the box: border plus padding is the same across and down', () => {
    expect(box(lessonDisplayStyle(true))).toEqual(box(lessonDisplayStyle(false)));
    expect(box(lessonDisplayStyle(undefined))).toEqual({ across: 2 * (borderWidth.base + spacing.lg), down: 2 * borderWidth.thick });
  });
});
