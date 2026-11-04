import { CATALOG, addDays, generateCurriculum, toMeta, toPlanItems, type CurriculumDraft, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { formatDate as realFormatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BlendControls, BlendPreview, BlendPreviewHeader, BlendThisWeek, MeetingBlock } from '@/components/console/BlendParts';
import { RouteReadout } from '@/components/console/RoutePlanParts';
import type { PlanView } from '@/lib/console/api';
import { defaultsFor, toParams, type RepaceResult, type WizardState } from '@/lib/console/curriculum';
import type { ReadoutRow } from '@/lib/console/plans';
import { wordsOf } from './pseudo-text';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 10.1, 10.2 and 14 (row BL-4): the meeting block, the preview header and cycle
 * table, and the readout's class lines and controls take every word from `console.curriculum.blend` (en-XA), keep the
 * accessible structure the wireframe asks for (checkbox chips with `aria-checked`, named selects, Change days with
 * `aria-expanded`, a radiogroup of mode cards, a table with column and row headers), and never list, sort or compare a
 * learner. Titles, dates and weekday names are data.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return {
    ...actual,
    formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest),
    formatNumber: (locale: UiLocale, n: number) => actual.formatNumber(locale === PSEUDO ? 'en' : locale, n),
  };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const START = '2026-11-02';
const STAGES = ['stage1', 'stage2'] as const;
const state = (over: Partial<WizardState> = {}): WizardState => ({ ...defaultsFor('class', [], START), length: '12-week', lectureDays: ['tue'], practicePerWeek: 3, ...over });

function draftOf(over: Partial<WizardState> = {}): CurriculumDraft {
  const params = toParams(state(over), [...STAGES], true);
  if (!params) throw new Error('params');
  return generateCurriculum(params, CATALOG);
}
const plan = (meta: CurriculumMeta, items: PlanItem[]): PlanView & { meta: CurriculumMeta } => ({
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Route one',
  items,
  targetLearnerIds: null,
  publishedAt: '2026-11-01T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  meta,
});

const titles = [...CATALOG.cells.map((c) => c.title), ...CATALOG.quests.map((q) => q.title), ...CATALOG.stories.map((s) => s.title), ...CATALOG.topics.map((t) => t.title)];
const dates = Array.from({ length: 200 }, (_, k) => addDays('2026-10-25', k)).flatMap((key) => [
  realFormatDate('en', key, 'monthDay', { utc: true }),
  realFormatDate('en', key, 'weekday', { utc: true }),
  realFormatDate('en', key, 'weekdayLong', { utc: true }),
]);
const data = [...new Set([...titles, ...dates, 'Mina', 'today'])].sort((a, b) => b.length - a.length);
const noop = (): void => undefined;

function expectAllPseudo(html: string, minWords = 4): void {
  const words = wordsOf(html, data);
  expect(words.length).toBeGreaterThanOrEqual(minWords);
  for (const word of words) {
    let rest = word;
    for (let before = ''; before !== rest; ) {
      before = rest;
      rest = rest.replace(/\[[^[\]]*\]/g, '');
    }
    expect(rest, `"${word}" is not from the dictionary`).not.toMatch(/[A-Za-z]/);
  }
}

/** The practice row is one message split around its two selects, so its pseudo brackets span elements: checked on its own. */
function withoutPracticeRow(html: string): string {
  const inline = getMessages(PSEUDO).console.curriculum.blend.practice.inline('\u2063\u2460\u2063', '\u2063\u2461\u2063');
  const row = /<div data-testid="practice-inline"[\s\S]*?<\/select>[\s\S]*?<\/select>[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  const text = row.replace(/<select[\s\S]*?<\/select>/g, '').replace(/<[^>]+>/g, '');
  expect(text.replace(/\s+/g, '')).toBe(inline.replace(/[\u2063\u2460\u2461\s]/g, ''));
  return html.replace(row, '');
}

describe('MeetingBlock (section 10.1; wireframe M1)', () => {
  it('a Class only start: class chips, class length, the practice row, no mode cards', () => {
    const html = renderToStaticMarkup(<MeetingBlock state={state({ lectureDays: [], practicePerWeek: 0 })} onChange={noop} locale={PSEUDO} />);
    expect(html.match(/role="checkbox"/g)).toHaveLength(7);
    expect(html.match(/aria-checked="true"/g)).toBeNull();
    expect(html.match(/<option/g)).toHaveLength(5 + 8 + 5);
    expect(html).toMatch(/<select aria-label="[^"]+"[^>]*data-testid="practice-count"/);
    expect(html).toMatch(/<select aria-label="[^"]+"[^>]*data-testid="practice-minutes"/);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toContain('practice-line');
    expectAllPseudo(withoutPracticeRow(html));
  });

  it('with practice days: the suggested days, Change days (collapsed) and the two mode cards, overlap selected', () => {
    const html = renderToStaticMarkup(<MeetingBlock state={state()} onChange={noop} locale={PSEUDO} />);
    expect(html).toContain('data-testid="practice-line"');
    expect(html).toMatch(/aria-expanded="false"[^>]*data-testid="practice-change"/);
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*data-testid="blend-mode-overlap"/);
    expect(html).toContain('data-testid="suggested-tag"');
    expect(html).not.toMatch(/lecture/i);
    expectAllPseudo(withoutPracticeRow(html));
  });
});

