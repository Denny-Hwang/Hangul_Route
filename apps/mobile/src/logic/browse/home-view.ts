import type { Episode, QuestStepKind, StageDef, ThemeDef, UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { gridEpisodes } from '../../content/episodes';
import { localizeTheme } from '../content-locale';
import { themeColumnLabel } from '../journey';
import type { JourneyAccessInput } from '../journey-grid';
import { questStepLabel } from '../quest-steps';
import { itemAccess, type AccessItemKind, type ItemAccess } from './access';
import { accountHomeUrl } from './boot';
import { isOpenableEpisode, type BrowseBundle } from './bundle';
import type { BrowseSection } from './catalogue';
import type { QuestPlace } from './facts';
import type { ResolvedPass } from './pass';

/**
 * What the All lessons catalogue screens draw around the learner's own
 * visuals (F-BROWSE-001 sections 4.2, 4.5, 4.6 and 9; mocks
 * `design/screens/browse/home.md`, `episode.md`, `item.md`). Pure: the screens
 * pass the pass, the switch, the bundle and the dictionary, and draw what
 * comes back. No learner is part of any of it.
 */

export type ActivePass = Extract<ResolvedPass, { status: 'active' }>;

export interface HomeLines {
  /** Only with the switch on: the sampler line, or the fallback line for a fallback pass (section 4.5 item 3). */
  scope: 'sampler' | 'fallback' | null;
  /** Account passes that are not kept (a fallback included), online only (section 4.5 item 4, design decisions 3 and 24). */
  pointer: boolean;
  /** The keep switch: account passes that are not a fallback, and a kept pass (it shows on). Never a gate pass. */
  keep: boolean;
}

export function homeLines(i: { pass: ActivePass; gatingEnabled: boolean; online: boolean }): HomeLines {
  const { pass } = i;
  const scope = !i.gatingEnabled ? null : pass.fallback ? 'fallback' : pass.scope === 'sampler' ? 'sampler' : null;
  return {
    scope,
    pointer: pass.from === 'account' && i.online,
    keep: pass.from === 'kept' || (pass.from === 'account' && !pass.fallback),
  };
}

/** Where the pointer line goes: the persona home, else sign-in (no learner identifier, section 4.5). */
export function pointerUrl(lastPersona: Parameters<typeof accountHomeUrl>[0]): string {
  return accountHomeUrl(lastPersona);
}

/**
 * [ Open billing ] under a closed item's grown-up line: an account pass that is
 * not kept and not a fallback (sections 4.2 and 8). A gate or kept pass reaches
 * no purchase, account or settings surface.
 */
export function billingShown(pass: ActivePass): boolean {
  return pass.from === 'account' && !pass.fallback;
}

/** The section the arrow keys and Home / End move to in the one-row section control (section 7). */
export function sectionAfter(sections: readonly BrowseSection[], current: BrowseSection, key: string): BrowseSection | null {
  const at = sections.indexOf(current);
  if (at === -1 || sections.length === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return sections[(at + 1) % sections.length] as BrowseSection;
    case 'ArrowLeft':
    case 'ArrowUp':
      return sections[(at - 1 + sections.length) % sections.length] as BrowseSection;
    case 'Home':
      return sections[0] as BrowseSection;
    case 'End':
      return sections[sections.length - 1] as BrowseSection;
    default:
      return null;
  }
}

/** The section shown first: a requested one this build offers, else the default (the first). */
export function initialSection(sections: readonly BrowseSection[], requested: BrowseSection | undefined): BrowseSection {
  return requested !== undefined && sections.includes(requested) ? requested : (sections[0] as BrowseSection);
}

export interface BrowseAccessInput {
  bundle: BrowseBundle;
  scope: 'full' | 'sampler';
  gatingEnabled: boolean;
}

/** One item's access under this pass and switch (section 4.2). */
export function accessOf(item: { kind: AccessItemKind; id: string }, i: BrowseAccessInput): ItemAccess {
  return itemAccess(item, i.scope, i.gatingEnabled, { bundle: i.bundle });
}

/**
 * The learner `JourneyGrid`'s route-mark input for All lessons: no Next, no
 * "In your plan", and a quest is open unless this pass closes it, so the grid
 * draws the learner's own dotted ring on a closed cell (F-ENT-003 E3-5, never
 * a lock glyph) and nothing at all with the switch off.
 */
export function browseGridAccess(i: BrowseAccessInput): JourneyAccessInput {
  return {
    nextEpisodeId: null,
    inPlanEpisodeIds: new Set<string>(),
    isQuestOpen: (questId) => accessOf({ kind: 'quest', id: questId }, i) !== 'closed',
  };
}

/**
 * The grid episodes the learner `JourneyGrid` draws for All lessons: the
 * bundle's, with an openable episode that has no quest left in this bundle
 * drawn as the learner draws a coming-later cell, so the grid and the outline
 * agree (`browseJourneyRows`, section 11 BR-4 note).
 */
export function browseGridEpisodes(i: BrowseAccessInput): Episode[] {
  return gridEpisodes(i.bundle.episodes).map((episode) =>
    isOpenableEpisode(episode) && accessOf({ kind: 'episode', id: episode.id }, i) === 'later' ? { ...episode, status: 'preview' as const } : episode,
  );
}

type BrowseMessages = Messages['caregiver']['browse'];

/**
 * "Where it sits" (section 4.6, design decision 13): "Stage 1 · Letters ·
 * lesson 1 of 3" for a lesson in its grid episode; "Stage 3 · Life" for a
 * shelf story's quest (its story's home cell, no position). The theme word is
 * the Journey's column label, in the UI language (as on the home and the outline).
 */
export function whereLine(
  place: QuestPlace | { stage: StageDef['key']; theme: ThemeDef['key'] },
  stages: readonly StageDef[],
  themes: readonly ThemeDef[],
  m: BrowseMessages,
  locale: UiLocale,
): string {
  const stage = stages.find((s) => s.key === place.stage);
  const theme = themes.find((t) => t.key === place.theme);
  const parts = [m.item.where.stage(stage?.order ?? 0), theme ? themeColumnLabel(localizeTheme(theme, locale)) : place.theme];
  if ('kind' in place && place.kind === 'episode') parts.push(m.item.where.lesson(place.position, place.count));
  return parts.join(' · ');
}

/** The player's own step names, in order (`questStepLabel`, design decision 12). */
export function stepsLine(steps: readonly QuestStepKind[], step: Messages['learner']['quest']['step']): string {
  return steps.map((kind) => questStepLabel(kind, step)).join(' · ');
}

export type ViewedKind = 'episode' | 'quest' | 'story' | 'vocab-topic' | 'card';

export interface ItemViewedEvent {
  name: 'browse.item_viewed';
  payload: { kind: ViewedKind; itemId: string; access: 'open' | 'closed' };
}

/** `browse.item_viewed` when an outline, an item page or a card opens (section 9): a content id, never a person. */
export function itemViewedEvent(kind: ViewedKind, itemId: string, access: ItemAccess): ItemViewedEvent {
  return { name: 'browse.item_viewed', payload: { kind, itemId, access: access === 'closed' ? 'closed' : 'open' } };
}

export interface PlansTappedEvent {
  name: 'browse.plans_tapped';
  payload: { kind: 'quest' | 'story' | 'vocab-topic' };
}

/** `browse.plans_tapped` on [ Open billing ] (section 9; switch on only, since only then is an item closed). */
export function plansTappedEvent(kind: 'quest' | 'story' | 'vocab-topic'): PlansTappedEvent {
  return { name: 'browse.plans_tapped', payload: { kind } };
}
