'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { PlanItem } from '@hangul-route/content-schema';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { PlanDraftItems, PlanReadout } from '@/components/console/PlanParts';
import { stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import type { PlanView, Roster } from '@/lib/console/api';
import { type PlanError, currentPlan, dateKey, memberKind, moveItem, oneExplicitPerDay, planErrorText, planEveryone, planReadout, spreadDates } from '@/lib/console/plans';
import { ROUTES, spaceIdFrom } from '@/lib/console/routing';

interface Draft {
  id?: string;
  title: string;
  items: PlanItem[];
  targets: string[] | null;
}

const EMPTY: Draft = { title: '', items: [], targets: null };

/** console/plan-builder — F-PLAN-001 §3.5. Builder for drafts, readout once published. */
function PlanInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const p = c.plan;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);
  // Keys, not text: the messages are looked up at render time, so they follow the header language select.
  const [error, setError] = useState<PlanError | null>(null);
  const [note, setNote] = useState<'onePerDay' | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(dateKey(new Date()));
  const [perWeek, setPerWeek] = useState(2);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [rosterRes, plansRes] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId)]);
    if (!rosterRes.ok || !plansRes.ok) {
      setError('cantReach');
      return;
    }
    setRoster(rosterRes.data);
    setPlans(plansRes.data);
    const current = currentPlan(plansRes.data);
    if (current && !current.publishedAt) {
      setDraft({ id: current.id, title: current.title, items: current.items, targets: current.targetLearnerIds });
      setEditing(true);
    } else if (!current) {
      setEditing(true);
    }
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const current = plans ? currentPlan(plans) : null;
  const learners = roster?.learners ?? [];
  // Before the roster loads the page says "learners" and "this space", as it always has.
  const kind = roster?.space.kind ?? null;

  const addItem = (item: PlanItem): void => {
    setDraft((d) => (d.items.some((i) => i.kind === item.kind && i.id === item.id) ? d : { ...d, items: [...d.items, item] }));
  };
  const updateItem = (index: number, patch: Partial<PlanItem>): void => {
    setDraft((d) => ({ ...d, items: d.items.map((i, k) => (k === index ? { ...i, ...patch } : i)) }));
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
    const result = await api.savePlan(spaceId, { id: draft.id, title: draft.title.trim(), items: spaced.items, targetLearnerIds: draft.targets, publish });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid' ? 'saveInvalid' : 'saveFailed');
      return;
    }
    setDraft({ id: result.data.id, title: result.data.title, items: result.data.items, targets: result.data.targetLearnerIds });
    if (publish) setEditing(false);
    await load();
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
    setDraft(EMPTY);
    setEditing(true);
    await load();
  };

  const startNew = (): void => {
    setDraft(EMPTY);
    setEditing(true);
  };

  const readout = current?.publishedAt && !editing ? planReadout(current.id, learners) : null;

  return (
    <ConsoleShell onSignOut={signOut} title={roster ? p.titleFor(roster.space.name) : p.title}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>{p.back(roster?.space.name ?? null)}</Link>
      </Muted>
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {error ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: 0 }}>{planErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}

      {readout && current ? (
        <PlanReadout
          plan={current}
          rows={readout}
          kind={kind}
          busy={busy}
          now={now}
          onEdit={() => {
            setDraft({ id: current.id, title: current.title, items: current.items, targets: current.targetLearnerIds });
            setEditing(true);
          }}
          onArchive={() => void archive()}
          onNew={startNew}
        />
      ) : (
        <section aria-label={p.builderLabel}>
          <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.sm}px` }}>{draft.id ? p.editTitle : p.newTitle}</h1>
          {plans && plans.length === 0 ? <Notice>{c.noPlanYet}</Notice> : null}
          <Field name="title" label={p.titleField.label} value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder={p.titleField.placeholder} maxLength={60} required />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: spacing.lg }}>
            <div style={panelStyle} aria-label={p.catalog.label}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{p.catalog.title}</h2>
              {stage1Episodes.map((e) => (
                <div key={e.id} style={{ marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                    <strong>{e.titleEn}</strong>
                    <Button onClick={() => addItem({ kind: 'episode', id: e.id })}>{p.catalog.addEpisode.cta}</Button>
                  </div>
                  {e.questIds.map((qid) => {
                    const q = stage1Quests.find((x) => x.id === qid);
                    const added = draft.items.some((i) => i.kind === 'quest' && i.id === qid);
                    return (
                      <div key={qid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
                        <span>{p.catalog.questLine(q?.titleEn ?? qid, q?.estimatedMinutes ?? null)}</span>
                        <Button disabled={added} onClick={() => addItem({ kind: 'quest', id: qid })}>{added ? p.catalog.added.cta : p.catalog.add.cta}</Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={panelStyle} aria-label={p.yours.label}>
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{p.yours.title(draft.items.length)}</h2>
              <PlanDraftItems
                items={draft.items}
                onMove={(from, to) => setDraft((d) => ({ ...d, items: moveItem(d.items, from, to) }))}
                onRemove={(index) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
                onUpdate={updateItem}
              />
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
            {current?.publishedAt ? <Button onClick={() => setEditing(false)}>{p.cancel.cta}</Button> : null}
          </div>
        </section>
      )}
    </ConsoleShell>
  );
}

export default function PlanPage(): JSX.Element {
  return (
    <Suspense fallback={<ConsoleShell>{null}</ConsoleShell>}>
      <PlanInner />
    </Suspense>
  );
}
