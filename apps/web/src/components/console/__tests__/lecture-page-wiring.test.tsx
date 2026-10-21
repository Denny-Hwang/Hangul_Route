import { CATALOG, PRESET_LENGTHS, decodeDeck, type LectureDeck, type PlanItem } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanView, RosterLearner } from '@/lib/console/api';
import { aboutMinutes } from '@/lib/console/lecture';
import { consolePresetContext, resolveConsolePreset } from '@/lib/console/lecture-presets';
import Page from '@/app/(console)/teach/space/lecture/page';

/**
 * The lecture setup page's wiring, presets first (AMENDMENTS-LECTURE-V2 sections 4.5, 4.6, 6, 14 and 18, row LV-4):
 * the cards in their order with one open, what it holds and the sticky footer's minutes, the chips re-resolving it,
 * Word review only from `LECTURE_V2_LINKS_FROM` (an injected clock on both sides of the day), `?from=` preselecting
 * Next lesson with the plan's own blocks or the warm-up with the letters to revisit, Customize closed and prefilled,
 * no helper picker, the family words, Slides language absent by default, and Open presenter opening a plain tab whose
 * opener is cut, with a v1 link that names no picker. Rendered with react-test-renderer (the web tests have no DOM).
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <>{children}</> }));
const nav = vi.hoisted(() => ({ router: { replace: () => undefined, push: () => undefined }, params: new URLSearchParams('id=space%3Ac1') }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
}));

const space = (kind: 'class' | 'family') => ({
  id: 'space:c1',
  kind,
  name: kind === 'family' ? 'The Parks' : 'Room 4',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
});

const learner = (displayName: string, summary: Partial<NonNullable<RosterLearner['summary']>> | null = null): RosterLearner => ({
  id: `profile:${displayName}`,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-01T00:00:00.000Z',
  lastActiveAt: '2026-10-14T00:00:00.000Z',
  lastSyncedAt: null,
  summary:
    summary === null
      ? null
      : ({
          lastActiveAt: '2026-10-14T00:00:00.000Z',
          streakDays: 1,
          stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
          cardsUnlocked: 1,
          minutesLast7d: 10,
          jamoRecognized: [],
          needsPractice: [],
          planProgress: {},
          ...summary,
        } as RosterLearner['summary']),
});

const plan = (items: PlanItem[], title = 'Week three'): PlanView => ({
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title,
  items,
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  meta: null,
});

const state = {
  kind: 'class' as 'class' | 'family',
  learners: [] as RosterLearner[],
  joinCode: 'ABC234' as string | null,
  plans: { ok: true, data: [] as PlanView[] } as { ok: true; data: PlanView[] } | { ok: false; error: string },
};

const api = {
  roster: async () => ({ ok: true as const, data: { space: space(state.kind), learners: state.learners, joinCode: state.joinCode, joinCodeExpiresAt: null } }),
  listPlans: async () => state.plans,
};

vi.mock('@/components/console/use-console', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'teacher-kim', displayName: 'Ms Kim' }, api, signOut: () => undefined, m: i18n.getMessages('en'), locale: 'en' }),
  };
});

const en = getMessages('en');
const l = en.console.lecture;
const BEFORE = new Date('2026-10-15T12:00:00.000Z');
const AFTER = new Date('2026-11-02T12:00:00.000Z');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const opened: { url: string; target: string; tab: { opener: unknown } }[] = [];
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'enabled');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(BEFORE);
  vi.stubGlobal('window', {
    open: (url: string, target: string) => {
      const tab = { opener: { postMessage: () => undefined } };
      opened.push({ url, target, tab });
      return tab;
    },
  });
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  state.kind = 'class';
  state.learners = [];
  state.joinCode = 'ABC234';
  state.plans = { ok: true, data: [] };
  nav.params = new URLSearchParams('id=space%3Ac1');
  opened.length = 0;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const all = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const [node] = all(root, id);
  if (!node) throw new Error(`no ${id}`);
  return node;
};
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}
const cards = (root: ReactTestInstance): string[] =>
  root.findAll((n) => n.type === 'li' && String(n.props['data-testid'] ?? '').startsWith('lecture-preset-card-')).map((n) => String(n.props['data-testid']).slice('lecture-preset-card-'.length));
const openCards = (root: ReactTestInstance): string[] =>
  root.findAll((n) => n.type === 'button' && n.props['aria-expanded'] === true && String(n.props['data-testid'] ?? '').startsWith('lecture-preset-')).map((n) => String(n.props['data-testid']).slice('lecture-preset-'.length));
const previewRows = (root: ReactTestInstance): string[] => one(root, 'lecture-preset-preview').findAll((n) => n.type === 'li').map((li) => textOf(li.children[0] as ReactTestInstance));

async function render(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<Page />, { createNodeMock: () => ({ indeterminate: false, focus: () => undefined, getBoundingClientRect: () => ({ height: 96 }) }) });
  });
  if (!mounted) throw new Error('not mounted');
  return mounted.root;
}

async function openCustomize(root: ReactTestInstance): Promise<void> {
  await act(async () => one(root, 'lecture-customize-toggle').props.onClick());
}

function lastDeck(): LectureDeck {
  const url = opened.at(-1)?.url ?? '';
  const decoded = decodeDeck(url.split('#d=')[1] ?? '');
  if (!decoded.ok) throw new Error('no deck');
  return decoded.deck;
}

describe('presets first (section 4.6)', () => {
  it('nothing to follow: Hangul week 1 first and open, Next lesson last, no Word review before LECTURE_V2_LINKS_FROM', async () => {
    const root = await render();
    expect(cards(root)).toEqual(['hangul-week-1', 'by-stage', 'story-time', 'warm-up', 'next-lesson']);
    expect(openCards(root)).toEqual(['hangul-week-1']);
    expect(one(root, 'lecture-preset-hangul-week-1').props['aria-label']).toBe(en.a11y.presenter.presetCard(l.presets.zero.title, 20));
    expect(one(root, 'lecture-preset-hangul-week-1').props['aria-controls']).toBe('lecture-preset-panel-hangul-week-1');
    // Hangul week 1 at 20 minutes: its three lessons and the quiz (section 4.2 H).
    expect(previewRows(root)).toEqual([...CATALOG.cells.find((c) => c.episodeId === 'episode:stage1-letters')!.questIds.map((id) => CATALOG.quests.find((q) => q.id === id)!.title), l.outline.block.quiz(4)]);
    expect(textOf(one(root, 'lecture-footer-minutes'))).toBe(l.outline.about(19));
    expect(one(root, 'open-presenter').props.disabled).toBe(false);
    // Customize is closed: no outline, no Source, no picker of any kind.
    expect(one(root, 'lecture-customize-toggle').props['aria-expanded']).toBe(false);
    expect(all(root, 'lecture-outline')).toHaveLength(0);
  });

  it('from LECTURE_V2_LINKS_FROM the Word review card is there too', async () => {
    vi.setSystemTime(AFTER);
    const root = await render();
    expect(cards(root)).toEqual(['hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up', 'next-lesson']);
  });

  it('a chip re-resolves what the card holds at once; a second press closes the card and keeps the outline', async () => {
    const root = await render();
    await act(async () => one(root, 'lecture-preset-length-hangul-week-1-10').props.onChange());
    expect(previewRows(root)).toHaveLength(2);
    expect(textOf(one(root, 'lecture-footer-minutes'))).toBe(l.outline.about(10));
    await act(async () => one(root, 'lecture-preset-by-stage').props.onClick());
    expect(openCards(root)).toEqual(['by-stage']);
    await act(async () => one(root, 'lecture-preset-stage-stage3').props.onChange());
    const stage3 = resolveConsolePreset('by-stage', 20, 'stage3', consolePresetContext({ roster: { space: space('class'), learners: [] }, plan: null, today: '2026-10-15', now: BEFORE }));
    const first = stage3.blocks[0];
    expect(first?.kind).toBe('quest');
    expect(previewRows(root)[0]).toBe(CATALOG.quests.find((q) => first?.kind === 'quest' && q.id === first.id)?.title);
    expect(previewRows(root)).toHaveLength(stage3.blocks.length);
    await act(async () => one(root, 'lecture-preset-by-stage').props.onClick());
    expect(openCards(root)).toEqual([]);
    expect(one(root, 'open-presenter').props.disabled).toBe(false);
    // The lengths each card offers.
    expect(all(root, 'lecture-preset-length-warm-up')).toHaveLength(0);
    expect(PRESET_LENGTHS['warm-up']).toEqual([10]);
  });

  it('Customize opens on the outline prefilled from the open preset; editing it then choosing another card asks first', async () => {
    const root = await render();
    await openCustomize(root);
    const outline = one(root, 'lecture-outline').findAll((n) => n.type === 'li');
    expect(outline).toHaveLength(4);
    expect(root.findAll((n) => n.type === 'input' && n.props.type === 'radio' && n.props.name === 'source' && n.props.checked).map((n) => n.props.checked)).toEqual([true]);
    expect(one(root, 'lecture-picker-tab-lessons').props['aria-selected']).toBe(true);
    expect(one(root, 'lecture-slides-language').props.value).toBe('');
    // The title follows the preset's name until one is typed.
    expect(root.find((n) => n.type === 'input' && n.props.name === 'title').props.value).toBe(l.presets.zero.short);
    expect(JSON.stringify(mounted?.toJSON())).not.toMatch(/Helper|picker-mode|lecture\.picker/);
    // An edit, then another card: the confirm sheet asks before the outline is replaced.
    await act(async () => one(root, 'lecture-picker-lesson-quest:stage1-letters-q1').props.onChange());
    await act(async () => {
      one(root, 'lecture-preset-warm-up').props.onClick();
    });
    expect(textOf(root)).toContain(l.replaceOutline);
  });
});

describe('?from= preselects (section 4.6)', () => {
  it('from=plan: Next lesson open, the plan\'s own blocks as the outline, the plan title', async () => {
    nav.params = new URLSearchParams('id=space%3Ac1&from=plan&plan=plan%3A1');
    state.plans = { ok: true, data: [plan([{ kind: 'episode', id: 'episode:stage1-life' }, { kind: 'quest', id: 'quest:stage1-nature-q1' }])] };
    const root = await render();
    expect(cards(root)[0]).toBe('next-lesson');
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.next.plan('Week three'));
    expect(previewRows(root)).toHaveLength(2);
    await openCustomize(root);
    expect(root.find((n) => n.type === 'input' && n.props.name === 'title').props.value).toBe('Week three');
    await act(async () => one(root, 'open-presenter').props.onClick());
    const deck = lastDeck();
    expect(deck.blocks).toEqual([{ kind: 'episode', id: 'episode:stage1-life' }, { kind: 'quest', id: 'quest:stage1-nature-q1' }]);
    expect(deck.source).toBe('plan');
    expect(deck.title).toBe('Week three');
  });

  it('from=revisit: the warm-up open with the class\'s letters to revisit', async () => {
    nav.params = new URLSearchParams('id=space%3Ac1&from=revisit');
    state.learners = [learner('Mina', { needsPractice: ['ㅂ', 'ㅅ'] }), learner('Jun', { needsPractice: ['ㅂ'] })];
    const root = await render();
    expect(openCards(root)).toEqual(['warm-up']);
    await act(async () => one(root, 'open-presenter').props.onClick());
    expect(lastDeck().blocks).toEqual([{ kind: 'revisit', chars: ['ㅂ', 'ㅅ'] }]);
    expect(lastDeck().source).toBe('revisit');
  });

  it('no ?from= with a plan this week: Next lesson first, the plan filled to the length', async () => {
    state.plans = { ok: true, data: [plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }])] };
    const root = await render();
    expect(openCards(root)).toEqual(['next-lesson']);
    const ctx = consolePresetContext({ roster: { space: space('class'), learners: [] }, plan: state.plans.ok ? (state.plans.data[0] ?? null) : null, today: '2026-10-15', now: BEFORE });
    expect(textOf(one(root, 'lecture-footer-minutes'))).toBe(l.outline.about(aboutMinutes(resolveConsolePreset('next-lesson', 20, 'stage1', ctx).blocks)));
  });

  it('plans that do not load: the notice stays above the cards, and the cards still work', async () => {
    state.plans = { ok: false, error: 'network' };
    const root = await render();
    expect(textOf(root)).toContain(l.plansFailed);
    expect(openCards(root)).toEqual(['hangul-week-1']);
    expect(one(root, 'open-presenter').props.disabled).toBe(false);
  });
});

describe('the family words (section 6) and the link', () => {
  it('a family space: Next lesson follows the family, the TV check, + Family code and its copy warning', async () => {
    state.kind = 'family';
    state.learners = [learner('Mina', { journey: { v: 1, here: 'stage1', stages: [{ stage: 'stage1', state: 'open', done: 2, known: 0, total: 15 }] } })];
    const root = await render();
    expect(cards(root)[0]).toBe('next-lesson');
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.next.family);
    await openCustomize(root);
    const text = textOf(root);
    expect(text).toContain(l.check.titleFamily);
    expect(text).not.toContain(l.check.title);
    expect(text).toContain(l.outline.addFamilyCode.cta);
    expect(text).not.toContain(l.outline.addClassCode.cta);
    expect(text).toContain(l.titleField.hint);
    expect(text).toContain(l.intro);
  });

  it('a class space keeps the class words', async () => {
    const root = await render();
    await openCustomize(root);
    const text = textOf(root);
    expect(text).toContain(l.check.title);
    expect(text).toContain(l.outline.addClassCode.cta);
  });

  it('Open presenter opens a plain tab and cuts its opener; the deck is v1 with no picker and no slides language', async () => {
    const root = await render();
    await act(async () => one(root, 'open-presenter').props.onClick());
    expect(opened).toHaveLength(1);
    expect(opened[0]?.target).toBe('_blank');
    expect(opened[0]?.tab.opener).toBeNull();
    const deck = lastDeck();
    expect(deck.v).toBe(1);
    expect(deck.picker).toBeNull();
    expect(deck.options.uiLocale).toBeUndefined();
    expect(deck.title).toBe(l.presets.zero.short);
    expect(deck.source).toBe('catalogue');
    expect(deck.preset).toBeUndefined();
  });

  it('a chosen Slides language travels in the deck', async () => {
    const root = await render();
    await openCustomize(root);
    await act(async () => one(root, 'lecture-slides-language').props.onChange({ target: { value: 'ko' } }));
    await act(async () => one(root, 'open-presenter').props.onClick());
    expect(lastDeck().options.uiLocale).toBe('ko');
  });

  it('Word review from LECTURE_V2_LINKS_FROM: a v2 link that names its preset', async () => {
    vi.setSystemTime(AFTER);
    state.plans = { ok: true, data: [plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }])] };
    const root = await render();
    await act(async () => one(root, 'lecture-preset-word-review').props.onClick());
    await act(async () => one(root, 'open-presenter').props.onClick());
    const deck = lastDeck();
    expect(deck.v).toBe(2);
    expect(deck.preset).toBe('word-review');
    expect(deck.title).toBe(l.presets.words.title);
  });
});

describe('review fixes (LV-4 review)', () => {
  const tryAgain = (root: ReactTestInstance): ReactTestInstance => root.find((n) => n.type === 'button' && textOf(n) === en.console.tryAgain);
  const titleInput = (root: ReactTestInstance): ReactTestInstance => root.find((n) => n.type === 'input' && n.props.name === 'title');

  it('nothing to follow: the closed Next lesson card says so in its line, not "Picks up where your class is."', async () => {
    const root = await render();
    expect(openCards(root)).toEqual(['hangul-week-1']);
    const next = one(root, 'lecture-preset-next-lesson');
    expect(textOf(next)).toContain(l.presets.fallback.zero);
    expect(textOf(next)).not.toContain(l.presets.next.class);
    expect(next.props['aria-describedby']).toBe('lecture-preset-line-next-lesson');
    // The cards that can build what they name keep their own lines.
    expect(textOf(one(root, 'lecture-preset-hangul-week-1'))).toContain(l.presets.zero.body);
    expect(all(root, 'lecture-preset-fallback-hangul-week-1')).toHaveLength(0);
  });

  it('after LECTURE_V2_LINKS_FROM with no words: the closed Word review card reads the warm-up fallback', async () => {
    vi.setSystemTime(AFTER);
    const root = await render();
    expect(openCards(root)).toEqual(['hangul-week-1']);
    const words = one(root, 'lecture-preset-word-review');
    expect(textOf(words)).toContain(l.presets.fallback.warmUp);
    expect(textOf(words)).not.toContain(l.presets.words.body);
  });

  it('plans that did not load, an edit, then Try again: the edited outline and the typed title stay', async () => {
    state.plans = { ok: false, error: 'network' };
    const root = await render();
    await openCustomize(root);
    await act(async () => one(root, 'lecture-picker-lesson-quest:stage1-letters-q1').props.onChange());
    await act(async () => titleInput(root).props.onChange({ target: { value: 'Our letters' } }));
    const edited = one(root, 'lecture-outline').findAll((n) => n.type === 'li').length;
    state.plans = { ok: true, data: [plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }])] };
    await act(async () => tryAgain(root).props.onClick());
    expect(textOf(root)).not.toContain(l.plansFailed);
    expect(one(root, 'lecture-outline').findAll((n) => n.type === 'li')).toHaveLength(edited);
    expect(titleInput(root).props.value).toBe('Our letters');
    expect(openCards(root)).toEqual(['hangul-week-1']);
    // The cards' words follow the plan that loaded; nothing asked, nothing replaced.
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.next.plan('Week three'));
    expect(textOf(root)).not.toContain(l.replaceOutline);
  });

  it('plans that did not load, nothing changed, then Try again: the page opens as a first load would', async () => {
    state.plans = { ok: false, error: 'network' };
    const root = await render();
    expect(openCards(root)).toEqual(['hangul-week-1']);
    state.plans = { ok: true, data: [plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }])] };
    await act(async () => tryAgain(root).props.onClick());
    expect(cards(root)[0]).toBe('next-lesson');
    expect(openCards(root)).toEqual(['next-lesson']);
    // A failed retry keeps the notice and the page as it is.
    act(() => mounted?.unmount());
    state.plans = { ok: false, error: 'network' };
    const again = await render();
    await act(async () => tryAgain(again).props.onClick());
    expect(textOf(again)).toContain(l.plansFailed);
  });

  it('a newer plan sent to one learner never becomes the room\'s Next lesson; the plan for everyone does', async () => {
    const everyone = plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }], 'Week three');
    const targeted = { ...plan([{ kind: 'quest', id: 'quest:stage1-nature-q1' }], 'A suggested next step'), id: 'plan:2', targetLearnerIds: ['profile:Mina'], publishedAt: '2026-10-14T09:00:00.000Z' };
    state.plans = { ok: true, data: [everyone, targeted] };
    const root = await render();
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.next.plan('Week three'));
    expect(textOf(root)).not.toContain('A suggested next step');
    // Only a plan for one learner: Next lesson has nothing to follow.
    act(() => mounted?.unmount());
    state.plans = { ok: true, data: [targeted] };
    const alone = await render();
    expect(cards(alone).at(-1)).toBe('next-lesson');
    expect(textOf(one(alone, 'lecture-preset-next-lesson'))).toContain(l.presets.fallback.zero);
  });

  it('?from=plan for a plan sent to one learner presents that plan, as the plan page asked', async () => {
    nav.params = new URLSearchParams('id=space%3Ac1&from=plan&plan=plan%3A2');
    const targeted = { ...plan([{ kind: 'quest', id: 'quest:stage1-nature-q1' }], 'Extra letters'), id: 'plan:2', targetLearnerIds: ['profile:Mina'] };
    state.plans = { ok: true, data: [targeted] };
    const root = await render();
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(previewRows(root)).toHaveLength(1);
  });

  it('?from=plan with more items than a link holds: the open card says how many were left out', async () => {
    nav.params = new URLSearchParams('id=space%3Ac1&from=plan&plan=plan%3A1');
    const items: PlanItem[] = Array.from({ length: 31 }, () => ({ kind: 'quest' as const, id: 'quest:stage1-life-q1' }));
    state.plans = { ok: true, data: [plan(items)] };
    const root = await render();
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(textOf(one(root, 'lecture-preset-note'))).toBe(l.source.trimmed(1, 30));
    // Another card replaces the plan's outline, and the note goes with it.
    await act(async () => one(root, 'lecture-preset-warm-up').props.onClick());
    expect(all(root, 'lecture-preset-note')).toHaveLength(0);
  });

  it('a blocked pop-up and a failed copy answer in the footer, next to the buttons', async () => {
    vi.stubGlobal('window', { open: () => null });
    const root = await render();
    expect(textOf(one(root, 'lecture-footer-status'))).toBe('');
    await act(async () => one(root, 'open-presenter').props.onClick());
    expect(textOf(one(root, 'lecture-footer-status'))).toBe(l.popupBlocked);
    expect(one(root, 'lecture-footer-status').props.role).toBe('status');
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } });
    await act(async () => one(root, 'copy-presenter-link').props.onClick());
    expect(textOf(one(root, 'lecture-footer-status'))).toBe(l.copyFailed);
    // Only the footer says it: no second notice in the page flow.
    expect(root.findAll((n) => typeof n.type === 'string' && textOf(n) === l.copyFailed)).toHaveLength(1);
  });

  it('a name in the title: under the field while Customize is open, in the footer alert once it is closed', async () => {
    state.learners = [learner('Mina')];
    const root = await render();
    await openCustomize(root);
    await act(async () => titleInput(root).props.onChange({ target: { value: 'Mina and friends' } }));
    expect(one(root, 'open-presenter').props.disabled).toBe(true);
    expect(textOf(one(root, 'lecture-footer-alert'))).toBe('');
    expect(root.findAll((n) => n.type === 'p' && n.props.role === 'alert' && textOf(n) === l.titleProblem.name)).toHaveLength(1);
    await openCustomize(root);
    expect(textOf(one(root, 'lecture-footer-alert'))).toBe(l.titleProblem.name);
    expect(one(root, 'lecture-footer-alert').props.role).toBe('alert');
  });
});

describe('review fixes (LV-4 second review)', () => {
  const tryAgain = (root: ReactTestInstance): ReactTestInstance => root.find((n) => n.type === 'button' && textOf(n) === en.console.tryAgain);

  it('a Source that starts with no title, a lesson added, Customize closed: the footer names the missing title', async () => {
    const root = await render();
    await openCustomize(root);
    const [, catalogue] = root.findAll((n) => n.type === 'input' && n.props.name === 'source');
    await act(async () => catalogue!.props.onChange());
    // An empty outline says "nothing" in the status, and no title alert yet.
    expect(textOf(one(root, 'lecture-footer-status'))).toBe(l.nothing);
    await act(async () => one(root, 'lecture-picker-lesson-quest:stage1-letters-q1').props.onChange());
    await openCustomize(root);
    expect(one(root, 'open-presenter').props.disabled).toBe(true);
    expect(textOf(one(root, 'lecture-footer-alert'))).toBe(l.titleProblem.empty);
  });

  it('plans that did not load, a card and a chip, then Try again: the open card resolves again with the plan', async () => {
    state.plans = { ok: false, error: 'network' };
    const root = await render();
    await act(async () => one(root, 'lecture-preset-next-lesson').props.onClick());
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.fallback.zero);
    await act(async () => one(root, 'lecture-preset-length-next-lesson-10').props.onChange());
    state.plans = { ok: true, data: [plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }])] };
    await act(async () => tryAgain(root).props.onClick());
    expect(openCards(root)).toEqual(['next-lesson']);
    expect(one(root, 'lecture-preset-length-next-lesson-10').props.checked).toBe(true);
    // Its line, its preview and the deck all follow the plan now.
    expect(textOf(one(root, 'lecture-preset-next-lesson'))).toContain(l.presets.next.plan('Week three'));
    const ctx = consolePresetContext({ roster: { space: space('class'), learners: [] }, plan: plan([{ kind: 'quest', id: 'quest:stage1-life-q1' }]), today: '2026-10-15', now: BEFORE });
    expect(textOf(one(root, 'lecture-footer-minutes'))).toBe(l.outline.about(aboutMinutes(resolveConsolePreset('next-lesson', 10, 'stage1', ctx).blocks)));
    await act(async () => one(root, 'open-presenter').props.onClick());
    expect(lastDeck().source).toBe('plan');
    expect(lastDeck().title).toBe('Week three');
  });

  it('the open card is named by what it holds once that is not its own outline (?from=revisit)', async () => {
    nav.params = new URLSearchParams('id=space%3Ac1&from=revisit');
    state.learners = [learner('Mina', { needsPractice: ['ㅂ', 'ㅅ'] }), learner('Jun', { needsPractice: ['ㅂ'] })];
    const root = await render();
    expect(openCards(root)).toEqual(['warm-up']);
    const minutes = aboutMinutes([{ kind: 'revisit', chars: ['ㅂ', 'ㅅ'] }]);
    expect(minutes).not.toBe(10);
    expect(textOf(one(root, 'lecture-footer-minutes'))).toBe(l.outline.about(minutes));
    expect(one(root, 'lecture-preset-warm-up').props['aria-label']).toBe(en.a11y.presenter.presetCard(l.presets.warmup.title, minutes));
  });
});
