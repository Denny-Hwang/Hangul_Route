import { BROWSE_PASS_SESSION_KEY, decodeBrowseFragment, type ReportSummary } from '@hangul-route/content-schema';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/console/api';
import { resetBrowseScopeCache } from '@/lib/console/browse-link';
import { EMPTY, NOW, STEADY, response, stageTitle } from '@/lib/console/__tests__/fixtures/report';
import { learnerReportView, reportBrowseStage, type LearnerReportView } from '@/lib/console/report-view';
import type { KeyValueStorage } from '@/lib/console/session';

/**
 * F-REPORT-001 RP-13 (section 3.6 "Browse links"; wireframe design/wireframes/reports/learner-report.md): with
 * F-BROWSE-001's console entries on, every letter chip (went-well and practice-next letters, More detail tiles), the
 * P4 quest title and the strand tip open All lessons through `openBrowse(..., 'report')`. P1's quest is BR-11's
 * Preview, never an inline link. Every link carries content ids only (BD7): never a learner id, name or summary value.
 */
type Scope = ApiResult<{ scope: 'full' | 'sampler' }>;
const consoleView = vi.hoisted(() => ({ answer: { ok: true, data: { scope: 'full' } } as Scope }));

vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  return { useMessages: () => i18n.getMessages('en'), useLocale: () => 'en' };
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/console/use-console', async () => {
  const { getMessages } = await import('@hangul-route/i18n');
  const api = { browseScope: async (): Promise<Scope> => consoleView.answer };
  return { useConsole: () => ({ ready: true, session: { accountId: 'acc_rp13', displayName: 'Kim' }, api, signOut: () => undefined, m: getMessages('en'), locale: 'en' }) };
});

import { ReportBody, type ReportBrowse } from '../ReportParts';

const ORIGIN = 'https://app.hangulroute.com';
const LEARNER_ID = 'profile:mina';
const NAME = 'Mina';

function fakeEnv() {
  const data = new Map<string, string>();
  const store: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  const assigned: string[] = [];
  return { data, assigned, env: { origin: () => ORIGIN, now: () => NOW.getTime(), storage: () => store, assign: (url: string) => void assigned.push(url) } };
}

/** STEADY with syllable reading the strand to grow, so the P2 tip needs no game title. */
const TIPPED = { ...STEADY, placement: { ...STEADY.placement, strands: { ...STEADY.placement.strands, 'sound-letter': 'secure' } } } as const satisfies ReportSummary;

function viewOf(summary: ReportSummary): LearnerReportView {
  const out = learnerReportView({ data: response(summary, { name: NAME }), query: { period: 'week', at: null, from: 'roster' }, now: NOW, role: 'owner', stageTitle, locale: 'en' });
  if (out === null) throw new Error('no view');
  return out;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  consoleView.answer = { ok: true, data: { scope: 'full' } };
  resetBrowseScopeCache();
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

async function render(view: LearnerReportView, browse: ReportBrowse | null): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<ReportBody view={view} browse={browse} />);
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const browseHrefs = (r: ReactTestRenderer): string[] =>
  r.root.findAll((n) => n.type === 'a' && typeof n.props.href === 'string' && (n.props.href as string).startsWith('/browse')).map((n) => n.props.href as string);
const within = (r: ReactTestRenderer, id: string): ReactTestInstance => byTestId(r, id)[0] as ReactTestInstance;

function plainClick() {
  return { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault: () => undefined };
}

