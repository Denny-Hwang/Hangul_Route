import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { colors, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassActionBar, FirstRunCard, InviteDisclosure, RevisitFold } from '@/components/console/ClassPageParts';
import { isCaregiverSafe } from '@/lib/console/banned-text';
import { studentWords } from '@/lib/console/vocab-words';
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

  it('More is always the plain secondary look: a waiting entry is in the bar, never folded (GX-7 review)', () => {
    const toggle = byTestId(create(<ClassActionBar bar={bar} more={more} />).root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(String(toggle.props.style.border ?? '')).not.toContain(colors.feedback.nudge);
    expect(toggle.props.style.backgroundColor).not.toBe(colors.feedback.nudgeLight);
  });

  it('aria-controls only while the panel is mounted, so it never names a missing id', () => {
    const root = create(<ClassActionBar bar={bar} more={more} />).root;
    const toggle = byTestId(root, 'class-more-toggle')[0] as ReactTestInstance;
    expect(toggle.props['aria-controls']).toBeUndefined();
    act(() => toggle.props.onClick());
    expect(toggle.props['aria-controls']).toBe((byTestId(root, 'class-more')[0] as ReactTestInstance).props.id);
    act(() => toggle.props.onClick());
    expect(toggle.props['aria-controls']).toBeUndefined();
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

  it('aria-controls only while the body is mounted', () => {
    const r = create(<InviteDisclosure code="ABC234" empty={false}>{panel}</InviteDisclosure>);
    const toggle = byTestId(r.root, 'invite-toggle')[0] as ReactTestInstance;
    expect(toggle.props['aria-controls']).toBeUndefined();
    act(() => toggle.props.onClick());
    expect(toggle.props['aria-controls']).toBe((byTestId(r.root, 'invite-body')[0] as ReactTestInstance).props.id);
  });

  it('focusMemo: focus inside the old disclosure as it goes away lands on the new one\'s button (the class fills up)', () => {
    const focused: string[] = [];
    const body = { tag: 'body' };
    const inside = { tag: 'copy' };
    const doc = { activeElement: inside as unknown, body };
    vi.stubGlobal('document', doc);
    const memo = { current: false };
    const createNodeMock = (element: { type: unknown; props: Record<string, unknown> }) => {
      if (element.type === 'section') return { contains: (node: unknown) => node === inside };
      if (element.type === 'button') return { focus: () => focused.push(String(element.props['data-testid'])) };
      return null;
    };
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<InviteDisclosure key="empty" code="ABC234" empty focusMemo={memo}>{panel}</InviteDisclosure>, { createNodeMock });
    });
    expect(focused).toEqual([]);
    // The old one goes while focus is on its Copy button; the browser then leaves focus on the body.
    act(() => r.unmount());
    expect(memo.current).toBe(true);
    doc.activeElement = body;
    act(() => {
      r = create(<InviteDisclosure key="learners" code="ABC234" empty={false} focusMemo={memo}>{panel}</InviteDisclosure>, { createNodeMock });
    });
    expect(focused).toEqual(['invite-toggle']);
    expect(memo.current).toBe(false);
    // Focus elsewhere when it goes: nothing is moved.
    doc.activeElement = { tag: 'elsewhere' };
    act(() => r.unmount());
    expect(memo.current).toBe(false);
    act(() => {
      create(<InviteDisclosure code="ABC234" empty={false} focusMemo={memo}>{panel}</InviteDisclosure>, { createNodeMock });
    });
    expect(focused).toEqual(['invite-toggle']);
    vi.unstubAllGlobals();
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

/**
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-2 (section 3.7; tests section 6 item 5): the class card's What to revisit disclosure.
 * Its state lives in the page (by learner id), so the part is controlled: closed it mounts no body, so no jamo and no
 * word of it is in the tree; open it shows the card's "Revisit: ㅂ · ㅅ" line and its "Words to revisit" line, or
 * "Nothing to revisit yet.".
 */
describe('RevisitFold (CO-2)', () => {
  const WORDS = studentWords({ vocab: { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, needsPractice: ['vocab:sagwa-apple', 'vocab:nun-eye'] } }, 'en');
  const fold = (over: Partial<Parameters<typeof RevisitFold>[0]> = {}): JSX.Element => (
    <RevisitFold open={false} onToggle={() => undefined} describedBy="roster-learner-0" jamo={['ㅂ', 'ㅅ']} words={WORDS} {...over} />
  );
  const bodyText = (root: ReactTestInstance): string => textOf(byTestId(root, 'revisit-body')[0] as ReactTestInstance);

  it.each(LOCALES)('%s: closed, a button in the console language and no body: no jamo and no word in the tree', (locale) => {
    view.locale = locale;
    const root = create(fold()).root;
    const toggle = byTestId(root, 'revisit-toggle')[0] as ReactTestInstance;
    expect(toggle.type).toBe('button');
    expect(toggle.props.type).toBe('button');
    expect(textOf(toggle)).toBe(getMessages(locale).console.space.learner.revisitToggle);
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(toggle.props['aria-controls']).toBeUndefined();
    expect(byTestId(root, 'revisit-body')).toHaveLength(0);
    const all = textOf(root);
    expect(all).not.toContain('ㅂ');
    expect(all).not.toContain('sagwa');
    expect(root.findAll((n) => n.props.lang === 'ko')).toHaveLength(0);
  });

  it("open: aria-expanded true, aria-controls names the mounted body, the button is described by the learner's name", () => {
    const root = create(fold({ open: true })).root;
    const toggle = byTestId(root, 'revisit-toggle')[0] as ReactTestInstance;
    const body = byTestId(root, 'revisit-body')[0] as ReactTestInstance;
    expect(toggle.props['aria-expanded']).toBe(true);
    expect(toggle.props['aria-controls']).toBe(body.props.id);
    expect(toggle.props['aria-describedby']).toBe('roster-learner-0');
  });

  it('a press asks the page to toggle', () => {
    const onToggle = vi.fn();
    const root = create(fold({ onToggle })).root;
    act(() => (byTestId(root, 'revisit-toggle')[0] as ReactTestInstance).props.onClick());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('open, the body shows the jamo line (lang ko) and the words line with their romanization and gloss', () => {
    const root = create(fold({ open: true })).root;
    expect(bodyText(root)).toContain('Revisit: ㅂ · ㅅ');
    expect(bodyText(root)).toContain('Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)');
    const langs = (byTestId(root, 'revisit-body')[0] as ReactTestInstance).findAll((n) => n.props.lang === 'ko').map(textOf);
    expect(langs).toEqual(['ㅂ · ㅅ', '사과', '눈']);
    expect(byTestId(root, 'student-words-revisit')).toHaveLength(1);
    // The count line stays outside the fold, with the card.
    expect(byTestId(root, 'student-words')).toHaveLength(0);
  });

  it('open, only the letters or only the words: that line alone', () => {
    expect(bodyText(create(fold({ open: true, words: null })).root)).toBe('Revisit: ㅂ · ㅅ');
    const lettersGone = create(fold({ open: true, jamo: [] })).root;
    expect(bodyText(lettersGone)).toBe('Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)');
    expect(bodyText(lettersGone)).not.toContain('Revisit: ');
  });

  it.each(LOCALES)('%s: open with neither, "Nothing to revisit yet." in the console language', (locale) => {
    view.locale = locale;
    const none = studentWords({ vocab: { collected: 3, strong: 1, topicsStarted: 1, topicsPracticed7d: 1, needsPractice: [] } }, locale);
    for (const words of [null, none]) {
      const root = create(fold({ open: true, jamo: [], words })).root;
      expect(bodyText(root)).toBe(getMessages(locale).console.space.learner.revisitNothing);
    }
  });

  it('is at least the touch target tall, as the console button size (one size, GX-6)', () => {
    const toggle = byTestId(create(fold()).root, 'revisit-toggle')[0] as ReactTestInstance;
    expect(toggle.props.style.minHeight).toBe(touchTarget.min);
  });

  it.each(LOCALES)('%s: the new strings are caregiver-safe and inside the length budgets (CO-2, 8)', (locale) => {
    const words = getMessages(locale).console.space.learner;
    const english = getMessages('en').console.space.learner;
    for (const text of [words.revisitToggle, words.revisitNothing]) {
      expect(isCaregiverSafe(text, locale), text).toBe(true);
      expect(text.trim()).toBe(text);
    }
    // 28-character cta budget for the button; 1.5x the English for the line (packages/i18n length-budget.test.ts).
    expect(words.revisitToggle.length).toBeLessThanOrEqual(28);
    expect(words.revisitToggle.length).toBeLessThanOrEqual(Math.ceil(english.revisitToggle.length * 1.5));
    expect(words.revisitNothing.length).toBeLessThanOrEqual(Math.ceil(english.revisitNothing.length * 1.5));
  });

  it('the copy: What to revisit, and the lecture source\'s own words for nothing', () => {
    expect(getMessages('en').console.space.learner.revisitToggle).toBe('What to revisit');
    expect(getMessages('en').console.space.learner.revisitNothing).toBe(getMessages('en').console.lecture.source.noRevisit);
  });
});
