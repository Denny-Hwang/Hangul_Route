'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useId, useState } from 'react';
import { Button, Muted, Notice, panelStyle, selectBase } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConfirm } from '@/components/console/ConfirmSheet';
import { useConsole } from '@/components/console/use-console';
import type { RelinkView, Roster } from '@/lib/console/api';
import { RELINK_REFRESH_MS, type RelinkNote, canReissueRescueCode, expiresLabel, nextMinuteTick, platformLabel, relinkNoteText, requestedLabel } from '@/lib/console/relink';
import { spaceIdFrom } from '@/lib/console/routing';
import { spaceSubPageBack } from '@/lib/console/page-back';
import { aroundSlot } from '@/lib/i18n/slot';
import { headRem, rem } from '@/lib/console/rem';

/**
 * console/relink-approval — F-TCH-001 §10.1. Identity and timing only; no progress numbers. AMENDMENTS-GROWNUP-UX T12
 * and P8 (row GX-12): "New device requests" in the title, a calm card heading, the platform's name, a request time
 * that rolls up, a countdown that moves once a minute on its own clock, the safety hint next to Approve, a family's
 * denial for a grown-up, "Another way" said once and the console's pill select.
 */
function RelinkInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const { ready, session, api, signOut, m, locale } = useConsole();
  const c = m.console;
  // The confirm step in the console language (AMENDMENTS-DISPLAY-NAV section 8).
  const { confirm, sheet: confirmSheet } = useConfirm();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [requests, setRequests] = useState<RelinkView[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Data, not text: worded at render time (`relinkNoteText`), so it follows the header language select.
  const [note, setNote] = useState<RelinkNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const ids = useId();

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

  // The minute labels keep their own clock (GX-12): they move on the minute even while a read fails. Not announced.
  useEffect(() => {
    if (!requests || requests.length === 0) return undefined;
    const handle = setTimeout(() => setNow(new Date()), nextMinuteTick(requests, now));
    return () => clearTimeout(handle);
  }, [requests, now]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const decide = async (req: RelinkView, approve: boolean): Promise<void> => {
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await api.decideRelink(spaceId, req.id, approve);
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'decideFailed', result });
    } else {
      setNote({ kind: approve ? 'approved' : 'denied', name: req.learnerName, spaceKind: roster?.space.kind });
    }
    await load();
  };

  const issue = async (): Promise<void> => {
    const learner = roster?.learners.find((l) => l.id === pick);
    if (!api || !learner || !(await confirm({ title: c.relink.issueAsk(learner.displayName), message: c.oldCodeStops, confirmLabel: c.confirm.issueCode }))) return;
    setBusy(true);
    const result = await api.issueRescueCode(learner.id);
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'issueFailed' });
      return;
    }
    setIssued({ name: learner.displayName, code: result.data.code });
  };

  const asking = aroundSlot(c.relink.askingToBe);

  return (
    <AdultFrame onSignOut={signOut} back={spaceSubPageBack(spaceId, roster?.space.kind, c.relink.back(roster?.space.name ?? null))} title={roster ? c.relink.titleFor(roster.space.name) : c.relink.title}>
      {confirmSheet}
      {failed ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{c.cantReach}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {note ? <Notice tone="success">{relinkNoteText(note, locale)}</Notice> : null}

      {requests && requests.length === 0 ? (
        <div style={{ ...panelStyle, marginBottom: spacing.lg }}>
          <p style={{ margin: 0 }}>{c.relinkNothing}</p>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: spacing.md, marginBottom: spacing.xl }}>
        {(requests ?? []).map((req, index) => {
          const hintId = `${ids}-hint-${index}`;
          return (
            <article key={req.id} style={{ ...panelStyle, display: 'grid', gap: spacing.xs }} data-testid="relink-card">
              <h2 style={{ fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.regular, margin: 0, overflowWrap: 'anywhere' }}>
                {asking.before}
                <strong>{req.learnerName}</strong>
                {asking.after}
              </h2>
              <Muted>
                <span data-testid="relink-meta">
                  {platformLabel(req.platform, locale)} · {requestedLabel(req.requestedAt, now, locale)}
                </span>
              </Muted>
              <p data-testid="relink-countdown" style={{ margin: 0, fontWeight: typography.weight.bold }}>
                {expiresLabel(req.expiresAt, now, locale)}
              </p>
              <Muted id={hintId}>{c.relinkApproveHint}</Muted>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
                <Button tone="primary" disabled={busy} describedBy={hintId} onClick={() => void decide(req, true)}>{c.relink.approve.cta}</Button>
                <Button disabled={busy} onClick={() => void decide(req, false)}>{c.relink.deny.cta}</Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* A rescue code opens the whole snapshot: only a family re-issues one (SEC-4). */}
      {roster === null ? null : canReissueRescueCode(roster.space.kind) ? (
        <section style={panelStyle} aria-labelledby={`${ids}-another-way`}>
          <h2 id={`${ids}-another-way`} style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` }}>{c.relink.anotherWay}</h2>
          <Muted>{c.relinkAnotherWay}</Muted>
          {issued ? (
            <div style={{ margin: `${spacing.md}px 0` }}>
              <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted }}>{issued.name}</div>
              <div data-testid="rescue-code" style={{ fontSize: headRem(typography.size.display), fontWeight: typography.weight.bold, letterSpacing: spacing.xs, fontFamily: typography.family.mono, overflowWrap: 'anywhere' }}>{issued.code}</div>
              <Muted>{c.rescueIssued}</Muted>
              <Button onClick={() => setIssued(null)}>{c.relink.done.cta}</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.sm }}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={c.relink.learnerLabel} style={selectBase}>
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
    </AdultFrame>
  );
}

export default function RelinkPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <RelinkInner />
    </Suspense>
  );
}