describe('the preview (section 10.2; wireframe M3)', () => {
  const draft = draftOf();

  it('heads it with the sessions, per day, totals and the first class', () => {
    const html = renderToStaticMarkup(<BlendPreviewHeader draft={draft} locale={PSEUDO} />);
    expect(html.match(/<p/g)).toHaveLength(4);
    expectAllPseudo(html);
  });

  it('lays the cycle table with column headers, the week as the row header, Class and Practice cells, and Refresh', () => {
    const html = renderToStaticMarkup(<BlendPreview draft={draft} locale={PSEUDO} />);
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(html.match(/<th scope="row"/g)).toHaveLength(12);
    expect(html.match(/data-testid="cycle-card"/g)).toHaveLength(12);
    const refresh = getMessages(PSEUDO).console.curriculum.blend.preview.refresh;
    expect(html).toContain(refresh);
    expect(html).not.toMatch(/lecture/i);
    expectAllPseudo(html, 20);
  });

  it('tags a practice-only lesson in split', () => {
    const split = draftOf({ blendMode: 'split', length: '6-month' });
    const tag = getMessages(PSEUDO).console.curriculum.blend.preview.practiceOnlyTag;
    const html = renderToStaticMarkup(<BlendPreview draft={split} locale={PSEUDO} />);
    expect(split.items.some((item) => item.lectureDate === undefined)).toBe(true);
    expect(html).toContain(tag);
  });
});

describe('the readout (section 10.2; wireframe M4)', () => {
  const draft = draftOf();
  const meta = toMeta(draft);
  const items = toPlanItems(draft);
  const row: ReadoutRow = { learnerId: 'l:1', name: 'Mina', done: 1, total: 2, notReady: 0, synced: true, lastActiveAt: '2026-11-04T08:00:00.000Z' };

  it('shows this week\'s class lessons first, the class practice days and the class days so far', () => {
    const html = renderToStaticMarkup(<BlendThisWeek plan={{ meta, items }} today="2026-11-11" locale={PSEUDO} />);
    const words = getMessages(PSEUDO).console.curriculum.blend.readout;
    expect(html).toContain(words.classDays(2, 12));
    expect(html.indexOf('<h3')).toBeLessThan(html.indexOf('class-days-so-far'));
    expectAllPseudo(html);
  });

  it('offers Move this class day and Stop practice days on a blended plan, Add practice days on a Class only one', () => {
    const blended = renderToStaticMarkup(<BlendControls plan={plan(meta, items)} today="2026-11-04" locale={PSEUDO} busy={false} onSave={async () => true} />);
    expect(blended).toContain('data-testid="blend-move"');
    expect(blended).toContain('data-testid="blend-stop"');
    expect(blended).not.toContain('data-testid="blend-add"');
    expectAllPseudo(blended, 2);

    const classOnly = generateCurriculum(toParams(state({ practicePerWeek: 0 }), [...STAGES], true) ?? (undefined as never), CATALOG);
    const html = renderToStaticMarkup(<BlendControls plan={plan(toMeta(classOnly), toPlanItems(classOnly))} today="2026-11-04" locale={PSEUDO} busy={false} onSave={async () => true} />);
    expect(html).toContain('data-testid="blend-add"');
    expect(html).not.toContain('data-testid="blend-move"');
  });

  it('shows no control on a family plan, and no Move after the last class day', () => {
    const family = toMeta(generateCurriculum({ ...(toParams({ ...defaultsFor('family', [], START), length: '4-week' }, [...STAGES]) ?? (undefined as never)) }, CATALOG));
    expect(renderToStaticMarkup(<BlendControls plan={plan(family, [])} today="2026-11-04" locale={PSEUDO} busy={false} onSave={async () => true} />)).toBe('');
    const after = renderToStaticMarkup(<BlendControls plan={plan(meta, items)} today="2027-06-01" locale={PSEUDO} busy={false} onSave={async () => true} />);
    expect(after).not.toContain('blend-move');
  });

  it('puts the class lines and controls in RouteReadout only with blend on; learners stay one row each, never ranked', () => {
    const render = (blend: boolean): string =>
      renderToStaticMarkup(<RouteReadout plan={plan(meta, items)} rows={[row]} today="2026-11-04" locale={PSEUDO} busy={false} onSave={async () => true} relativeDayOf={() => 'today'} blend={blend} />);
    const on = render(true);
    const off = render(false);
    expect(on).toContain('data-testid="blend-this-week"');
    expect(on).toContain('data-testid="blend-controls"');
    expect(off).not.toContain('blend-this-week');
    expect(off).not.toContain('blend-controls');
    expect(on.match(/data-testid="readout-row"/g)).toHaveLength(1);
    expect(on).not.toMatch(/%/);
  });
});

