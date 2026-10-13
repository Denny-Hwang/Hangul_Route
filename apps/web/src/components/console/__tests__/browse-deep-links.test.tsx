import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReportSection } from '@/lib/console/report-view';
import { learningRouteView, type LearningRouteView } from '@/lib/console/learning-route-view';
import { ROUTE_CATALOG, TODAY, learner, stageTitle } from '@/lib/console/__tests__/fixtures/learning-route';

/**
 * F-BROWSE-001 BR-11 (section 4.11 items 2-5; wireframe design/wireframes/browse/entry-points.md panels 2-5): the
 * console's deep links into All lessons. [ Preview ] on plan builder rows (quest or episode), letter chips on the
 * roster's revisit line (char), [ Preview lessons ] on the Learning Route stage rows (stage) and [ Preview ] in the
 * report's P1 action group (quest). Each is behind `browseLinksShown()` and carries content ids only.
 */
vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: 'en', messages: getMessages('en'), available: ['en'], setLocale: () => undefined }),
  useMessages: () => getMessages('en'),
  useLocale: () => 'en',
}));
vi.mock('../use-console', () => ({
  useConsole: () => ({ ready: true, session: { accountId: 'acc_1', displayName: 'Kim' }, api: null, signOut: () => undefined, m: getMessages('en'), locale: 'en' }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RevisitLetterLinks } from '../BrowseLink';
import { LearningRouteContent } from '../LearningRouteParts';
import { DraftItemRow } from '../PlanParts';
import { ReportInsights } from '../ReportParts';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((match) => (match[1] ?? '').replace(/&amp;/g, '&'));
const browseHrefs = (html: string): string[] => hrefs(html).filter((href) => href.startsWith('/browse'));
const noop = (): void => undefined;

function row(kind: 'quest' | 'episode', id: string, preview?: boolean): string {
  return renderToStaticMarkup(
    <DraftItemRow item={{ kind, id }} number={2} canUp canDown onUp={noop} onDown={noop} onRemove={noop} onUpdate={noop} preview={preview} />,
  );
}

describe('plan builder rows: [ Preview ] (section 4.11 item 4)', () => {
  it('a quest row links its quest and an episode row its episode, source plan, described by the row title', () => {
    const quest = row('quest', 'quest:stage1-letters-q2', true);
    expect(browseHrefs(quest)).toEqual(['/browse#t=quest:stage1-letters-q2&s=plan']);
    expect(quest).toContain('aria-describedby="plan-item-title-2"');
    expect(quest).toContain('id="plan-item-title-2"');
    expect(quest).toMatch(/data-testid="plan-preview-2"[^>]*>Preview</);
    expect(browseHrefs(row('episode', 'episode:stage1-letters', true))).toEqual(['/browse#t=episode:stage1-letters&s=plan']);
  });

  it('no link when All lessons is off (the default build)', () => {
    expect(browseHrefs(row('quest', 'quest:stage1-letters-q2', false))).toEqual([]);
    expect(browseHrefs(row('quest', 'quest:stage1-letters-q2'))).toEqual([]);
  });
});

describe('roster revisit chips (section 4.11 item 5)', () => {
  it('each letter is a chip linking its char target, source roster, marked Korean; no learner in the link', () => {
    const html = renderToStaticMarkup(<RevisitLetterLinks chars={['ㄷ', 'ㅂ']} shown />);
    expect(browseHrefs(html)).toEqual([`/browse#t=char:${encodeURIComponent('ㄷ')}&s=roster`, `/browse#t=char:${encodeURIComponent('ㅂ')}&s=roster`]);
    expect(html.match(/lang="ko"/g)).toHaveLength(2);
  });

  it('each chip shows the romanization outside the Korean span and is described as a preview', () => {
    const html = renderToStaticMarkup(<RevisitLetterLinks chars={['ㄷ', 'ㅂ']} shown />);
    expect(html).toMatch(/<span lang="ko"[^>]*>ㄷ<\/span>\s*<span[^>]*>d<\/span>/);
    expect(html).toMatch(/<span lang="ko"[^>]*>ㅂ<\/span>\s*<span[^>]*>b<\/span>/);
    const described = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(described).toHaveLength(2);
    expect(new Set(described).size).toBe(1);
    const id = described[0] ?? '';
    expect(html).toMatch(new RegExp(`id="${id.replace(/[^\w-]/g, (c) => `\\${c}`)}"[^>]*>Preview<`));
  });

  it('off: the letters as plain Korean text, as before', () => {
    const html = renderToStaticMarkup(<RevisitLetterLinks chars={['ㄷ', 'ㅂ']} shown={false} />);
    expect(html).toBe('<span lang="ko">ㄷ · ㅂ</span>');
  });

  it('shown follows browseLinksShown() for the page origin after mount', async () => {
    vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com' } });
    let r: ReactTestRenderer | null = null;
    await act(async () => {
      r = create(<RevisitLetterLinks chars={['ㄷ']} />);
    });
    const links = (r as unknown as ReactTestRenderer).root.findAll((n) => n.type === 'a');
    expect(links.map((n) => n.props.href)).toEqual([`/browse#t=char:${encodeURIComponent('ㄷ')}&s=roster`]);
    act(() => (r as unknown as ReactTestRenderer).unmount());

    vi.stubGlobal('window', { location: { origin: 'https://hangulroute.com' } });
    await act(async () => {
      r = create(<RevisitLetterLinks chars={['ㄷ']} />);
    });
    expect((r as unknown as ReactTestRenderer).root.findAll((n) => n.type === 'a')).toHaveLength(0);
    act(() => (r as unknown as ReactTestRenderer).unmount());
  });
});

describe('Learning Route stage rows: [ Preview lessons ] (section 4.11 item 3)', () => {
  const view = (): LearningRouteView => {
    const v = learningRouteView({ space: { id: 'space:fam', kind: 'family' }, learners: [learner()], learnerId: 'learner:sam', plans: [], today: TODAY, stageTitle, catalog: ROUTE_CATALOG, locale: 'en' });
    if (v === null || v.status !== 'ready') throw new Error('no ready view');
    return v;
  };

  it('every stage row that is not coming later links its stage, source route, described by the row heading', () => {
    const v = view();
    const html = renderToStaticMarkup(<LearningRouteContent view={v} preview />);
    const stages = v.status === 'ready' ? v.stages.flatMap((r) => (r.kind === 'later' || r.state === 'later' ? [] : [r.stage])) : [];
    expect(stages.length).toBeGreaterThan(0);
    expect(browseHrefs(html)).toEqual(stages.map((stage) => `/browse#t=stage:${stage}&s=route`));
    for (const stage of stages) expect(html).toContain(`aria-describedby="route-stage-${stage}"`);
    expect(html).toContain('>Preview lessons<');
    // No learner id or name in any link.
    for (const href of browseHrefs(html)) expect(href).not.toMatch(/learner|sam/i);
  });

  it('none when All lessons is off', () => {
    expect(browseHrefs(renderToStaticMarkup(<LearningRouteContent view={view()} preview={false} />))).toEqual([]);
    expect(browseHrefs(renderToStaticMarkup(<LearningRouteContent view={view()} />))).toEqual([]);
  });
});

describe('report P1 action group: [ Preview ] (section 4.11 item 2, RP-7a2 slot)', () => {
  const section = (actions: ReportSection['lines'][number]['actions'], preview: { kind: 'quest'; id: string } | null): ReportSection => ({
    heading: 'What to practice next',
    lines: [{ code: 'next_in_plan', sentence: { text: 'Next in the plan: Meet a, eo, g, n.', parts: [] }, tip: null, actions, preview }],
  });

  it('Preview sits after Add to a plan, in the same group, described by the line', () => {
    const html = renderToStaticMarkup(<ReportInsights section={section([{ href: '/teach/space/plan?id=s&add=quest%3Astage1-letters-q2', text: 'Add to a plan' }], { kind: 'quest', id: 'quest:stage1-letters-q2' })} kind="practice-next" preview />);
    expect(hrefs(html)).toEqual(['/teach/space/plan?id=s&add=quest%3Astage1-letters-q2', '/browse#t=quest:stage1-letters-q2&s=report']);
    expect(html).toMatch(/class="hr-report-ghost"[^>]*data-testid="report-preview-next_in_plan"[^>]*>Preview</);
    expect(html.match(/aria-describedby="hr-report-practice-next-0"/g)).toHaveLength(2);
  });

  it('a viewer with no plan action still gets the group with Preview alone', () => {
    const html = renderToStaticMarkup(<ReportInsights section={section([], { kind: 'quest', id: 'quest:stage1-letters-q2' })} kind="practice-next" preview />);
    expect(html).toContain('data-testid="report-line-actions"');
    expect(browseHrefs(html)).toEqual(['/browse#t=quest:stage1-letters-q2&s=report']);
  });

  it('off, or a line with no quest: no Preview and no empty group', () => {
    expect(browseHrefs(renderToStaticMarkup(<ReportInsights section={section([], { kind: 'quest', id: 'quest:stage1-letters-q2' })} kind="practice-next" preview={false} />))).toEqual([]);
    const none = renderToStaticMarkup(<ReportInsights section={section([], null)} kind="practice-next" preview />);
    expect(none).not.toContain('report-line-actions');
  });
});

describe('hosts with the prop left out: useBrowseLinksShown() decides after mount', () => {
  const routeView = (): LearningRouteView => {
    const v = learningRouteView({ space: { id: 'space:fam', kind: 'family' }, learners: [learner()], learnerId: 'learner:sam', plans: [], today: TODAY, stageTitle, catalog: ROUTE_CATALOG, locale: 'en' });
    if (v === null || v.status !== 'ready') throw new Error('no ready view');
    return v;
  };
  const reportSection: ReportSection = {
    heading: 'What to practice next',
    lines: [{ code: 'next_in_plan', sentence: { text: 'Next in the plan: Meet a, eo, g, n.', parts: [] }, tip: null, actions: [], preview: { kind: 'quest', id: 'quest:stage1-letters-q2' } }],
  };
  const hosts: Array<[string, () => JSX.Element, string]> = [
    ['plan builder row', () => <DraftItemRow item={{ kind: 'quest', id: 'quest:stage1-letters-q2' }} number={2} canUp canDown onUp={noop} onDown={noop} onRemove={noop} onUpdate={noop} />, '/browse#t=quest:stage1-letters-q2&s=plan'],
    ['Learning Route', () => <LearningRouteContent view={routeView()} />, '&s=route'],
    ['report P1 group', () => <ReportInsights section={reportSection} kind="practice-next" />, '/browse#t=quest:stage1-letters-q2&s=report'],
  ];

  async function browseLinks(element: () => JSX.Element): Promise<string[]> {
    let r: ReactTestRenderer | null = null;
    await act(async () => {
      r = create(element());
    });
    const found = (r as unknown as ReactTestRenderer).root
      .findAll((n) => n.type === 'a' && typeof n.props.href === 'string' && n.props.href.startsWith('/browse'))
      .map((n) => n.props.href as string);
    act(() => (r as unknown as ReactTestRenderer).unmount());
    return found;
  }

  for (const [name, element, expected] of hosts) {
    it(`${name}: on at the app origin with the switch on, off on another origin`, async () => {
      vi.stubEnv('NEXT_PUBLIC_BROWSE', 'enabled');
      vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com' } });
      const on = await browseLinks(element);
      expect(on.length).toBeGreaterThan(0);
      expect(on.every((href) => href.includes(expected))).toBe(true);

      vi.stubGlobal('window', { location: { origin: 'https://hangulroute.com' } });
      expect(await browseLinks(element)).toEqual([]);
    });
  }
});
