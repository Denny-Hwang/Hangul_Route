'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { ApiError, RelinkView, Roster } from '@/lib/console/api';
import { RELINK_REFRESH_MS, canReissueRescueCode, decideFailureNote, expiresLabel, requestedLabel } from '@/lib/console/relink';
import { ROUTES, spaceIdFrom } from '@/lib/console/routing';
import { aroundSlot } from '@/lib/i18n/slot';

/** What the page last did; worded at render time, so it follows the header language select. */
type Note = { kind: 'approved' | 'denied'; name: string } | { kind: 'decideFailed'; result: { error: ApiError; code?: string } } | { kind: 'issueFailed' };

/** console/relink-approval — F-TCH-001 §10.1. Identity and timing only; no progress numbers. */
function RelinkInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [requests, setRequests] = useState<RelinkView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    const [r, q] = await Promise.all([api.roster(spaceId), api.relinkRequests(spaceId)]);
    if (!r.ok || !q.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRoster(r.data);
    setRequests(q.data);
    setNow(new Date());
  }, [api, spaceId]);

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), RELINK_REFRESH_MS);
    return () => clearInterval(handle);
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const decide = async (req: RelinkView, approve: boolean): Promise<void> => {
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await api.decideRelink(spaceId, req.id, approve);
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'decideFailed', result });
    } else {
      setNote({ kind: approve ? 'approved' : 'denied', name: req.learnerName });
    }
    await load();
  };

  const issue = async (): Promise<void> => {
    const learner = roster?.learners.find((l) => l.id === pick);
    if (!api || !learner || !window.confirm(`${c.relink.issueAsk(learner.displayName)} ${c.oldCodeStops}`)) return;
    setBusy(true);
    const result = await api.issueRescueCode(learner.id);
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'issueFailed' });
      return;
    }
    setIssued({ name: learner.displayName, code: result.data.code });
  };

  const noteText = (n: Note): string =>
    n.kind === 'approved'
      ? c.relink.approved(n.name)
      : n.kind === 'denied'
        ? c.relink.denied(n.name)
        : n.kind === 'decideFailed'
          ? decideFailureNote(n.result, locale)
          : c.relink.issueFailed;
  const asking = aroundSlot(c.relink.askingToBe);

  return (
    <ConsoleShell onSignOut={signOut} title={roster ? c.relink.titleFor(roster.space.name) : c.relink.title}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>{c.relink.back(roster?.space.name ?? null)}</Link>
      </Muted>
      {failed ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{c.cantReach}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {note ? <Notice tone="success">{noteText(note)}</Notice> : null}

      {requests && requests.length === 0 ? (
        <div style={{ ...panelStyle, marginBottom: spacing.lg }}>
          <p style={{ margin: 0 }}>{c.relinkNothing}</p>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: spacing.md, marginBottom: spacing.xl }}>
        {(requests ?? []).map((req) => (
          <article key={req.id} style={panelStyle} data-testid="relink-card">
            <div style={{ fontSize: typography.size.bodyLg }}>
              {asking.before}
              <strong>{req.learnerName}</strong>
              {asking.after}
            </div>
            <Muted>
              {requestedLabel(req.requestedAt, now, locale)} · {req.platform ?? c.relink.device} · {expiresLabel(req.expiresAt, now, locale)}
            </Muted>
            <Muted>{c.relinkApproveHint}</Muted>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <Button tone="primary" disabled={busy} onClick={() => void decide(req, true)}>{c.relink.approve.cta}</Button>
              <Button disabled={busy} onClick={() => void decide(req, false)}>{c.relink.deny.cta}</Button>
            </div>
          </article>
        ))}
      </div>

      {/* A rescue code opens the whole snapshot: only a family re-issues one (SEC-4). */}
      {roster === null ? null : canReissueRescueCode(roster.space.kind) ? (
        <section style={panelStyle} aria-label={c.relink.anotherWay}>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>{c.relink.anotherWay}</h2>
          <Muted>{c.relinkAnotherWay}</Muted>
          {issued ? (
            <div style={{ margin: `${spacing.md}px 0` }}>
              <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{issued.name}</div>
              <div data-testid="rescue-code" style={{ fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.xs, fontFamily: typography.family.mono, overflowWrap: 'anywhere' }}>{issued.code}</div>
              <Muted>{c.rescueIssued}</Muted>
              <Button onClick={() => setIssued(null)}>{c.relink.done.cta}</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.sm }}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={c.relink.learnerLabel} style={{ padding: spacing.xs }}>
                <option value="">{c.relink.chooseLearner}</option>
                {(roster?.learners ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.displayName}</option>
                ))}
              </select>
              <Button disabled={busy || !pick} onClick={() => void issue()}>{c.relink.issue.cta}</Button>
            </div>
          )}
        </section>
      ) : (
        <section style={panelStyle} aria-label={c.relink.cardsLabel}>
          <Muted>{c.relinkCardsComeBack}</Muted>
        </section>
      )}
    </ConsoleShell>
  );
}

export default function RelinkPage(): JSX.Element {
  return (
    <Suspense fallback={<ConsoleShell>{null}</ConsoleShell>}>
      <RelinkInner />
    </Suspense>
  );
}
