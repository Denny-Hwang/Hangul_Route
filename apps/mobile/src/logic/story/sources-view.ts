import type { KoText, Story, StoryFact, StorySource } from '@hangul-route/content-schema';
import { getMessages, type Messages } from '@hangul-route/i18n';
import { isSafeHttpsUrl } from './safe-url';
import { isTraditionalTale, sceneCaption } from './scene-view';

/**
 * The Sources screen as a pure view model (F-STORY-002 §3.8, §3.14 #1-2).
 * Everything comes from the story JSON; nothing is written per story.
 * Deterministic, no I/O.
 *
 * Facts are grouped by the first scene that cites them, in scene order. A
 * story's tiers retell the same scenes at different levels, so "Scene 3" is
 * the third scene of any tier: the tiers are read in order inside each scene
 * position, and the caption is the first tier's. A fact cited again later is
 * a "See fact" row; a fact no scene cites (used only by checks or culture
 * notes) goes in the "used" bucket, and the story card's fact, when no scene
 * cites it (F-STORY-006 §3.8 card-back facts), goes last under "On the story card".
 *
 * The words come from `learner.story.sources` in the UI locale (the screen
 * passes `useMessages()`'s subtree); English by default.
 */

export type SourcesCopy = Messages['learner']['story']['sources'];

export interface SourceView {
  title: string;
  publisher: string;
  url: string;
  accessed: string;
  accessedLabel: string;
  quoteOrLocator: string;
  /** "Source 2 of 3: <title>, <publisher>" (the focusable group's label). */
  label: string;
  /** Open link is offered only for a link the hand-off would accept (`isSafeHttpsUrl`). */
  openable: boolean;
}

export interface ApproximationView {
  text: string;
  rationaleEn: string;
  timeRelative: boolean;
  label: string;
  /** "This depends on today's date." for a time-relative rounding, else null. */
  note: string | null;
}

export interface FactCardView {
  id: string;
  claimEn: string;
  claimKo: string;
  scope: StoryFact['scope'];
  scopeLabel: string;
  rev: number;
  updated: boolean;
  /** "Updated <date>" from the newest visible erratum naming the fact, "Updated" without one, null when unrevised. */
  updatedLabel: string | null;
  sourcesHeading: string;
  sources: SourceView[];
  approximations: ApproximationView[];
}

export type SourcesItem = { type: 'fact'; fact: FactCardView } | { type: 'see'; factId: string; label: string };

export type SourcesSection =
  | { kind: 'scene'; sceneIndex: number; heading: string; caption: string; items: SourcesItem[] }
  | { kind: 'used'; heading: string; items: SourcesItem[] }
  | { kind: 'card'; heading: string; items: SourcesItem[] };

export interface CorrectionView {
  id: string;
  date: string;
  summaryEn: string;
  facts: Array<{ id: string; claimEn: string }>;
}

export interface SourcesView {
  storyId: string;
  title: KoText;
  traditional: boolean;
  /** Shown under the "Traditional tale" pill; null for a documented or original story. */
  originNoteEn: string | null;
  retellingNoteEn: string | null;
  referenceDisplay: string;
  checked: {
    passes: number;
    checkedAt: string;
    contentVer: number;
    scope: Story['verification']['scope'];
    label: string;
    clusterNote: string | null;
    /** "How it was checked" (reference text; may contain Hangul). */
    notes: string;
  };
  advisoryNoteEn: string | null;
  /** Visible errata, newest first; empty means no heading at all. */
  corrections: CorrectionView[];
  sections: SourcesSection[];
  counts: { facts: number; sources: number; label: string };
  empty: boolean;
  emptyLabel: string;
}

function sourceView(copy: SourcesCopy, source: StorySource, index: number, total: number): SourceView {
  return {
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    accessed: source.accessed,
    accessedLabel: copy.accessed(source.accessed),
    quoteOrLocator: source.quoteOrLocator,
    label: copy.sourceLabel(index + 1, total, source.title, source.publisher),
    openable: isSafeHttpsUrl(source.url),
  };
}

function approximationsOf(copy: SourcesCopy, story: Story, factId: string): ApproximationView[] {
  const seen = new Set<string>();
  const views: ApproximationView[] = [];
  for (const tier of story.tiers) {
    for (const scene of tier.scenes) {
      for (const a of scene.approximations) {
        const key = `${a.text}\n${a.rationaleEn}`;
        if (!a.factIds.includes(factId) || seen.has(key)) continue;
        seen.add(key);
        views.push({
          text: a.text,
          rationaleEn: a.rationaleEn,
          timeRelative: a.timeRelative,
          label: copy.approximation(a.text, a.rationaleEn),
          note: a.timeRelative ? copy.dependsOnToday : null,
        });
      }
    }
  }
  return views;
}

/** Visible errata, newest first; on the same date the later entry first. */
function visibleErrata(story: Story) {
  return story.errata
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.show)
    .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i)
    .map(({ e }) => e);
}