describe('report Browse links (RP-13)', () => {
  it('links every letter in a sentence to its char target, source report', async () => {
    const r = await render(viewOf(STEADY), { stage: 'stage1', env: fakeEnv().env });
    const wentWell = within(r, 'report-went-well').findAll((n) => n.props['data-testid'] === 'report-letter-link' && n.type === 'a');
    expect(wentWell.map((n) => n.props.href)).toEqual(['/browse#t=char:%E3%84%B1&s=report', '/browse#t=char:%E3%84%B4&s=report']);
    const practice = within(r, 'report-line-letters_revisit').findAll((n) => n.props['data-testid'] === 'report-letter-link' && n.type === 'a');
    expect(practice.map((n) => textOf(n))).toEqual(['ㅂ (b)', 'ㅅ (s)']);
    expect(practice.map((n) => decodeBrowseFragment((n.props.href as string).slice('/browse'.length)))).toEqual([
      { ok: true, target: { kind: 'char', char: 'ㅂ' }, source: 'report' },
      { ok: true, target: { kind: 'char', char: 'ㅅ' }, source: 'report' },
    ]);
  });

  it('gives P1 no inline quest link: its quest is the action slot Preview of BR-11', async () => {
    const r = await render(viewOf(STEADY), { stage: 'stage1', env: fakeEnv().env });
    const p1 = within(r, 'report-line-letters_revisit');
    expect(p1.findAll((n) => n.props['data-testid'] === 'report-quest-link')).toHaveLength(0);
  });

  it('links the P4 quest title to its quest', async () => {
    // Hana, who never practiced: P4 is her only practice-next line (a busy week fills the three lines before it).
    const r = await render(viewOf(EMPTY), { stage: 'stage1', env: fakeEnv().env });
    const quest = within(r, 'report-line-next_on_route').findAll((n) => n.props['data-testid'] === 'report-quest-link' && n.type === 'a');
    expect(quest).toHaveLength(1);
    expect(quest[0]?.props.href).toBe('/browse#t=quest:stage1-letters-q1&s=report');
    expect(textOf(quest[0] as ReactTestInstance).length).toBeGreaterThan(0);
  });

  it("links the strand tip to the journey's stage, a link on its own line", async () => {
    const r = await render(viewOf(TIPPED), { stage: 'stage2', env: fakeEnv().env });
    const tip = within(r, 'report-line-strand_next').findAll((n) => n.props['data-testid'] === 'report-tip-link' && n.type === 'a');
    expect(tip).toHaveLength(1);
    expect(tip[0]?.props.href).toBe('/browse#t=stage:stage2&s=report');
    expect(tip[0]?.props.className).toContain('hr-report-tip-link');
  });

  it('links each More detail letter tile', async () => {
    const r = await render(viewOf(STEADY), { stage: 'stage1', env: fakeEnv().env });
    const tiles = within(r, 'report-detail').findAll((n) => n.props['data-testid'] === 'report-tile-link' && n.type === 'a');
    expect(tiles.length).toBeGreaterThanOrEqual(STEADY.jamoRecognized.length + STEADY.needsPractice.length);
    expect(tiles.every((n) => /^\/browse#t=char:[^&]+&s=report$/.test(n.props.href as string))).toBe(true);
    expect(tiles.every((n) => (n.props.className as string).includes('hr-report-tile'))).toBe(true);
  });

  it('carries content ids only: never a learner id, a name, a space id or a summary value (BD7)', async () => {
    const hrefs: string[] = [];
    for (const summary of [TIPPED, EMPTY]) {
      const r = await render(viewOf(summary), { stage: 'stage1', env: fakeEnv().env });
      hrefs.push(...browseHrefs(r));
      act(() => mounted?.unmount());
      mounted = null;
    }
    expect(hrefs.some((href) => href.includes('t=quest:'))).toBe(true);
    expect(hrefs.some((href) => href.includes('t=stage:'))).toBe(true);
    expect(hrefs.some((href) => href.includes('t=char:'))).toBe(true);
    for (const href of hrefs) {
      const hash = href.slice(href.indexOf('#'));
      const decoded = decodeBrowseFragment(hash);
      expect(decoded.ok).toBe(true);
      expect(href.slice(0, href.indexOf('#'))).toBe('/browse');
      expect(hash.slice(1).split('&').map((part) => part.slice(0, part.indexOf('=')))).toEqual(['t', 's']);
      const plain = decodeURIComponent(href);
      for (const banned of [LEARNER_ID, NAME, 'space:', 'profile', 'roster', 'plan:', String(STEADY.minutesLast7d), STEADY.lastActiveAt]) expect(plain).not.toContain(banned);
    }
  });

  it('opens through openBrowse: a plain click writes the pass and goes to the absolute /browse URL', async () => {
    const fake = fakeEnv();
    const r = await render(viewOf(STEADY), { stage: 'stage1', env: fake.env });
    const link = within(r, 'report-line-letters_revisit').findAll((n) => n.props['data-testid'] === 'report-letter-link' && n.type === 'a')[0] as ReactTestInstance;
    await act(async () => {
      link.props.onClick(plainClick());
    });
    expect(fake.assigned).toEqual([`${ORIGIN}/browse#t=char:%E3%85%82&s=report`]);
    const pass = JSON.parse(fake.data.get(BROWSE_PASS_SESSION_KEY) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(pass).sort()).toEqual(['issuedAt', 'scope', 'seen', 'source', 'uiLocale', 'v']);
    expect(JSON.stringify(pass)).not.toContain(NAME);
  });

  it('shows the check line under the link and stays put when the plan check fails', async () => {
    consoleView.answer = { ok: false, error: 'network', status: 0 };
    const fake = fakeEnv();
    const r = await render(viewOf(EMPTY), { stage: 'stage1', env: fake.env });
    const link = within(r, 'report-line-next_on_route').findAll((n) => n.props['data-testid'] === 'report-quest-link' && n.type === 'a')[0] as ReactTestInstance;
    await act(async () => {
      link.props.onClick(plainClick());
    });
    expect(fake.assigned).toEqual([]);
    expect(textOf(within(r, 'report-quest-link-notice'))).toContain('Could not check your plan.');
  });

  it('draws no Browse link while the entries are off: letters, the quest title and the tip stay text', async () => {
    const r = await render(viewOf(TIPPED), null);
    expect(browseHrefs(r)).toEqual([]);
    expect(byTestId(r, 'report-letter-link')).toHaveLength(0);
    expect(byTestId(r, 'report-tip-link')).toHaveLength(0);
    expect(textOf(within(r, 'report-line-letters_revisit'))).toContain('ㅂ (b)');
  });
});

describe('reportBrowseStage', () => {
  it("is the journey's here stage, else stage1", () => {
    expect(reportBrowseStage({ ...STEADY, journey: { ...STEADY.journey, here: 'stage2' } })).toBe('stage2');
    expect(reportBrowseStage(STEADY)).toBe('stage1');
    const { journey: _journey, ...noJourney } = STEADY;
    expect(reportBrowseStage(noJourney)).toBe('stage1');
    expect(reportBrowseStage(null)).toBe('stage1');
  });
});
