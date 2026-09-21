'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { Roster } from '@/lib/console/api';
import { COPY } from '@/lib/console/copy';
import { capState, classRollup, codeExpiry, percent, relativeDay } from '@/lib/console/rollup';
import { KIND_LABEL, memberNoun } from '@/lib/console/routing';

/** console/roster — F-CONSOLE-001 §3.5. Summaries only; the API never sends payloads here. */
export default function SpacePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const spaceId = decodeURIComponent(params.id);
  const { ready, session, api, signOut } = useConsole();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const result = await api.roster(spaceId);
    if (result.ok) setRoster(result.data);
    else setError(result.error === 'forbidden' ? "This space isn't yours to view." : result.error === 'not_found' ? 'This space is gone.' : COPY.cantReach);
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const regenerate = async (): Promise<void> => {
    if (!api || !roster) return;
    if (roster.joinCode && !window.confirm(`Make a new code for ${roster.space.name}? ${COPY.oldCodeStops}`)) return;
    setBusy(true);
    const result = await api.regenerateCode(spaceId);
    setBusy(false);
    if (result.ok) setRoster({ ...roster, joinCode: result.data.joinCode, joinCodeExpiresAt: result.data.expiresAt });
    else setError("Couldn't make a new code right now.");
  };

  const copy = async (): Promise<void> => {
    if (!roster?.joinCode) return;
    try {
      await navigator.clipboard.writeText(roster.joinCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const rollup = roster ? classRollup(roster.learners, now) : null;
  const cap = roster ? capState(roster.space.kind, roster.learners.length) : null;
  const empty = roster !== null && roster.learners.length === 0;

  return (
    <ConsoleShell onSignOut={signOut} title={roster ? `${roster.space.name} · ${roster.learners.length} ${memberNoun(roster.space.kind)}` : 'Loading…'}>
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}
      {roster ? (
        <>
          <section style={{ ...panelStyle, marginBottom: spacing.lg, textAlign: empty ? 'center' : 'left' }} aria-label="Join code">
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted, textTransform: 'uppercase' }}>
              {KIND_LABEL[roster.space.kind]} code
            </div>
            <div data-testid="join-code" style={{ fontSize: empty ? typography.size.hero : typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono, margin: `${spacing.xs}px 0` }}>
              {roster.joinCode ?? '—'}
            </div>
            <Muted>{codeExpiry(roster.joinCodeExpiresAt, now)}</Muted>
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: empty ? 'center' : 'flex-start' }}>
              {roster.joinCode ? <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button> : null}
              <Button onClick={() => void regenerate()} disabled={busy}>
                {roster.joinCode ? 'Regenerate' : 'Create a code'}
              </Button>
            </div>
            {empty ? <Muted>{COPY.writeOnBoard}</Muted> : null}
          </section>

          {cap?.warning ? <Notice tone="nudge">{cap.reached ? COPY.capReached : COPY.capWarning(cap.used, cap.total)}</Notice> : null}

          {rollup && !empty ? (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="This week">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>This week</h2>
              <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
                <li>
                  {rollup.practicedThisWeek} of {rollup.students} {COPY.practicedThisWeek}
                </li>
                <li>
                  {COPY.anchor}: {percent(rollup.anchorAccuracy)}
                </li>
                {rollup.revisit.length ? (
                  <li>
                    {COPY.revisitTogether}: {rollup.revisit.join(' · ')}
                  </li>
                ) : null}
                {rollup.notSynced ? (
                  <li>
                    {rollup.notSynced} {COPY.notSyncedWeek}
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
            <Button disabled>Plan this week · {COPY.comingWithPlans}</Button>
            <Button disabled>Settings · coming soon</Button>
          </div>

          {!empty ? (
            <section aria-label="Students">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Most recent activity first</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.md }}>
                {roster.learners.map((l) => (
                  <article key={l.id} style={panelStyle} data-testid="student-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
                      <strong>{l.displayName}</strong>
                      <span style={{ fontSize: typography.size.caption, color: colors.text.muted, padding: `${spacing.xxs}px ${spacing.sm}px`, backgroundColor: colors.surface.sunken, borderRadius: radii.pill }}>
                        Age {l.ageGroup}
                      </span>
                    </div>
                    {l.summary ? (
                      <div style={{ color: colors.text.secondary, fontSize: typography.size.bodySm, marginTop: spacing.xs, lineHeight: typography.leading.relaxed }}>
                        <div>Last active {relativeDay(l.summary.lastActiveAt, now)}</div>
                        <div>
                          Quests {l.summary.stage1.questsDone} / {l.summary.stage1.questsTotal} · {l.summary.cardsUnlocked} cards
                        </div>
                        <div>{l.summary.minutesLast7d} min this week</div>
                        {l.summary.needsPractice.length ? <div>Revisit: {l.summary.needsPractice.join(' · ')}</div> : null}
                      </div>
                    ) : (
                      <Muted>{COPY.notSyncedYet} · joined {relativeDay(l.joinedAt, now)}</Muted>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </ConsoleShell>
  );
}
