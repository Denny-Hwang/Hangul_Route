'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { PlanItem } from '@hangul-route/content-schema';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import { catalogLabel, stage1Episodes, stage1Quests } from '@/data/stage1-catalog';
import type { PlanView, Roster } from '@/lib/console/api';
import { COPY } from '@/lib/console/copy';
import { currentPlan, dateKey, moveItem, oneExplicitPerDay, planReadout, planStatusLabel, readoutLine, spreadDates } from '@/lib/console/plans';
import { relativeDay } from '@/lib/console/rollup';
import { ROUTES, memberNoun } from '@/lib/console/routing';

interface Draft {
  id?: string;
  title: string;
  items: PlanItem[];
  targets: string[] | null;
}

const EMPTY: Draft = { title: '', items: [], targets: null };

/** console/plan-builder — F-PLAN-001 §3.5. Builder for drafts, readout once published. */
export default function PlanPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const spaceId = decodeURIComponent(params.id);
  const { ready, session, api, signOut } = useConsole();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(dateKey(new Date()));
  const [perWeek, setPerWeek] = useState(2);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [r, p] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId)]);
    if (!r.ok || !p.ok) {
      setError(COPY.cantReach);
      return;
    }
    setRoster(r.data);
    setPlans(p.data);
    const current = currentPlan(p.data);
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
  const noun = roster ? memberNoun(roster.space.kind) : 'learners';

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
    if (spaced.moved > 0) setNote(COPY.onePerDay);
    const result = await api.savePlan(spaceId, { id: draft.id, title: draft.title.trim(), items: spaced.items, targetLearnerIds: draft.targets, publish });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'invalid' ? "Some learners are no longer in this space — check who it's for." : "Didn't save. Try again.");
      return;
    }
    setDraft({ id: result.data.id, title: result.data.title, items: result.data.items, targets: result.data.targetLearnerIds });
    if (publish) setEditing(false);
    await load();
  };

  const archive = async (): Promise<void> => {
    if (!api || !current || !window.confirm(COPY.archivePlanConfirm)) return;
    setBusy(true);
    const result = await api.archivePlan(spaceId, current.id);
    setBusy(false);
    if (!result.ok) {
      setError("Couldn't archive it right now.");
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
    <ConsoleShell onSignOut={signOut} title={roster ? `${roster.space.name} · plan` : 'Plan'}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>← Back to {roster?.space.name ?? 'the space'}</Link>
      </Muted>
      {!api ? <Notice tone="nudge">The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.</Notice> : null}
      {error ? (
        <div style={{ ...panelStyle, marginBottom: spacing.md }}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}

      {readout && current ? (
        <section aria-label="Plan readout">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: typography.size.title, margin: 0 }}>{current.title}</h1>
            <span style={{ color: colors.text.muted }}>{planStatusLabel(current)}</span>
          </div>
          <Muted>
            {current.items.length} item{current.items.length === 1 ? '' : 's'} · for {current.targetLearnerIds ? `${current.targetLearnerIds.length} ${noun}` : `everyone in this ${roster?.space.kind ?? 'space'}`}
          </Muted>
          <div style={{ display: 'flex', gap: spacing.sm, margin: `${spacing.md}px 0` }}>
            <Button onClick={() => { setDraft({ id: current.id, title: current.title, items: current.items, targets: current.targetLearnerIds }); setEditing(true); }}>Edit</Button>
            <Button onClick={() => void archive()} disabled={busy}>Archive</Button>
            <Button onClick={startNew}>New plan</Button>
          </div>
          <ul style={{ ...panelStyle, listStyle: 'none', margin: `0 0 ${spacing.lg}px`, padding: spacing.lg }}>
            {current.items.map((item, k) => (
              <li key={`${item.kind}:${item.id}`} style={{ padding: `${spacing.xs}px 0`, color: colors.text.secondary }}>
                {k + 1}. {catalogLabel(item.kind, item.id)} {item.targetDate ? `· ${item.targetDate}` : ''} {item.note ? `· ${item.note}` : ''}
              </li>
            ))}
          </ul>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Progress</h2>
          <Muted>{COPY.readoutHint}</Muted>
          <div style={{ display: 'grid', gap: spacing.sm }}>
            {readout.length === 0 ? <Muted>No {noun} yet.</Muted> : null}
            {readout.map((row) => (
              <div key={row.learnerId} style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: spacing.md }} data-testid="readout-row">
                <strong>{row.name}</strong>
                <span style={{ color: colors.text.secondary }}>
                  {readoutLine(row)} · {relativeDay(row.lastActiveAt, now)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="Plan builder">
          <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.sm}px` }}>{draft.id ? 'Edit plan' : 'New plan'}</h1>
          {plans && plans.length === 0 ? <Notice>{COPY.noPlanYet}</Notice> : null}
          <Field name="title" label="Plan title" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Week 3" maxLength={60} required />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing.lg }}>
            <div style={panelStyle} aria-label="Catalog">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Catalog (Stage 1)</h2>
              {stage1Episodes.map((e) => (
                <div key={e.id} style={{ marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                    <strong>{e.titleEn}</strong>
                    <Button onClick={() => addItem({ kind: 'episode', id: e.id })}>+ episode</Button>
                  </div>
                  {e.questIds.map((qid) => {
                    const q = stage1Quests.find((x) => x.id === qid);
                    const added = draft.items.some((i) => i.kind === 'quest' && i.id === qid);
                    return (
                      <div key={qid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
                        <span>{q?.titleEn ?? qid} · {q?.estimatedMinutes ?? '?'} min</span>
                        <Button disabled={added} onClick={() => addItem({ kind: 'quest', id: qid })}>{added ? 'added' : '+ add'}</Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={panelStyle} aria-label="Your plan">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Your plan ({draft.items.length})</h2>
              {draft.items.length === 0 ? <Muted>Add quests or whole episodes from the catalog.</Muted> : null}
              {draft.items.map((item, k) => (
                <div key={`${item.kind}:${item.id}`} style={{ borderTop: `1px solid ${colors.border.subtle}`, padding: `${spacing.sm}px 0` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                    <span>{k + 1}. {catalogLabel(item.kind, item.id)}</span>
                    <span style={{ display: 'flex', gap: spacing.xxs }}>
                      <Button disabled={k === 0} onClick={() => setDraft((d) => ({ ...d, items: moveItem(d.items, k, k - 1) }))}>↑</Button>
                      <Button disabled={k === draft.items.length - 1} onClick={() => setDraft((d) => ({ ...d, items: moveItem(d.items, k, k + 1) }))}>↓</Button>
                      <Button onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== k) }))}>×</Button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                    <input type="date" value={item.targetDate ?? ''} onChange={(e) => updateItem(k, { targetDate: e.target.value || undefined })} aria-label={`Target date for item ${k + 1}`} style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
                    <input type="text" value={item.note ?? ''} placeholder="note (optional)" maxLength={80} onChange={(e) => updateItem(k, { note: e.target.value || undefined })} aria-label={`Note for item ${k + 1}`} style={{ flex: 1, padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: colors.text.muted, fontSize: typography.size.caption }}>Pace</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value || dateKey(new Date()))} aria-label="Start date" style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }} />
                <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} aria-label="Items per week" style={{ padding: spacing.xs, borderRadius: radii.sm, border: `1px solid ${colors.border.strong}` }}>
                  {[1, 2, 3, 5, 7].map((n) => (
                    <option key={n} value={n}>{n} / week</option>
                  ))}
                </select>
                <Button disabled={draft.items.length === 0} onClick={spread}>{COPY.spreadDates}</Button>
              </div>
              <div style={{ marginTop: spacing.md }}>
                <span style={{ color: colors.text.muted, fontSize: typography.size.caption }}>Who is this for</span>
                <label style={{ display: 'block' }}>
                  <input type="radio" name="targets" checked={draft.targets === null} onChange={() => setDraft((d) => ({ ...d, targets: null }))} /> everyone in this {roster?.space.kind ?? 'space'}
                </label>
                <label style={{ display: 'block' }}>
                  <input type="radio" name="targets" checked={draft.targets !== null} onChange={() => setDraft((d) => ({ ...d, targets: d.targets ?? [] }))} /> only:
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
                {draft.targets !== null && learners.length === 0 ? <Muted>No {noun} have joined yet.</Muted> : null}
              </div>
            </div>
          </div>
          {note ? <Notice tone="nudge">{note}</Notice> : null}
          <Muted>{COPY.draftNeverReaches}</Muted>
          <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <Button tone="primary" disabled={busy || !api || draft.items.length === 0 || draft.title.trim().length === 0 || (draft.targets !== null && draft.targets.length === 0)} onClick={() => void save(true)} testId="publish-plan">
              {busy ? 'Saving…' : COPY.publishPlan}
            </Button>
            <Button disabled={busy || !api || draft.items.length === 0 || draft.title.trim().length === 0} onClick={() => void save(false)}>{COPY.saveDraft}</Button>
            {current?.publishedAt ? <Button onClick={() => setEditing(false)}>Cancel</Button> : null}
          </div>
        </section>
      )}
    </ConsoleShell>
  );
}
