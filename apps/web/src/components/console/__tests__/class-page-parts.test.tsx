import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { colors, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassActionBar, FirstRunCard, InviteDisclosure } from '@/components/console/ClassPageParts';
import { headRem } from '@/lib/console/rem';

/**
 * AMENDMENTS-GROWNUP-UX GX-7 (section 8 T3 to T5): the class page's action bar with More (a disclosure, not a menu),
 * the Invite students disclosure around the join code (open and hero-size only while the class is empty) and the
 * empty class's three first steps. Rendered with react-test-renderer; every word from the dictionary in en, es and ko.
 */
const view = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: view.locale, messages: getMessages(view.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined }),
  useMessages: () => getMessages(view.locale),
}));

afterEach(() => {
  view.locale = 'en';
});

const LOCALES: UiLocale[] = ['en', 'es', 'ko'];
const textOf = (node: ReactTestInstance): string => node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');

describe('ClassActionBar (T3)', () => {
  const bar = [<a key="plan" data-testid="bar-plan">Plan</a>, <a key="term" data-testid="bar-term">Term plan</a>];
  const more = [<a key="notes" data-testid="more-notes">Notes</a>, <a key="settings" data-testid="more-settings">Settings</a>];

  it.each(LOCALES)('%s: the bar items, then More; More is a disclosure button that is collapsed at first and holds the rest', (locale) => {
    view.locale = locale;
    const r = create(<ClassActionBar bar={bar} more={more} />);
    const root = r.root;
    expect(byTestId(root, 'bar-plan')).toHaveLength(1);
    expect(byTestId(root, 'bar-term')).toHaveLength(1);
    const toggle = byTestId(root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(toggle.type).toBe('button');
    expect(textOf(toggle)).toBe(getMessages(locale).console.space.more);
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(byTestId(root, 'more-notes')).toHaveLength(0);
    expect(byTestId(root, 'class-more')).toHaveLength(0);

    act(() => toggle.props.onClick());
    const panel = byTestId(root, 'class-more')[0] as ReactTestInstance;
    expect(toggle.props['aria-expanded']).toBe(true);
    expect(toggle.props['aria-controls']).toBe(panel.props.id);
    expect(byTestId(panel, 'more-notes')).toHaveLength(1);
    expect(byTestId(panel, 'more-settings')).toHaveLength(1);

    act(() => toggle.props.onClick());
    expect(byTestId(root, 'class-more')).toHaveLength(0);
  });

  it('More is drawn at the console button size and as a secondary button (one size, GX-6)', () => {
    const toggle = byTestId(create(<ClassActionBar bar={bar} more={more} />).root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(toggle.props.style.minHeight).toBe(touchTarget.min);
    expect(toggle.props.style.minWidth).toBe(touchTarget.child);
  });

  it('nudge: More takes the amber look of a waiting count (fill and border), never the danger colour; plain otherwise', () => {
    const nudged = byTestId(create(<ClassActionBar bar={bar} more={more} nudge />).root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(nudged.props.style.backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(nudged.props.style.border).toContain(colors.feedback.nudge);
    expect(JSON.stringify(nudged.props.style)).not.toContain(colors.feedback.danger);
    const plain = byTestId(create(<ClassActionBar bar={bar} more={more} />).root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(String(plain.props.style.border)).not.toContain(colors.feedback.nudge);
  });

  it('with nothing to fold, no More button', () => {
    expect(byTestId(create(<ClassActionBar bar={bar} more={[]} />).root, 'class-more-toggle')).toHaveLength(0);
  });
});

describe('InviteDisclosure (T3, T5)', () => {
  const panel = (hero: boolean) => <div data-testid="code-panel">{hero ? 'hero' : 'display'}</div>;

  it.each(LOCALES)('%s: a class with learners: collapsed, its button says "Invite students · code {code}"; it opens on a tap', (locale) => {
    view.locale = locale;
    const r = create(<InviteDisclosure code="ABC234" empty={false}>{panel}</InviteDisclosure>);
    const toggle = byTestId(r.root, 'invite-toggle')[0] as ReactTestInstance;
    expect(toggle.type).toBe('button');
    expect(textOf(toggle)).toBe(getMessages(locale).console.space.invite('ABC234'));
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(byTestId(r.root, 'code-panel')).toHaveLength(0);
    act(() => toggle.props.onClick());
    expect(toggle.props['aria-expanded']).toBe(true);
    const body = byTestId(r.root, 'invite-body')[0] as ReactTestInstance;
    expect(toggle.props['aria-controls']).toBe(body.props.id);
    expect(textOf(byTestId(r.root, 'code-panel')[0] as ReactTestInstance)).toBe('display');
  });

  it('an empty class: open from the start and the code hero-size', () => {
    const r = create(<InviteDisclosure code="ABC234" empty>{panel}</InviteDisclosure>);
    expect((byTestId(r.root, 'invite-toggle')[0] as ReactTestInstance).props['aria-expanded']).toBe(true);
    expect(textOf(byTestId(r.root, 'code-panel')[0] as ReactTestInstance)).toBe('hero');
  });

  it('no code yet: the button names the missing code with a dash', () => {
    const r = create(<InviteDisclosure code={null} empty={false}>{panel}</InviteDisclosure>);
    expect(textOf(byTestId(r.root, 'invite-toggle')[0] as ReactTestInstance)).toBe(getMessages('en').console.space.invite('—'));
  });

  it('the toggle is at least the touch target tall', () => {
    const r = create(<InviteDisclosure code="ABC234" empty={false}>{panel}</InviteDisclosure>);
    expect((byTestId(r.root, 'invite-toggle')[0] as ReactTestInstance).props.style.minHeight).toBe(touchTarget.min);
  });
});

describe('FirstRunCard (T5)', () => {
  it.each(LOCALES)('%s: a heading and the three steps as an ordered list', (locale) => {
    view.locale = locale;
    const r = create(<FirstRunCard />);
    const m = getMessages(locale).console.space.firstRun;
    const card = byTestId(r.root, 'first-run')[0] as ReactTestInstance;
    expect(textOf(card.findByType('h2'))).toBe(m.title);
    const items = card.findByType('ol').findAllByType('li');
    expect(items.map(textOf)).toEqual([...m.steps]);
    expect(m.steps).toHaveLength(3);
  });

  it('the heading is a section title, not a page title', () => {
    const h2 = create(<FirstRunCard />).root.findByType('h2');
    expect(h2.props.style.fontSize).not.toBe(headRem(typography.size.title));
  });
});
