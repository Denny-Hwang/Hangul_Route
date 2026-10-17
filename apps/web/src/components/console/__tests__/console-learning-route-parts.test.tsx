import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrownUpRouteCard, LearningRouteContent, LearningRouteLoading, RouteGoalLine } from '@/components/console/LearningRouteParts';
import { learningRouteView, type LearningRouteInput, type LearningRouteReady, type LearningRouteView } from '@/lib/console/learning-route-view';
import { ROUTES } from '@/lib/console/routing';
import { ROUTE_CATALOG, TODAY, learner, meta, placement, plan, quest, stageTitle, summary } from '@/lib/console/__tests__/fixtures/learning-route';
import { expectAllPseudo } from './pseudo-text';

/**
 * Learning Route LR-8 (amendment section 6.1; screen spec `design/screens/learning-route/stage-list.md`,
 * mocks `stage-list-family.html`, `stage-list-class.html`, `stage-list-states.html`): the grown-up route
 * card and the stage list page body, rendered from LR-7's view model. Rendered in English for the exact
 * words and in the pseudo-locale (en-XA) to prove every word comes from the dictionary.
 */
const PSEUDO = 'en-XA' as UiLocale;
const view = { locale: 'en' as UiLocale };

vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: view.locale, messages: getMessages(view.locale), available: ['en'], setLocale: () => undefined }),
  useMessages: () => getMessages(view.locale),
  useLocale: () => view.locale,
}));

// next/link needs the app router's context; a plain anchor keeps its href and its children.
vi.mock('next/link', () => ({
  default: ({ href, children, style }: { href: string; children: ReactNode; style?: object }) => (
    <a href={href} style={style}>
      {children}
    </a>
  ),
}));

// The formatters take UI locales only: under en-XA the console draws dates in English.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

// Several describe blocks render at collection time, before any beforeEach runs, so the
// time zone is pinned here as well; afterEach restores it and beforeEach pins it again.
vi.stubEnv('TZ', 'UTC');
beforeEach(() => {
  vi.stubEnv('TZ', 'UTC');
});
afterEach(() => {
  view.locale = 'en';
  vi.unstubAllEnvs();
});

const en = getMessages('en');
const lr = en.console.learningRoute;
const canDo = en.learner.myRoute.stage.canDo;

const build = (over: Partial<LearningRouteInput> = {}, locale: UiLocale = 'en'): LearningRouteView => {
  const v = learningRouteView({
    space: { id: 'space:fam', kind: 'family' },
    learners: [learner()],
    learnerId: 'learner:sam',
    plans: [],
    today: TODAY,
    stageTitle,
    catalog: ROUTE_CATALOG,
    locale,
    ...over,
  });
  if (v === null) throw new Error('no view');
  return v;
};
const ready = (over: Partial<LearningRouteInput> = {}, locale: UiLocale = 'en'): LearningRouteReady => {
  const v = build(over, locale);
  if (v.status !== 'ready') throw new Error(`expected ready, got ${v.status}`);
  return v;
};

