'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { RelinkView, Roster } from '@/lib/console/api';
import { COPY } from '@/lib/console/copy';
import { RELINK_REFRESH_MS, expiresLabel, requestedLabel } from '@/lib/console/relink';
import { ROUTES } from '@/lib/console/routing';

/** console/relink-approval — F-TCH-001 §10.1. Identity and timing only; no progress numbers. */
export default function RelinkPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const spaceId = decodeURIComponent(params.id);
  const { ready, session, api, signOut } = useConsole();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [requests, setRequests] = useState<RelinkView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    const [r, q] = await Promise.all([api.roster(spaceId), api.relinkRequests(spaceId)]);
    if (!r.ok || !q.ok) {
      setError(COPY.cantReach);
      return;
    }
    setError(null);
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
      setNote(result.error === 'unknown' ? 'This request already closed — the learner can ask again.' : "Didn't go through. Try again.");
    } else {
      setNote(approve ? `${req.learnerName} can open their new device now.` : `Closed. ${req.learnerName}'s device will say "ask your teacher".`);
    }
    await load();
  };

  const issue = async (): Promise<void> => {
    const learner = roster?.learners.find((l) => l.id === pick);
    if (!api || !learner || !window.confirm(`Issue a new rescue code for ${learner.displayName}? ${COPY.oldCodeStops}`)) return;
    setBusy(true);
    const result = await api.issueRescueCode(learner.id);
    setBusy(false);
    if (!result.ok) {
      setNote("Couldn't issue a code right now.");
      return;
    }
    setIssued({ name: learner.displayName, code: result.data.code });
  };

  return (
    <ConsoleShell onSignOut={signOut} title={roster ? `${roster.space.name} · re-link requests` : 'Re-link requests'}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>← Back to {roster?.space.name ?? 'the space'}</Link>
      </Muted>
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      {requests && requests.length === 0 ? (
        <div style={{ ...panelStyle, marginBottom: spacing.lg }}>
          <p style={{ margin: 0 }}>{COPY.relinkNothing}</p>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: spacing.md, marginBottom: spacing.xl }}>
        {(requests ?? []).map((req) => (
          <article key={req.id} style={panelStyle} data-testid="relink-card">
            <div style={{ fontSize: typography.size.bodyLg }}>
              Someone is asking to be <strong>{req.learnerName}</strong>
            </div>
            <Muted>
              {requestedLabel(req.requestedAt, now)} · {req.platform ?? 'device'} · {expiresLabel(req.expiresAt, now)}
            </Muted>
            <Muted>{COPY.relinkApproveHint}</Muted>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <Button tone="primary" disabled={busy} onClick={() => void decide(req, true)}>Approve</Button>
              <Button disabled={busy} onClick={() => void decide(req, false)}>Deny</Button>
            </div>
          </article>
        ))}
      </div>

      <section style={panelStyle} aria-label="Another way">
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Another way</h2>
        <Muted>{COPY.relinkAnotherWay}</Muted>
        {issued ? (
          <div style={{ margin: `${spacing.md}px 0` }}>
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{issued.name}</div>
            <div data-testid="rescue-code" style={{ fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.xs, fontFamily: typography.family.mono }}>{issued.code}</div>
            <Muted>{COPY.rescueIssued}</Muted>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.sm }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Learner" style={{ padding: spacing.xs }}>
              <option value="">Choose a learner…</option>
              {(roster?.learners ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
            <Button disabled={busy || !pick} onClick={() => void issue()}>Issue a new rescue code</Button>
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}
