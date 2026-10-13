import { CATALOG, type Catalog, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { plannableQuest } from '@/data/catalog';

/**
 * The plan builder's `&add=<questId>` (F-REPORT-001 RP-10): the learner report's **Add to a plan** opens the builder
 * with that quest pre-added as a draft item. Nothing is saved or published until the grown-up does it.
 */
export const ADD_PARAM = 'add';

/**
 * The quest `?add=` asks for, when the builder can add it (`plannableQuest`), and whether the address asked at all
 * (so the page can clean the parameter out of the address even when the id was unknown or closed).
 */
export function addFrom(params: { get(name: string): string | null } | null, source: Catalog = CATALOG): { requested: boolean; questId: string | null } {
  const raw = params?.get(ADD_PARAM);
  if (raw === null || raw === undefined) return { requested: false, questId: null };
  const id = raw.trim();
  return { requested: true, questId: id && plannableQuest(id, source) ? id : null };
}

/** The items with the quest appended once; the same array when it is already there (a duplicate add adds nothing). */
export function withQuest(items: PlanItem[], questId: string): PlanItem[] {
  return items.some((item) => item.kind === 'quest' && item.id === questId) ? items : [...items, { kind: 'quest', id: questId }];
}

/** The builder's draft shape (the page's `Draft`). */
export interface AddDraft {
  id?: string;
  title: string;
  items: PlanItem[];
  targets: string[] | null;
  meta: CurriculumMeta | null;
}

interface PlanForAdd {
  id: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds: string[] | null;
  publishedAt: string | null;
  meta?: CurriculumMeta | null;
}

/**
 * Where the quest lands. The plan the builder opens, when it is an unpublished classic draft, gets the quest (once:
 * `added` is false when it already held it). A published plan is never changed by a link, and a route draft keeps its
 * weeks, so otherwise a new untitled draft for everyone holds only the quest.
 */
export function draftForAdd(current: PlanForAdd | null, questId: string): { draft: AddDraft; added: boolean } {
  if (current && current.publishedAt === null && !current.meta) {
    const items = withQuest(current.items, questId);
    return { draft: { id: current.id, title: current.title, items, targets: current.targetLearnerIds, meta: null }, added: items !== current.items };
  }
  return { draft: { title: '', items: [{ kind: 'quest', id: questId }], targets: null, meta: null }, added: true };
}
