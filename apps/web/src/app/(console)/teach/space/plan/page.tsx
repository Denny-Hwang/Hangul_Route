'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { CurriculumMeta, PlanItem } from '@hangul-route/content-schema';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsole } from '@/components/console/use-console';
import { PlanDraftItems, PlanReadout } from '@/components/console/PlanParts';
import { PlanSwitcher, RouteDraftItems, RouteReadout } from '@/components/console/RoutePlanParts';
import { builderEpisodes, questsOf } from '@/data/catalog';
import type { PlanView, Roster, SpaceListItem } from '@/lib/console/api';
import { lectureModeEnabled } from '@/lib/console/config';
import { canComposeIn } from '@/lib/console/lecture';
import { type RepaceResult, repaceSaveBody, reweek, selectedPlan, swapRouteItems, withTargetDate } from '@/lib/console/curriculum';
import { builderOnLoad, suggestFrom, suggestionFor, suggestionNoticeShown } from '@/lib/console/placement';
import { addFrom, draftForAdd, withQuest } from '@/lib/console/plan-add';
import { type PlanError, dateKey, memberKind, moveItem, oneExplicitPerDay, planErrorText, planEveryone, planReadout, spreadDates } from '@/lib/console/plans';
import { relativeDay } from '@/lib/console/rollup';
import { ROUTES, spaceIdFrom } from '@/lib/console/routing';

interface Draft {
  id?: string;
  title: string;
  items: PlanItem[];
  targets: string[] | null;
  /** A route plan's curriculum (F-PLAN-002); never sent on a draft save, so the stored meta is kept. */
  meta: CurriculumMeta | null;
}

const EMPTY: Draft = { title: '', items: [], targets: null, meta: null };

const draftOf = (plan: PlanView): Draft => ({ id: plan.id, title: plan.title, items: plan.items, targets: plan.targetLearnerIds, meta: plan.meta ?? null });

