import { presenter } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { taughtKoreanFont as nativeFont } from '../presenter-font';
import { TAUGHT_KOREAN_STACK, taughtKoreanFont as webFont } from '../presenter-font.web';

/**
 * The presenter font applies to taught Korean on web only (F-TCH-004 section 3.6, PR 3 review
 * note 2): the family exists only through the PWA shell's `@font-face`.
 */
describe('taught Korean font', () => {
  it('the native style omits the family', () => {
    expect(nativeFont()).toEqual({});
    expect(nativeFont()).not.toHaveProperty('fontFamily');
  });

  it('web names the bundled subset first and falls back to the system stack', () => {
    expect(webFont()).toEqual({ fontFamily: TAUGHT_KOREAN_STACK });
    expect(TAUGHT_KOREAN_STACK.startsWith(`"${presenter.font}",`)).toBe(true);
  });
});
