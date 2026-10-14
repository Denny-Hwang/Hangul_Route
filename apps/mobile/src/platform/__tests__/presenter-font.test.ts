import { presenter } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { taughtKoreanFont as nativeFont } from '../presenter-font';
import { taughtKoreanFont as webFont, taughtKoreanStack } from '../presenter-font.web';

/**
 * The presenter font applies to taught Korean on web only (F-TCH-004 section 3.6, PR 3 review
 * note 2): the family exists only through the PWA shell's `@font-face`.
 */
describe('taught Korean font', () => {
  it('the native style omits the family', () => {
    expect(nativeFont(presenter.font)).toEqual({});
    expect(nativeFont(presenter.font)).not.toHaveProperty('fontFamily');
  });

  it('web names the bundled subset first and falls back to the system stack', () => {
    expect(webFont(presenter.font)).toEqual({ fontFamily: '"HR Presenter KR", system-ui, sans-serif' });
    expect(taughtKoreanStack(presenter.font).startsWith(`"${presenter.font}",`)).toBe(true);
  });
});
