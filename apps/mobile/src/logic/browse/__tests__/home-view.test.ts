import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { ThemeDef } from '@hangul-route/content-schema';
import { themeColumnLabel } from '../../journey';
import { journeyGridRows } from '../../journey-grid';
import { questStepLabel } from '../../quest-steps';
import { itemAccess } from '../access';
import { accountHomeUrl } from '../boot';
import { browseJourneyRows, browseSections } from '../catalogue';
import { itemFacts, type QuestFacts } from '../facts';
import {
  accessOf,
  billingShown,
  browseGridAccess,
  browseGridEpisodes,
  homeLines,
  initialSection,
  itemViewedEvent,
  plansTappedEvent,
  pointerUrl,
  sectionAfter,
  stepsLine,
  whereLine,
  type ActivePass,
} from '../home-view';
import { fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 BR-7 (sections 4.2, 4.5, 4.6 and 9; mocks
 * design/screens/browse/home.md, episode.md and item.md): what the catalogue
 * screens draw around the learner's own visuals.
 */
const bundle = fixtureBundle();
const en = getMessages('en');
const m = en.caregiver.browse;

const pass = (over: Partial<ActivePass> = {}): ActivePass => ({
  status: 'active',
  scope: 'full',
  from: 'account',
  fallback: false,
  removeSession: false,
  removeKept: false,
  ...over,
});

describe('homeLines (section 4.5 items 3 and 4, design decisions 3, 22 and 24)', () => {
  it('switch off: no scope line for any pass, a fallback included', () => {
    for (const p of [pass(), pass({ scope: 'sampler' }), pass({ scope: 'sampler', fallback: true }), pass({ from: 'gate', scope: 'sampler' })]) {
      expect(homeLines({ pass: p, gatingEnabled: false, online: true }).scope).toBeNull();
    }
  });

  it('switch on: the sampler line for a sampler pass, the fallback line for a fallback pass, none for full', () => {
    expect(homeLines({ pass: pass({ scope: 'sampler' }), gatingEnabled: true, online: true }).scope).toBe('sampler');
    expect(homeLines({ pass: pass({ from: 'gate', scope: 'sampler' }), gatingEnabled: true, online: true }).scope).toBe('sampler');
    expect(homeLines({ pass: pass({ scope: 'sampler', fallback: true }), gatingEnabled: true, online: true }).scope).toBe('fallback');
    expect(homeLines({ pass: pass(), gatingEnabled: true, online: true }).scope).toBeNull();
  });

  it('the pointer line: account passes that are not kept (a fallback included), online only; never gate or kept', () => {
    expect(homeLines({ pass: pass(), gatingEnabled: false, online: true }).pointer).toBe(true);
    expect(homeLines({ pass: pass({ scope: 'sampler', fallback: true }), gatingEnabled: false, online: true }).pointer).toBe(true);
    expect(homeLines({ pass: pass(), gatingEnabled: false, online: false }).pointer).toBe(false);
    expect(homeLines({ pass: pass({ from: 'gate' }), gatingEnabled: false, online: true }).pointer).toBe(false);
    expect(homeLines({ pass: pass({ from: 'kept' }), gatingEnabled: false, online: true }).pointer).toBe(false);
  });

  it('the keep switch: account passes that are not a fallback, and a kept pass; never a gate pass', () => {
    expect(homeLines({ pass: pass(), gatingEnabled: false, online: true }).keep).toBe(true);
    expect(homeLines({ pass: pass({ from: 'kept' }), gatingEnabled: false, online: false }).keep).toBe(true);
    expect(homeLines({ pass: pass({ fallback: true, scope: 'sampler' }), gatingEnabled: false, online: true }).keep).toBe(false);
    expect(homeLines({ pass: pass({ from: 'gate' }), gatingEnabled: false, online: true }).keep).toBe(false);
  });

  it('the pointer goes to the persona home, else sign-in, with no learner identifier', () => {
    expect(pointerUrl('parent')).toBe('/parent');
    expect(pointerUrl('teacher')).toBe('/teach/home');
    expect(pointerUrl(null)).toBe(accountHomeUrl(null));
  });
});

describe('billingShown (sections 4.2 and 8)', () => {
  it('an account pass that is not kept and not a fallback; never a gate or kept pass', () => {
    expect(billingShown(pass({ scope: 'sampler' }))).toBe(true);
    expect(billingShown(pass({ scope: 'sampler', fallback: true }))).toBe(false);
    expect(billingShown(pass({ from: 'gate', scope: 'sampler' }))).toBe(false);
    expect(billingShown(pass({ from: 'kept', scope: 'sampler' }))).toBe(false);
  });
});

describe('the section control (section 7: one row, arrow keys move)', () => {
  const three = browseSections(true);
  const two = browseSections(false);

  it('arrow keys wrap, Home and End jump, other keys do nothing', () => {
    expect(sectionAfter(three, 'route', 'ArrowRight')).toBe('journey');
    expect(sectionAfter(three, 'library', 'ArrowRight')).toBe('route');
    expect(sectionAfter(three, 'route', 'ArrowLeft')).toBe('library');
    expect(sectionAfter(three, 'journey', 'ArrowUp')).toBe('route');
    expect(sectionAfter(three, 'journey', 'ArrowDown')).toBe('library');
    expect(sectionAfter(three, 'library', 'Home')).toBe('route');
    expect(sectionAfter(three, 'route', 'End')).toBe('library');
    expect(sectionAfter(three, 'route', 'Enter')).toBeNull();
    expect(sectionAfter(two, 'route', 'ArrowRight')).toBeNull();
  });

  it('a requested section this build offers, else the default (Route while the learner Route tab is on, else Journey)', () => {
    expect(initialSection(three, undefined)).toBe('route');
    expect(initialSection(two, undefined)).toBe('journey');
    expect(initialSection(three, 'library')).toBe('library');
    expect(initialSection(two, 'route')).toBe('journey');
  });
});

describe('the learner Journey grid in All lessons (section 4.5)', () => {
  const free = (questId: string): boolean => questId === 'quest:stage1-letters-q1';

  it('draws the same open, closed and later cells as browseJourneyRows, for both scopes and both switch states', () => {
    for (const scope of ['full', 'sampler'] as const) {
      for (const gatingEnabled of [false, true]) {
        const input = { bundle, scope, gatingEnabled };
        const grid = journeyGridRows({
          stages: bundle.stages,
          themes: bundle.themes,
          gridEpisodes: browseGridEpisodes(input),
          paneMode: false,
          selectedId: null,
          access: browseGridAccess(input),
        });
        const rows = browseJourneyRows({ bundle, scope, gatingEnabled });
        const drawn = grid.flatMap((row) => row.cells.map((c) => (c.state === 'later' ? 'later' : c.access.notOpen ? 'closed' : 'open')));
        expect(drawn, `${scope} ${gatingEnabled}`).toEqual(rows.flatMap((row) => row.cells.map((c) => c.state)));
        // never a Next or In your plan mark: Browse knows no learner
        expect(grid.flatMap((row) => row.cells).some((c) => c.access.next || c.access.inPlan)).toBe(false);
        if (!gatingEnabled || scope === 'full') expect(drawn).not.toContain('closed');
      }
    }
    expect(browseJourneyRows({ bundle, scope: 'sampler', gatingEnabled: true, freeQuestOpen: free }).flatMap((r) => r.cells).some((c) => c.state === 'closed')).toBe(true);
  });

  it('an openable episode with no quest left in the bundle is drawn later, as the outline says Coming later', () => {
    const first = bundle.episodes.find((e) => e.placement !== 'shelf' && e.questIds.length > 0 && (e.status === 'shipped' || e.status === 'ready'));
    expect(first).toBeDefined();
    const emptied = { ...bundle, episodes: bundle.episodes.map((e) => (e.id === first?.id ? { ...e, questIds: [] } : e)) };
    const episodes = browseGridEpisodes({ bundle: emptied, scope: 'full', gatingEnabled: false });
    expect(episodes.find((e) => e.id === first?.id)?.status).toBe('preview');
    expect(episodes.filter((e) => e.id !== first?.id)).toEqual(browseGridEpisodes({ bundle, scope: 'full', gatingEnabled: false }).filter((e) => e.id !== first?.id));
  });

  it('accessOf is itemAccess with this pass and switch', () => {
    for (const q of bundle.quests.slice(0, 10)) {
      expect(accessOf({ kind: 'quest', id: q.id }, { bundle, scope: 'sampler', gatingEnabled: true })).toBe(itemAccess({ kind: 'quest', id: q.id }, 'sampler', true, { bundle }));
    }
  });
});

describe('the item page lines (section 4.6, design decisions 12 and 13)', () => {
  const q1 = itemFacts({ kind: 'quest', id: 'quest:stage1-letters-q1' }, bundle) as QuestFacts;

  it('"Where it sits" names the stage, the Journey column word and the lesson position', () => {
    expect(q1.where?.kind).toBe('episode');
    const place = q1.where as Extract<QuestFacts['where'], { kind: 'episode' }>;
    expect(whereLine(place, bundle.stages, bundle.themes, m)).toBe(`Stage 1 · Letters · lesson ${place.position} of ${place.count}`);
  });

  it('a shelf story quest sits at its story home cell with no position', () => {
    const life = themeColumnLabel(bundle.themes.find((t) => t.key === 'life') as ThemeDef);
    expect(whereLine({ kind: 'story-home', stage: 'stage3', theme: 'life', storyId: 'story:x' }, bundle.stages, bundle.themes, m)).toBe(`Stage 3 · ${life}`);
    expect(whereLine({ stage: 'stage1', theme: 'letters' }, bundle.stages, bundle.themes, m)).toBe('Stage 1 · Letters');
  });

  it('an unknown stage or theme still reads, never blank', () => {
    expect(whereLine({ stage: 'stage9' as never, theme: 'other' as never }, bundle.stages, bundle.themes, m)).toBe('Stage 0 · other');
  });

  it('the steps are the player own names, in order', () => {
    expect(stepsLine(q1.steps, en.learner.quest.step)).toBe(q1.steps.map((k) => questStepLabel(k, en.learner.quest.step)).join(' · '));
    expect(stepsLine(q1.steps, en.learner.quest.step)).toMatch(/^Hello · .* · Finish$/);
  });
});

describe('telemetry (section 9): content ids only, never a person', () => {
  it('browse.item_viewed says open or closed', () => {
    expect(itemViewedEvent('quest', 'quest:stage1-letters-q1', 'open')).toEqual({ name: 'browse.item_viewed', payload: { kind: 'quest', itemId: 'quest:stage1-letters-q1', access: 'open' } });
    expect(itemViewedEvent('episode', 'episode:x', 'closed').payload.access).toBe('closed');
    expect(itemViewedEvent('card', 'card:book', 'later').payload.access).toBe('open');
    expect(Object.keys(itemViewedEvent('story', 'story:x', 'open'))).toEqual(['name', 'payload']);
  });

  it('browse.plans_tapped carries the kind only', () => {
    expect(plansTappedEvent('vocab-topic')).toEqual({ name: 'browse.plans_tapped', payload: { kind: 'vocab-topic' } });
  });
});