function factCard(copy: SourcesCopy, story: Story, fact: StoryFact, errata: ReturnType<typeof visibleErrata>): FactCardView {
  const updated = fact.rev > 1;
  const erratum = errata.find((e) => e.factIds.includes(fact.id));
  return {
    id: fact.id,
    claimEn: fact.claimEn,
    claimKo: fact.claimKo,
    scope: fact.scope,
    scopeLabel: fact.scope === 'documented' ? copy.scope.documented : copy.scope.inTheTale,
    rev: fact.rev,
    updated,
    updatedLabel: !updated ? null : erratum ? copy.updatedOn.pill(erratum.date) : copy.updated.pill,
    sourcesHeading: copy.sourcesHeading(fact.sources.length),
    sources: fact.sources.map((s, i) => sourceView(copy, s, i, fact.sources.length)),
    approximations: approximationsOf(copy, story, fact.id),
  };
}

function sectionsOf(copy: SourcesCopy, story: Story, errata: ReturnType<typeof visibleErrata>): SourcesSection[] {
  const factById = new Map(story.facts.map((f) => [f.id, f]));
  const shown = new Set<string>();
  const sections: SourcesSection[] = [];
  const longest = Math.max(0, ...story.tiers.map((t) => t.scenes.length));

  for (let index = 0; index < longest; index += 1) {
    const items: SourcesItem[] = [];
    const inSection = new Set<string>();
    for (const tier of story.tiers) {
      const scene = tier.scenes[index];
      if (!scene) continue;
      for (const id of scene.factIds) {
        const fact = factById.get(id);
        if (!fact || inSection.has(id)) continue;
        inSection.add(id);
        if (shown.has(id)) {
          items.push({ type: 'see', factId: id, label: copy.seeFact(id) });
        } else {
          shown.add(id);
          items.push({ type: 'fact', fact: factCard(copy, story, fact, errata) });
        }
      }
    }
    if (items.length > 0) {
      // index < longest, so some tier has this scene; the first tier's caption heads the section.
      const first = story.tiers.find((t) => index < t.scenes.length)!.scenes[index]!;
      sections.push({ kind: 'scene', sceneIndex: index, heading: copy.sceneHeading(index + 1), caption: sceneCaption(story, first), items });
    }
  }

  const cardFactId = story.card?.factId;
  const uncited = story.facts.filter((f) => !shown.has(f.id));
  const used = uncited.filter((f) => f.id !== cardFactId);
  const onCard = uncited.filter((f) => f.id === cardFactId);
  if (used.length > 0) {
    sections.push({
      kind: 'used',
      heading: copy.usedInQuestions,
      items: used.map((f) => ({ type: 'fact', fact: factCard(copy, story, f, errata) })),
    });
  }
  if (onCard.length > 0) {
    sections.push({
      kind: 'card',
      heading: copy.onTheCard,
      items: onCard.map((f) => ({ type: 'fact', fact: factCard(copy, story, f, errata) })),
    });
  }
  return sections;
}

export function buildSourcesView(story: Story, copy: SourcesCopy = getMessages('en').learner.story.sources): SourcesView {
  const traditional = isTraditionalTale(story);
  const errata = visibleErrata(story);
  const factById = new Map(story.facts.map((f) => [f.id, f]));
  const sourceCount = new Set(story.facts.flatMap((f) => f.sources.map((s) => s.url))).size;
  const { verification } = story;

  return {
    storyId: story.id,
    title: story.title,
    traditional,
    originNoteEn: traditional ? story.origin.noteEn : null,
    retellingNoteEn: traditional ? (story.origin.retellingNoteEn ?? null) : null,
    referenceDisplay: story.referenceDisplay,
    checked: {
      passes: verification.passes,
      checkedAt: verification.checkedAt,
      contentVer: story.contentVer,
      scope: verification.scope,
      label: copy.checked(verification.passes, verification.checkedAt, story.contentVer),
      clusterNote: verification.scope === 'cluster' ? copy.clusterChecked : null,
      notes: verification.notes,
    },
    advisoryNoteEn: story.review.advisory.length > 0 ? (story.review.advisoryNoteEn ?? null) : null,
    corrections: errata.map((e) => ({
      id: e.id,
      date: e.date,
      summaryEn: e.summaryEn,
      facts: e.factIds.flatMap((id) => {
        const fact = factById.get(id);
        return fact ? [{ id, claimEn: fact.claimEn }] : [];
      }),
    })),
    sections: sectionsOf(copy, story, errata),
    counts: { facts: story.facts.length, sources: sourceCount, label: copy.counts(story.facts.length, sourceCount) },
    empty: story.facts.length === 0,
    emptyLabel: copy.noSources,
  };
}

/** Where a fact's card is (deep link `factId`): never a "See fact" row. */
export function findFactSection(view: SourcesView, factId: string): { section: number; item: number } | null {
  for (let section = 0; section < view.sections.length; section += 1) {
    const item = view.sections[section]!.items.findIndex((i) => i.type === 'fact' && i.fact.id === factId);
    if (item >= 0) return { section, item };
  }
  return null;
}

/** The section of a scene (deep link `sceneIndex`), else the next scene that has one, else null. */
export function findSceneSection(view: SourcesView, sceneIndex: number): number | null {
  const found = view.sections.findIndex((s) => s.kind === 'scene' && s.sceneIndex >= sceneIndex);
  return found >= 0 ? found : null;
}