/** console/plan-builder — F-PLAN-001 §3.5. Builder for drafts, readout once published. */
function PlanInner(): JSX.Element {
  const params = useSearchParams();
  const router = useRouter();
  const spaceId = spaceIdFrom(params);
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const p = c.plan;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  // Lecture mode's "Present this plan" shows for the roles that compose plans (F-TCH-004 §3.11).
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [draft, setDraftState] = useState<Draft>(EMPTY);
  // Unsaved edits in the builder: switching plans asks first (F-PLAN-002 section 3.8 step 5).
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  // The switcher picks a plan; `?plan=` opens one (the wizard's draft).
  const [selectedId, setSelectedId] = useState<string | null>(params?.get('plan') ?? null);
  // Keys, not text: the messages are looked up at render time, so they follow the header language select.
  const [error, setError] = useState<PlanError | null>(null);
  const [note, setNote] = useState<'onePerDay' | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(dateKey(new Date()));
  const [perWeek, setPerWeek] = useState(2);
  // `?suggest=<learner>` from the roster (F-PLC-001 section 3.9): a one-quest draft for that learner, applied once.
  // Read once: the param leaves the address when the draft opens, so a refresh never opens a second one.
  const [suggestId] = useState(() => suggestFrom(params));
  const suggestionApplied = useRef(false);
  // True while the suggestion is open and never saved: a reload of the page data keeps it (`builderOnLoad`).
  const suggestionOpen = useRef(false);
  // `?add=<questId>` from a learner report's Add to a plan (F-REPORT-001 RP-10): the quest pre-added as a draft item,
  // once. Read once, like the suggestion: the param leaves the address when the draft opens, so a refresh adds nothing.
  const [addRequest] = useState(() => addFrom(params));
  const addApplied = useRef(false);
  // True while a draft the quest was added to is open and never saved: a reload of the page data keeps it.
  const addOpen = useRef(false);
  // True while the add opened a new unsaved draft (the open plan was published or a route): the switcher then marks no
  // stored plan, so each one can be opened from it, as with the suggestion.
  const [addedNew, setAddedNew] = useState(false);
  // The learner the open draft was suggested for; a key, so the notice follows the header language select.
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);
  // Read by `load` without making a language switch reload (and replace) the open draft.
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const now = new Date();

  /** Replace the draft with a stored plan (not an edit). */
  const openDraft = (next: Draft): void => {
    setDraftState(next);
    setDirty(false);
    suggestionOpen.current = false;
    addOpen.current = false;
    setAddedNew(false);
    setSuggestedFor(null);
  };
  /** An edit in the builder. */
  const setDraft = (update: (d: Draft) => Draft): void => {
    setDraftState(update);
    setDirty(true);
  };

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [rosterRes, plansRes, spacesRes] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId), lectureModeEnabled() ? api.listSpaces() : null]);
    if (spacesRes?.ok) setSpaces(spacesRes.data);
    if (!rosterRes.ok || !plansRes.ok) {
      setError('cantReach');
      return;
    }
    setRoster(rosterRes.data);
    setPlans(plansRes.data);
    const suggestion = suggestionFor(rosterRes.data.learners, suggestId, localeRef.current);
    const step = builderOnLoad({ suggestionApplied: suggestionApplied.current, suggestionOpen: suggestionOpen.current || addOpen.current, suggestionFound: suggestion !== null });
    if (step === 'keep') return;
    const addNow = addRequest.requested && !addApplied.current;
    if (addNow) addApplied.current = true;
    const addId = addNow ? addRequest.questId : null;
    if (step === 'suggestion' && suggestion) {
      // An unsaved new draft: an ordinary plan for this learner only, never a change to their check or progress.
      suggestionApplied.current = true;
      suggestionOpen.current = true;
      const items = addId ? withQuest(suggestion.draft.items, addId) : suggestion.draft.items;
      setDraftState({ title: suggestion.draft.title, items, targets: suggestion.draft.targets, meta: null });
      setDirty(true);
      setEditing(true);
      setSuggestedFor(suggestId);
      router.replace(ROUTES.spacePlan(spaceId, undefined, rosterRes.data.space.kind));
      return;
    }
    const current = selectedPlan(plansRes.data, selectedId);
    if (addId) {
      // A link never publishes or saves: the quest joins the open classic draft, or a new draft holds it.
      const { draft: next, added } = draftForAdd(current, addId);
      setDraftState(next);
      setDirty(added);
      setEditing(true);
      suggestionOpen.current = false;
      addOpen.current = added;
      setAddedNew(next.id === undefined);
      setSuggestedFor(null);
      router.replace(ROUTES.spacePlan(spaceId, selectedId ?? undefined, rosterRes.data.space.kind));
      return;
    }
    // An unknown or closed quest adds nothing; the builder opens as it always does, with a clean address.
    if (addNow) router.replace(ROUTES.spacePlan(spaceId, selectedId ?? undefined, rosterRes.data.space.kind));
    if (current && !current.publishedAt) {
      openDraft(draftOf(current));
      setEditing(true);
    } else if (!current) {
      setEditing(true);
    }
  }, [api, spaceId, selectedId, suggestId, addRequest, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const current = plans ? selectedPlan(plans, selectedId) : null;
  const presentable = lectureModeEnabled() && canComposeIn(spaces, spaceId);
  const learners = roster?.learners ?? [];
  // Before the roster loads the page says "learners" and "this space", as it always has.
  const kind = roster?.space.kind ?? null;

  const addItem = (item: PlanItem): void => {
    setDraft((d) => (d.items.some((i) => i.kind === item.kind && i.id === item.id) ? d : { ...d, items: [...d.items, item] }));
  };
  const updateItem = (index: number, patch: Partial<PlanItem>): void => {
    setDraft((d) => ({
      ...d,
      items: d.items.map((i, k) => {
        if (k !== index) return i;
        const next = { ...i, ...patch };
        // A route item's week follows its date, so it moves to the week that holds the new day.
        return d.meta && 'targetDate' in patch ? withTargetDate(d.meta.weeks, next, patch.targetDate) : next;
      }),
    }));
  };
  const spread = (): void => {
    setDraft((d) => {
      const dates = spreadDates(start, perWeek, d.items.length);
      return { ...d, items: d.items.map((i, k) => ({ ...i, targetDate: dates[k] })) };
    });
    setNote(null);
  };

  const save = async (publish: boolean): Promise<void> => {
    if (!api || draft.items.length === 0 || draft.title.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const spaced = oneExplicitPerDay(draft.items);
    if (spaced.moved > 0) setNote('onePerDay');
    const items = draft.meta ? reweek(draft.meta.weeks, spaced.items) : spaced.items;
    const result = await api.savePlan(spaceId, { id: draft.id, title: draft.title.trim(), items, targetLearnerIds: draft.targets, publish });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid' ? 'saveInvalid' : 'saveFailed');
      return;
    }
    openDraft(draftOf(result.data));
    setSelectedId(result.data.id);
    if (publish) setEditing(false);
    await load();
  };

  /** Re-pace from today (F-PLAN-002 section 3.7): the same plan id, the new items and meta, still published. */
  const saveRepaced = async (plan: PlanView, repaced: RepaceResult): Promise<boolean> => {
    const body = repaceSaveBody(plan, repaced);
    if (!api || !body) return false;
    setBusy(true);
    const result = await api.savePlan(spaceId, body);
    setBusy(false);
    if (result.ok) await load();
    return result.ok;
  };

  // While an unsaved new draft (the suggestion, or one the add opened) is open the switcher marks no stored plan, so
  // every plan can be opened from it.
  const openPlanId = suggestedFor || addedNew ? null : (current?.id ?? null);

  const select = (plan: PlanView): void => {
    if (plan.id === openPlanId) return;
    if (editing && dirty && !window.confirm(c.curriculum.builder.discardEdits)) return;
    setSelectedId(plan.id);
    setNote(null);
    if (plan.publishedAt) {
      openDraft(EMPTY);
      setEditing(false);
    } else {
      openDraft(draftOf(plan));
      setEditing(true);
    }
  };

  const archive = async (): Promise<void> => {
    if (!api || !current || !window.confirm(c.archivePlanConfirm)) return;
    setBusy(true);
    const result = await api.archivePlan(spaceId, current.id);
    setBusy(false);
    if (!result.ok) {
      setError('archiveFailed');
      return;
    }
    openDraft(EMPTY);
    setSelectedId(null);
    setEditing(true);
    await load();
  };

  const startNew = (): void => {
    openDraft(EMPTY);
    setEditing(true);
  };

  const readout = current?.publishedAt && !editing ? planReadout(current.id, learners) : null;
  const suggestNotice = suggestionNoticeShown(draft, suggestedFor) ? (suggestionFor(learners, suggestedFor, locale)?.notice ?? null) : null;

  return (
    <AdultFrame onSignOut={signOut} title={roster ? p.titleFor(roster.space.name) : p.title}>
      <Muted>
        <Link href={ROUTES.space(spaceId, roster?.space.kind)}>{p.back(roster?.space.name ?? null)}</Link>
      </Muted>
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {error ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: 0 }}>{planErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {plans ? <PlanSwitcher plans={plans} selectedId={openPlanId} onSelect={select} locale={locale} /> : null}

      {readout && current ? (
        <PlanReadout
          plan={current}
          rows={readout}
          kind={kind}
          busy={busy}
          now={now}
          onEdit={() => {
            openDraft(draftOf(current));
            setEditing(true);
          }}
          onArchive={() => void archive()}
          onNew={startNew}
          route={
            current.meta ? (
              <RouteReadout
                key={current.id}
                plan={{ ...current, meta: current.meta }}
                rows={readout}
                today={dateKey(now)}
                locale={locale}
                busy={busy}
                onSave={(repaced) => saveRepaced(current, repaced)}
                relativeDayOf={(iso) => relativeDay(iso, now, locale)}
              />
            ) : undefined
          }
          presentHref={presentable ? ROUTES.spaceLecture(spaceId, 'plan', current.id, roster?.space.kind) : undefined}
        />
      ) : (
        <section aria-label={p.builderLabel}>
          <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.sm}px` }}>{draft.id ? p.editTitle : p.newTitle}</h1>
          {suggestNotice ? <Notice>{suggestNotice}</Notice> : null}
          {plans && plans.length === 0 ? (
            <Notice>
              {c.noPlanYet}{' '}
              <Link href={ROUTES.spaceCurriculum(spaceId, roster?.space.kind)}>
                <Button testId="plan-from-template">{c.curriculum.builder.fromTemplate.cta}</Button>
              </Link>
            </Notice>
          ) : null}
          <Field name="title" label={p.titleField.label} value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder={p.titleField.placeholder} maxLength={60} required />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: spacing.lg }}>
            <div style={panelStyle} aria-label={p.catalog.label}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{p.catalog.title}</h2>
              {builderEpisodes().map((e) => (
                <div key={e.episodeId} style={{ marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                    <strong>{e.title}</strong>
                    <Button onClick={() => addItem({ kind: 'episode', id: e.episodeId })}>{p.catalog.addEpisode.cta}</Button>
                  </div>
                  {questsOf(e.episodeId).map((q) => {
                    const added = draft.items.some((i) => i.kind === 'quest' && i.id === q.id);
                    return (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
                        <span>{p.catalog.questLine(q.title, q.minutes)}</span>
                        <Button disabled={added} onClick={() => addItem({ kind: 'quest', id: q.id })}>{added ? p.catalog.added.cta : p.catalog.add.cta}</Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={panelStyle} aria-label={p.yours.label}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{p.yours.title(draft.items.length)}</h2>
              {draft.meta ? (
                <RouteDraftItems
                  meta={draft.meta}
                  items={draft.items}
                  locale={locale}
                  onSwap={(a, b) => setDraft((d) => ({ ...d, items: swapRouteItems(d.items, a, b) }))}
                  onRemove={(index) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
                  onUpdate={updateItem}
                />
              ) : (
                <PlanDraftItems
                  items={draft.items}
                  onMove={(from, to) => setDraft((d) => ({ ...d, items: moveItem(d.items, from, to) }))}
                  onRemove={(index) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
                  onUpdate={updateItem}
                />
              )}
              {/* A route's dates come from its calendar (F-PLAN-002 section 3.8 step 5), so Spread dates is for a classic plan only. */}
              {draft.meta ? null : (
                <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: colors.text.muted, fontSize: typography.size.caption }}>{p.pace.title}</span>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value || dateKey(new Date()))} aria-label={p.pace.start} style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
                  <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} aria-label={p.pace.perWeekLabel} style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }}>
                    {[1, 2, 3, 5, 7].map((n) => (
                      <option key={n} value={n}>{p.pace.perWeek(n)}</option>
                    ))}
                  </select>
                  <Button disabled={draft.items.length === 0} onClick={spread}>{c.spreadDates}</Button>
                </div>
              )}
              <div style={{ marginTop: spacing.md }}>
                <span style={{ color: colors.text.muted, fontSize: typography.size.caption }}>{p.who.title}</span>
                <label style={{ display: 'block' }}>
                  <input type="radio" name="targets" checked={draft.targets === null} onChange={() => setDraft((d) => ({ ...d, targets: null }))} /> {planEveryone(kind, locale)}
                </label>
                <label style={{ display: 'block' }}>
                  <input type="radio" name="targets" checked={draft.targets !== null} onChange={() => setDraft((d) => ({ ...d, targets: d.targets ?? [] }))} /> {p.who.only}
                </label>
                {draft.targets !== null
                  ? learners.map((l) => (
                      <label key={l.id} style={{ display: 'inline-block', marginRight: spacing.md, paddingLeft: spacing.lg }}>
                        <input
                          type="checkbox"
                          checked={draft.targets?.includes(l.id) ?? false}
                          onChange={(e) => setDraft((d) => ({ ...d, targets: e.target.checked ? [...(d.targets ?? []), l.id] : (d.targets ?? []).filter((id) => id !== l.id) }))}
                        />{' '}
                        {l.displayName}
                      </label>
                    ))
                  : null}
                {draft.targets !== null && learners.length === 0 ? <Muted>{p.noneJoined[memberKind(kind)]}</Muted> : null}
              </div>
            </div>
          </div>
          {note ? <Notice tone="nudge">{c[note]}</Notice> : null}
          <Muted>{c.draftNeverReaches}</Muted>
          <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <Button tone="primary" disabled={busy || !api || draft.items.length === 0 || draft.title.trim().length === 0 || (draft.targets !== null && draft.targets.length === 0)} onClick={() => void save(true)} testId="publish-plan">
              {busy ? p.saving.cta : c.publishPlan}
            </Button>
            <Button disabled={busy || !api || draft.items.length === 0 || draft.title.trim().length === 0} onClick={() => void save(false)}>{c.saveDraft}</Button>
            {current?.publishedAt && !addedNew ? (
              <Button
                onClick={() => {
                  // Back to the published plan's readout; any unsaved suggestion or add is closed with the edits.
                  openDraft(EMPTY);
                  setEditing(false);
                }}
              >
                {p.cancel.cta}
              </Button>
            ) : null}
          </div>
        </section>
      )}
    </AdultFrame>
  );
}

export default function PlanPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <PlanInner />
    </Suspense>
  );
}
