import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { spacePageBack, spaceSubPageBack } from '../page-back';

/** PageBack targets (AMENDMENTS-DISPLAY-NAV section 7.3, row DN-6). */
describe('PageBack targets', () => {
  const en = getMessages('en').console;
  const ko = getMessages('ko').console;

  it('a class or a school page goes back to Classes; a family page to Home', () => {
    expect(spacePageBack('class', en)).toEqual({ href: '/teach/home', label: 'Back to Classes' });
    expect(spacePageBack('school', en)).toEqual({ href: '/teach/home', label: 'Back to Classes' });
    expect(spacePageBack('family', en)).toEqual({ href: '/parent', label: 'Back to Home' });
    expect(spacePageBack('family', ko).label).toBe('돌아가기: 홈');
  });

  it('before the roster names the kind, a /teach/space page counts as a class', () => {
    expect(spacePageBack(undefined, en)).toEqual({ href: '/teach/home', label: 'Back to Classes' });
  });

  it('a page of a space goes back to the space under the prefix of its kind', () => {
    expect(spaceSubPageBack('sp 1', 'class', en.plan.back('Class A'))).toEqual({ href: '/teach/space?id=sp%201', label: 'Back to Class A' });
    expect(spaceSubPageBack('sp_f', 'family', en.settings.back(null))).toEqual({ href: '/parent/space?id=sp_f', label: 'Back to the space' });
    expect(spaceSubPageBack('sp_c', undefined, 'x').href).toBe('/teach/space?id=sp_c');
  });
});