const decode = (s: string): string => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const textOf = (html: string): string => decode(html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const render = (v: LearningRouteView): string => renderToStaticMarkup(<LearningRouteContent view={v} />);
const between = (html: string, start: string, end: string): string => html.slice(html.indexOf(start), end ? html.indexOf(end, html.indexOf(start)) : undefined);

/** The family mock: Sam on Stage 1, the class's plan leads to Stage 2, this family's own plan reaches Stage 1 (Dec 20). */
const familyCase1 = (): LearningRouteReady =>
  ready({
    learners: [learner({ summary: summary({ placement: placement('stage1', 2), routeGoal: { stage: 'stage2', from: 'class' } }) })],
    plans: [plan({ id: 'plan:fam', items: [quest('quest:stage1-letters-q1')], meta: meta('2026-10-05', 11) })],
  });

/** The class mock: Mina on Stage 2 (started there), the class plan reaches Stage 1, which she knows. */
const classCase2 = (): LearningRouteReady =>
  ready({
    space: { id: 'space:class', kind: 'class' },
    learnerId: 'learner:mina',
    learners: [
      learner({
        id: 'learner:mina',
        displayName: 'Mina',
        summary: summary({
          placement: placement('stage2', 0),
          journey: {
            v: 1,
            here: 'stage2',
            seeded: true,
            stages: [
              { stage: 'stage1', state: 'known', done: 0, known: 11, total: 11 },
              { stage: 'stage2', state: 'open', done: 1, known: 0, total: 2 },
              { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
              { stage: 'stage4', state: 'open', done: 0, known: 0, total: 1 },
              { stage: 'stage5', state: 'later', done: 0, known: 0, total: 0 },
              { stage: 'stage6', state: 'later', done: 0, known: 0, total: 0 },
              { stage: 'stage7', state: 'later', done: 0, known: 0, total: 0 },
            ],
          },
        }),
      }),
    ],
    plans: [plan({ id: 'plan:class', items: [quest('quest:stage1-letters-q1')], meta: meta('2026-10-05', 11) })],
  });

describe('the stage list page, family case 1 (mock stage-list-family.html)', () => {
  const v = familyCase1();
  const html = render(v);
  const text = textOf(html);

  it('reads top to bottom: heading, updated date, the card, then "Stages" and the list (the way back is the frame\'s PageBack)', () => {
    const order = [lr.title('Sam'), lr.updated('Oct 11'), lr.now('Sam', 1, 'Hangul'), lr.stagesTitle, '1. Hangul'];
    const at = order.map((s) => text.indexOf(s));
    for (const i of at) expect(i).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain(`<h1`);
    expect(html).toMatch(/<h1[^>]*>Sam&#x27;s Learning Route<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Stages<\/h2>/);
  });

  it('goes back to the space until the report exists (the page hands view.back to the frame\'s PageBack)', () => {
    expect(v.back).toEqual({ href: ROUTES.space('space:fam', 'family'), text: lr.back.family });
    expect(html).not.toContain('href="/parent/space?id=space%3Afam"');
  });

  it('draws the card as a section labelled "Learning Route" with every line of case 1', () => {
    const card = between(html, '<section aria-label="Learning Route"', '</section>');
    const cardText = textOf(card);
    expect(card.length).toBeGreaterThan(0);
    expect(cardText).toBe(
      [lr.now('Sam', 1, 'Hangul'), lr.learnerGoal('Sam', 2, 'Words'), lr.fromLead.class, lr.canDoLead('Sam'), canDo[2], lr.planReaches.family(1, 'Hangul'), lr.planEnds('Dec 20')].join(' '),
    );
    // The pin glyph on the Now line, the flag on the goal line: decoration only.
    expect(card.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2);
    expect(card).toContain('<hr');
  });

  it('lists the stages as an ol of li rows: shape, name and state word, can-do line, count line and tags', () => {
    const list = between(html, '<ol', '</ol>');
    // An unstyled list keeps its list semantics in WebKit only with an explicit role (section 10).
    expect(list).toMatch(/^<ol role="list"/);
    expect(list.match(/<li/g)).toHaveLength(5);
    const rows = list.split('<li').slice(1).map((r) => textOf(`<li${r}`));
    expect(rows[0]).toBe(`1. Hangul · Open ${canDo[1]} 4 known from the level check, 2 quests done ${lr.hereTag('Sam')} ${lr.startTag('Sam')}`);
    expect(rows[1]).toBe(`2. Words · A taste ${canDo[2]} ${lr.goalTag('Sam')}`);
    expect(rows[2]).toBe('3. Sentences · Coming later');
    expect(rows[3]).toBe(`4. Dialogue · A taste ${canDo[4]} 1 quest done`);
    expect(rows[4]).toBe('Stages 5 to 7: Coming later');
    // Every row carries its drawn shape, hidden from screen readers.
    for (const row of list.split('<li').slice(1)) expect(row).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('never shows a total, a zero count, a percentage, the Preview slot, a price or a billing link', () => {
    expect(text).not.toMatch(/\d+ ?\/ ?\d+|\bof \d|\b0 quests?\b|%/);
    expect(text).not.toContain('Preview lessons');
    expect(html).not.toMatch(/billing|\$\d/i);
    // No link of its own: the way back is the frame's PageBack.
    expect(html.match(/<a /g)).toBeNull();
  });
});

describe('the stage list page, class case 2 (mock stage-list-class.html)', () => {
  const html = render(classCase2());
  const card = between(html, '<section aria-label="Learning Route"', '</section>');

  it('words the goal about the plan, with its end and "reached this stage", and no can-do line once reached', () => {
    expect(textOf(card)).toBe([lr.now('Mina', 2, 'Words'), lr.planReaches.class(1, 'Hangul'), lr.planEnds('Dec 20'), lr.stageReached('Mina')].join(' '));
    expect(textOf(card)).not.toContain("Mina's goal");
    expect(card).not.toContain('<hr');
  });

  it('tags the plan goal and the start stage with their glyphs, and the way back reads "Back to the class"', () => {
    const list = between(html, '<ol', '</ol>');
    const rows = list.split('<li').slice(1).map((r) => `<li${r}`);
    expect(textOf(rows[0] ?? '')).toBe(`1. Hangul · Known from the level check ${canDo[1]} 11 known from the level check ${lr.planGoalTag}`);
    expect(textOf(rows[1] ?? '')).toBe(`2. Words · A taste ${canDo[2]} 1 quest done ${lr.hereTag('Mina')} ${lr.startTag('Mina')}`);
    expect(classCase2().back.text).toBe(lr.back.class);
  });
});

describe('the grown-up route card, other cases (mock stage-list-states.html)', () => {
  const cardHtml = (v: LearningRouteReady): string => renderToStaticMarkup(<GrownUpRouteCard card={v.card} />);

  it('case 3: "Next open stage" with no flag and the stage can-do line', () => {
    const html = cardHtml(ready());
    expect(textOf(html)).toBe([lr.now('Sam', 1, 'Hangul'), lr.nextOpen(1, 'Hangul'), lr.canDoLead('Sam'), canDo[1]].join(' '));
    // Only the Now line's pin: case 3 names no goal, so it carries no flag.
    expect(html.match(/<svg/g)).toHaveLength(1);
  });

  it('case 1 with Hoya\'s suggestion as the source', () => {
    const html = cardHtml(ready({ learners: [learner({ summary: summary({ routeGoal: { stage: 'stage1', from: 'default' } }) })] }));
    expect(textOf(html)).toBe([lr.now('Sam', 1, 'Hangul'), lr.learnerGoal('Sam', 1, 'Hangul'), lr.fromLead.default, lr.canDoLead('Sam'), canDo[1]].join(' '));
  });

  it('case 1 reached: the reached line with the flag and no can-do line', () => {
    const done = summary({
      routeGoal: { stage: 'stage1', from: 'class' },
      journey: { v: 1, here: 'stage2', seeded: true, stages: [{ stage: 'stage1', state: 'complete', done: 8, known: 0, total: 8 }, { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 }] },
    });
    const html = cardHtml(ready({ learners: [learner({ summary: done })] }));
    expect(textOf(html)).toBe([lr.now('Sam', 2, 'Words'), lr.reached('Sam', 1, 'Hangul'), lr.fromLead.class].join(' '));
    expect(html.match(/<svg/g)).toHaveLength(2);
  });

  it('the end of the open road: the Now line and the end line, no goal', () => {
    const allDone = summary({
      journey: {
        v: 1,
        here: 'stage4',
        seeded: true,
        stages: [
          { stage: 'stage1', state: 'complete', done: 8, known: 0, total: 8 },
          { stage: 'stage2', state: 'explored', done: 2, known: 0, total: 2 },
          { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
          { stage: 'stage4', state: 'explored', done: 1, known: 0, total: 1 },
        ],
      },
    });
    const html = cardHtml(ready({ learners: [learner({ summary: allDone })] }));
    expect(textOf(html)).toBe([lr.now('Sam', 4, 'Dialogue'), lr.endOfRoad('Sam')].join(' '));
  });

  it('RouteGoalLine draws one goal line: the flag for cases 1 and 2 only', () => {
    const goal = familyCase1().card.goal;
    const plain = ready().card.goal;
    if (!goal || !plain) throw new Error('no goal');
    expect(renderToStaticMarkup(<RouteGoalLine goal={goal} />)).toMatch(/^<p[^>]*><span[^>]*><svg[^>]*aria-hidden="true"[\s\S]*<strong[^>]*>Sam&#x27;s goal: Stage 2 · Words<\/strong><\/p>$/);
    expect(renderToStaticMarkup(<RouteGoalLine goal={plain} />)).not.toContain('<svg');
  });
});

describe('page states (section 6.1, mock stage-list-states.html)', () => {
  it('not synced yet: heading and the notice, no card and no list, never "no progress"', () => {
    const v = build({ learners: [learner({ summary: null })] });
    const html = render(v);
    expect(textOf(html)).toBe([lr.title('Sam'), lr.updated('Oct 11'), lr.notSynced('Sam')].join(' '));
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('<section');
    expect(textOf(html)).not.toMatch(/no progress/i);
  });

  it('a learner not in this space: the message, no heading and no other learner (the frame\'s PageBack is the way back)', () => {
    const v = build({ learnerId: 'learner:nobody', learners: [learner(), learner({ id: 'learner:mina', displayName: 'Mina' })] });
    const html = render(v);
    expect(textOf(html)).toBe(lr.notFound);
    expect(v.back.text).toBe(lr.back.family);
    expect(html).not.toContain('<h1');
    expect(html).not.toMatch(/Sam|Mina/);
  });

  it('loading: three placeholder rows, busy, with no text', () => {
    const html = renderToStaticMarkup(<LearningRouteLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/data-testid="route-placeholder"/g)).toHaveLength(3);
    expect(textOf(html)).toBe('');
  });
});

describe('every word from the dictionary (en-XA)', () => {
  it('the family page, the class page and the states', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    view.locale = PSEUDO;
    const pseudoTitle = (s: Parameters<typeof stageTitle>[0]) => stageTitle(s);
    const data = ['Sam', 'Mina', 'Hangul', 'Words', 'Sentences', 'Dialogue', 'Óçt 11', 'Oct 11', 'Déç 20', 'Dec 20'];
    const family = ready(
      {
        learners: [learner({ summary: summary({ placement: placement('stage1', 2), routeGoal: { stage: 'stage2', from: 'class' } }) })],
        plans: [plan({ id: 'plan:fam', items: [quest('quest:stage1-letters-q1')], meta: meta('2026-10-05', 11) })],
        stageTitle: pseudoTitle,
      },
      PSEUDO,
    );
    expectAllPseudo(render(family), data, 10);
    expectAllPseudo(render(build({ learners: [learner({ summary: null })] }, PSEUDO)), data, 3);
    expectAllPseudo(render(build({ learnerId: 'learner:nobody' }, PSEUDO)), data, 1);
  });
});
