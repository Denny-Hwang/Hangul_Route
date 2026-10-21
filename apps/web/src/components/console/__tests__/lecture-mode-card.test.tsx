import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LectureCardView } from '@/lib/console/lecture-entry';

/**
 * AMENDMENTS-LECTURE-V2 E1 and E2 (row LV-5; design/screens/app-shell/lecture-card.md): the Lecture mode card on the
 * two homes. One space opens its setup page, several give the radio rows and Start follows the choice, none opens the
 * presenter in a new tab described as such, loading waits; nothing is drawn while the flag is off (view null); the
 * card answers `#lecture-mode` once it has its place.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const locale = vi.hoisted(() => ({ value: 'en' as 'en' | 'es' | 'ko' }));
vi.mock('../use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return { useConsole: () => ({ m: messages(locale.value), locale: locale.value }) };
});

import { LectureModeCard } from '../LectureModeCard';

const en = getMessages('en');
const card = en.console.lecture.card;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  locale.value = 'en';
  vi.unstubAllGlobals();
});

interface NodeCalls {
  focused: number;
  scrolled: unknown[];
}

function render(view: LectureCardView | null, persona: 'teacher' | 'parent' = 'teacher', revealReady = true, calls?: NodeCalls): ReactTestRenderer {
  act(() => {
    mounted = create(<LectureModeCard view={view} persona={persona} revealReady={revealReady} />, {
      createNodeMock: (element) =>
        element.type === 'h2'
          ? { focus: () => calls && (calls.focused += 1) }
          : element.type === 'section'
            ? { scrollIntoView: (options: unknown) => calls?.scrolled.push(options) }
            : null,
    });
  });
  return mounted as unknown as ReactTestRenderer;
}

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance | undefined => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string')[0];
const start = (r: ReactTestRenderer): ReactTestInstance => byTestId(r, 'lecture-card-start') as ReactTestInstance;
const allText = (r: ReactTestRenderer): string => textOf(r.root);

describe('LectureModeCard', () => {
  it('draws nothing while lectureModeEnabled() is off (view null)', () => {
    const r = render(null);
    expect(r.toJSON()).toBeNull();
  });

  it('one class: the section 12.1 words, Start a link to the class setup page, no choice and no no-space line', () => {
    const r = render({ state: 'one', href: '/teach/space/lecture?id=sp_c' });
    const section = byTestId(r, 'lecture-card') as ReactTestInstance;
    expect(section.type).toBe('section');
    expect(section.props.id).toBe('lecture-mode');
    const heading = section.findByType('h2');
    expect(textOf(heading)).toBe(card.title);
    expect(heading.props.tabIndex).toBe(-1);
    expect(section.props['aria-labelledby']).toBe(heading.props.id);
    expect(allText(r)).toContain(card.tagline);
    expect(allText(r)).toContain(card.bodyClass);
    expect(allText(r)).not.toContain(card.bodyFamily);
    expect(start(r).type).toBe('a');
    expect(start(r).props.href).toBe('/teach/space/lecture?id=sp_c');
    expect(start(r).props.target).toBeUndefined();
    expect(textOf(start(r))).toBe(card.cta);
    expect(byTestId(r, 'lecture-card-choices')).toBeUndefined();
    expect(byTestId(r, 'lecture-card-no-space')).toBeUndefined();
  });

  it('a family reads the family body line', () => {
    const r = render({ state: 'one', href: '/parent/space/lecture?id=sp_f' }, 'parent');
    expect(allText(r)).toContain(card.bodyFamily);
    expect(allText(r)).not.toContain(card.bodyClass);
  });

  it('several spaces: "Which class?" radio rows in the given order, the first chosen; Start follows the choice', () => {
    const r = render({
      state: 'several',
      choices: [
        { id: 'sp_b', name: 'Saturday class', href: '/teach/space/lecture?id=sp_b' },
        { id: 'sp_a', name: 'Beginners B', href: '/teach/space/lecture?id=sp_a' },
      ],
    });
    const group = byTestId(r, 'lecture-card-choices') as ReactTestInstance;
    expect(group.type).toBe('fieldset');
    expect(textOf(group.findByType('legend'))).toBe(card.chooseClass);
    const radios = group.findAll((n) => n.type === 'input');
    expect(radios.map((n) => [n.props.type, n.props.value, n.props.checked])).toEqual([
      ['radio', 'sp_b', true],
      ['radio', 'sp_a', false],
    ]);
    expect(new Set(radios.map((n) => n.props.name)).size).toBe(1);
    expect(group.findAll((n) => n.type === 'label').map(textOf)).toEqual(['Saturday class', 'Beginners B']);
    expect(start(r).props.href).toBe('/teach/space/lecture?id=sp_b');
    act(() => {
      (byTestId(r, 'lecture-card-choice-sp_a') as ReactTestInstance).props.onChange();
    });
    expect(start(r).props.href).toBe('/teach/space/lecture?id=sp_a');
    expect((byTestId(r, 'lecture-card-choice-sp_a') as ReactTestInstance).props.checked).toBe(true);
    expect((byTestId(r, 'lecture-card-choice-sp_b') as ReactTestInstance).props.checked).toBe(false);
    // The chosen row has the thick outline (shape, not colour alone).
    expect(group.findAll((n) => n.type === 'label').map((n) => n.props.className)).toEqual(['hr-lm-choice', 'hr-lm-choice hr-lm-on']);
  });

  it('several families ask "Which family?"', () => {
    const r = render(
      {
        state: 'several',
        choices: [
          { id: 'sp_f', name: 'Kim family', href: '/parent/space/lecture?id=sp_f' },
          { id: 'sp_g', name: "Grandma's house", href: '/parent/space/lecture?id=sp_g' },
        ],
      },
      'parent',
    );
    expect(textOf((byTestId(r, 'lecture-card-choices') as ReactTestInstance).findByType('legend'))).toBe(card.chooseFamily);
  });

  it('no class: the no-space line, and Start opens the presenter in a new tab with no opener, described so', () => {
    const r = render({ state: 'none', href: 'https://app.hangulroute.com/present' });
    expect(textOf(byTestId(r, 'lecture-card-no-space') as ReactTestInstance)).toBe(card.noSpace);
    const link = start(r);
    expect(link.props.href).toBe('https://app.hangulroute.com/present');
    expect(link.props.target).toBe('_blank');
    expect(link.props.rel).toBe('noopener noreferrer');
    const note = r.root.find((n) => typeof n.type === 'string' && n.props.id === link.props['aria-describedby']);
    expect(textOf(note)).toBe(card.opensTab);
  });

  it('no family: the family no-space line', () => {
    const r = render({ state: 'none', href: 'https://app.hangulroute.com/present' }, 'parent');
    expect(textOf(byTestId(r, 'lecture-card-no-space') as ReactTestInstance)).toBe(card.noSpaceFamily);
  });

  it('loading: the words at once, Start disabled and busy as "Loading…"; never disabled otherwise', () => {
    const r = render({ state: 'loading' });
    expect(allText(r)).toContain(card.title);
    expect(allText(r)).toContain(card.bodyClass);
    expect(start(r).type).toBe('button');
    expect(start(r).props.disabled).toBe(true);
    expect(start(r).props['aria-busy']).toBe('true');
    expect(textOf(start(r))).toBe(en.console.space.loading);
    for (const view of [
      { state: 'one', href: '/x' },
      { state: 'none', href: '/present' },
    ] as const) {
      act(() => mounted?.unmount());
      expect(render(view).root.findAll((n) => n.props.disabled === true)).toHaveLength(0);
    }
  });

  it('draws the UI language (Korean)', () => {
    locale.value = 'ko';
    const r = render({ state: 'one', href: '/x' });
    const ko = getMessages('ko').console.lecture.card;
    expect(allText(r)).toContain(ko.title);
    expect(allText(r)).toContain(ko.tagline);
    expect(textOf(start(r))).toBe(ko.cta);
  });

  /** A window whose address holds `#lecture-mode` until the card takes it off (`history.replaceState`). */
  function fragmentWindow(): { listeners: Record<string, () => void>; location: { hash: string; pathname: string; search: string }; replaced: unknown[][] } {
    const listeners: Record<string, () => void> = {};
    const location = { hash: '#lecture-mode', pathname: '/parent', search: '' };
    const replaced: unknown[][] = [];
    vi.stubGlobal('window', {
      location,
      history: {
        state: { router: 'kept' },
        replaceState: (...args: unknown[]) => {
          replaced.push(args);
          location.hash = String(args[2]).includes('#') ? String(args[2]).slice(String(args[2]).indexOf('#')) : '';
        },
      },
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      removeEventListener: (type: string) => delete listeners[type],
    });
    return { listeners, location, replaced };
  }

  it('with #lecture-mode it scrolls into view and focuses its heading once it has its place', () => {
    const { listeners, location, replaced } = fragmentWindow();
    const calls: NodeCalls = { focused: 0, scrolled: [] };
    // Not yet: still loading, or the page says its place can still move.
    render({ state: 'loading' }, 'parent', true, calls);
    act(() => mounted?.unmount());
    render({ state: 'one', href: '/x' }, 'parent', false, calls);
    expect(calls).toEqual({ focused: 0, scrolled: [] });
    act(() => mounted?.unmount());
    render({ state: 'one', href: '/x' }, 'parent', true, calls);
    expect(calls.focused).toBe(1);
    expect(calls.scrolled).toEqual([{ block: 'start' }]);
    // The arrival is answered: the fragment leaves the address, the router's history state kept.
    expect(replaced).toEqual([[{ router: 'kept' }, '', '/parent']]);
    expect(location.hash).toBe('');
    // The frame sets the fragment again on this page: the card answers the hashchange.
    location.hash = '#lecture-mode';
    act(() => listeners.hashchange?.());
    expect(calls.focused).toBe(2);
    expect(location.hash).toBe('');
  });

  it('answers each arrival once: a remount or a redraw after it (the card moving at 70em, a Try again) takes no focus', () => {
    const { listeners } = fragmentWindow();
    const calls: NodeCalls = { focused: 0, scrolled: [] };
    render({ state: 'one', href: '/x' }, 'parent', true, calls);
    expect(calls.focused).toBe(1);
    // A Try again: loading, then ready again, in the same card.
    act(() => mounted?.update(<LectureModeCard view={{ state: 'loading' }} persona="parent" />));
    act(() => mounted?.update(<LectureModeCard view={{ state: 'one', href: '/x' }} persona="parent" />));
    // A move to another slot: a new card.
    act(() => mounted?.unmount());
    render({ state: 'one', href: '/x' }, 'parent', true, calls);
    // A hashchange to some other fragment.
    act(() => listeners.hashchange?.());
    expect(calls).toEqual({ focused: 1, scrolled: [{ block: 'start' }] });
  });

  it('a page that holds the choice keeps it across a remount (chosen / onChoose)', () => {
    vi.stubGlobal('window', { location: { hash: '' }, addEventListener: () => undefined, removeEventListener: () => undefined });
    const view: LectureCardView = {
      state: 'several',
      choices: [
        { id: 'sp_a', name: 'A', href: '/a' },
        { id: 'sp_b', name: 'B', href: '/b' },
      ],
    };
    const chosen: string[] = [];
    act(() => {
      mounted = create(<LectureModeCard view={view} persona="parent" chosen={null} onChoose={(id) => chosen.push(id)} />);
    });
    let r = mounted as unknown as ReactTestRenderer;
    expect(start(r).props.href).toBe('/a');
    act(() => (byTestId(r, 'lecture-card-choice-sp_b') as ReactTestInstance).props.onChange());
    expect(chosen).toEqual(['sp_b']);
    // The page's own value draws, on a new card as on the old one.
    act(() => mounted?.unmount());
    act(() => {
      mounted = create(<LectureModeCard view={view} persona="parent" chosen="sp_b" onChoose={(id) => chosen.push(id)} />);
    });
    r = mounted as unknown as ReactTestRenderer;
    expect(start(r).props.href).toBe('/b');
    expect((byTestId(r, 'lecture-card-choice-sp_b') as ReactTestInstance).props.checked).toBe(true);
  });

  it('the family body says once that nobody\'s progress changes, in every UI language (section 3)', () => {
    for (const value of ['en', 'es', 'ko'] as const) {
      locale.value = value;
      const r = render({ state: 'one', href: '/x' }, 'parent');
      const c = getMessages(value).console.lecture.card;
      expect(allText(r)).toContain(c.bodyFamily);
      act(() => mounted?.unmount());
    }
    expect(getMessages('en').console.lecture.card.bodyFamily).toMatch(/nobody's progress changes/);
    expect(getMessages('es').console.lecture.card.bodyFamily).toMatch(/no cambia el progreso de nadie/);
    expect(getMessages('ko').console.lecture.card.bodyFamily).toMatch(/누구의 진도도 바뀌지 않아요/);
  });

  it('without the fragment it moves nothing', () => {
    vi.stubGlobal('window', { location: { hash: '' }, addEventListener: () => undefined, removeEventListener: () => undefined });
    const calls: NodeCalls = { focused: 0, scrolled: [] };
    render({ state: 'one', href: '/x' }, 'teacher', true, calls);
    expect(calls).toEqual({ focused: 0, scrolled: [] });
  });
});