describe('the readout plan changes are laid out before they are saved (F-PLAN-002 re-pace convention)', () => {
  const draft = draftOf({ daysOff: [{ from: '2026-11-24', to: '2026-11-24', classOnly: true }] });
  const meta = toMeta(draft);
  const items = toPlanItems(draft);
  const byId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((node) => typeof node.type === 'string' && node.props['data-testid'] === id);
  async function mount(view: PlanView & { meta: CurriculumMeta }, onSave: (result: RepaceResult) => Promise<boolean>): Promise<ReactTestInstance> {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let renderer: ReactTestRenderer | null = null;
    await act(async () => {
      renderer = create(<BlendControls plan={view} today="2026-11-04" locale={PSEUDO} busy={false} onSave={onSave} />, { createNodeMock: () => ({ focus: () => undefined }) });
    });
    if (!renderer) throw new Error('not mounted');
    return (renderer as ReactTestRenderer).root;
  }
  async function press(root: ReactTestInstance, id: string): Promise<void> {
    const [node] = byId(root, id);
    if (!node) throw new Error(`no ${id}`);
    await act(async () => {
      (node.props.onClick as () => void)();
    });
  }

  it('Move this class day opens a confirm with the laid-out plan, and Yes saves that plan', async () => {
    const onSave = vi.fn(async (_result: RepaceResult) => true);
    const root = await mount(plan(meta, items), onSave);
    await press(root, 'blend-move');
    expect(byId(root, 'blend-move-confirm')).toHaveLength(1);
    expect(onSave).not.toHaveBeenCalled();
    await press(root, 'blend-move-confirm-yes');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0].meta.params.blend?.classDaysOff).toEqual(['2026-11-10', '2026-11-24']);
  });

  it('Stop practice days keeps a class day off as a plan day off', async () => {
    const onSave = vi.fn(async (_result: RepaceResult) => true);
    const root = await mount(plan(meta, items), onSave);
    await press(root, 'blend-stop');
    await press(root, 'blend-stop-confirm-yes');
    const result = onSave.mock.calls[0]?.[0];
    expect(result?.meta.params.blend).toBeUndefined();
    expect(result?.meta.params.daysOff).toEqual([{ from: '2026-11-24', to: '2026-11-24' }]);
    expect(result?.items.some((item) => item.targetDate === '2026-11-24')).toBe(false);
  });

  it('Stop practice days says when the class days off would pass 12 breaks, and offers no Yes', async () => {
    const full = Array.from({ length: 12 }, (_, k) => ({ from: addDays('2027-01-04', 7 * k), to: addDays('2027-01-04', 7 * k) }));
    const crowded = { ...meta, params: { ...meta.params, daysOff: full } };
    const root = await mount(plan(crowded, items), async () => true);
    await press(root, 'blend-stop');
    expect(byId(root, 'blend-stop-confirm')).toHaveLength(1);
    expect(byId(root, 'blend-stop-confirm-yes')).toHaveLength(0);
    const text = (node: ReactTestInstance | string): string => (typeof node === 'string' ? node : node.children.map(text).join(''));
    expect(text(root)).toContain(getMessages(PSEUDO).console.curriculum.rhythm.tooManyBreaks);
  });
});
