'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import { useConsole } from '@/components/console/use-console';
import type { MemberView, Roster } from '@/lib/console/api';
import { COPY } from '@/lib/console/copy';
import { canDeleteLearnerData } from '@/lib/console/relink';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { KIND_LABEL, ROUTES, memberNoun } from '@/lib/console/routing';

/** console/space-settings — F-TCH-001 §10.3. Housekeeping only; never progress data. */
export default function SettingsPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const spaceId = decodeURIComponent(params.id);
  const router = useRouter();
  const { ready, session, api, signOut } = useConsole();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const [typedName, setTypedName] = useState('');
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [r, m] = await Promise.all([api.roster(spaceId), api.members(spaceId)]);
    if (!r.ok || !m.ok) {
      setError(r.ok ? COPY.cantReach : r.error === 'forbidden' ? "This space isn't yours to manage." : COPY.cantReach);
      return;
    }
    setRoster(r.data);
    setMembers(m.data);
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !session) return <ConsoleShell>{null}</ConsoleShell>;

  const run = async (action: () => Promise<{ ok: boolean }>, okNote: string, failNote: string): Promise<void> => {
    if (!api) return;
    setBusy(true);
    setNote(null);
    const result = await action();
    setBusy(false);
    setNote(result.ok ? okNote : failNote);
    if (result.ok) await load();
  };

  const space = roster?.space ?? null;
  const archived = !!space?.archivedAt;
  const learners = members.filter((m) => m.memberKind === 'learner');
  const adults = members.filter((m) => m.memberKind === 'account');
  const mayDelete = space ? canDeleteLearnerData(space.kind, space.settings.consentMode) : false;
  const deleteCandidate = learners.find((l) => l.memberId === deleteTarget);

  return (
    <ConsoleShell onSignOut={signOut} title={space ? `${space.name} · settings` : 'Settings'}>
      <Muted>
        <Link href={ROUTES.space(spaceId)}>← Back to {space?.name ?? 'the space'}</Link>
      </Muted>
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}
      {note ? <Notice tone="nudge">{note}</Notice> : null}
      {archived ? <Notice tone="nudge">This {space?.kind} is archived — read-only until you unarchive it.</Notice> : null}

      {space && api ? (
        <>
          {!archived ? (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Join code">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Join code</h2>
              <div style={{ fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>{roster?.joinCode ?? '—'}</div>
              <Muted>{codeExpiry(roster?.joinCodeExpiresAt, now)}</Muted>
              <Button
                disabled={busy}
                onClick={() => {
                  if (roster?.joinCode && !window.confirm(`Make a new code? ${COPY.oldCodeStops}`)) return;
                  void run(() => api.regenerateCode(spaceId), 'New code ready.', "Couldn't make a new code right now.");
                }}
              >
                {roster?.joinCode ? 'Regenerate' : 'Create a code'}
              </Button>
            </section>
          ) : null}

          {space.kind !== 'family' ? (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Consent mode">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Consent mode</h2>
              <Muted>{COPY.consentHint}</Muted>
              {(['parent', 'school'] as const).map((mode) => (
                <label key={mode} style={{ display: 'block', marginBottom: spacing.xs }}>
                  <input type="radio" name="consent" checked={space.settings.consentMode === mode} disabled={busy || archived} onChange={() => void run(() => api.patchSettings(spaceId, { consentMode: mode }), 'Saved.', "Didn't save.")} />{' '}
                  {mode === 'parent' ? 'A parent consents (email at join — coming later)' : 'The school attests for its students'}
                </label>
              ))}
            </section>
          ) : null}

          <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Privacy">
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Privacy</h2>
            <label style={{ display: 'block' }}>
              <input type="checkbox" checked={space.settings.anonymizeRoster} disabled={busy || archived} onChange={(e) => void run(() => api.patchSettings(spaceId, { anonymizeRoster: e.target.checked }), 'Saved.', "Didn't save.")} /> Anonymize roster
            </label>
            <Muted>{COPY.anonymizeHint}</Muted>
          </section>

          <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Members">
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Grown-ups</h2>
            {adults.map((m) => (
              <div key={m.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px 0` }}>
                <span>
                  {m.name} <span style={{ color: colors.text.muted }}>· {m.role}{m.memberId === session.accountId ? ' (you)' : ''}</span>
                </span>
                {!m.isOwner ? (
                  <Button disabled={busy || archived} onClick={() => { if (window.confirm(`Remove ${m.name} from ${space.name}?`)) void run(() => api.removeMember(spaceId, 'account', m.memberId), 'Removed.', "Didn't remove."); }}>
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            <Muted>{space.kind === 'class' ? 'Co-teachers arrive later.' : `Invite a ${space.kind === 'family' ? 'co-parent' : 'teacher'}: they sign in and enter the code above.`}</Muted>
          </section>

          <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Learners">
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>{KIND_LABEL[space.kind]} {memberNoun(space.kind)}</h2>
            {learners.length === 0 ? <Muted>No one has joined yet — share the code.</Muted> : null}
            {learners.map((l) => (
              <div key={l.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px 0` }}>
                <span>
                  {l.name} <span style={{ color: colors.text.muted }}>· joined {relativeDay(l.joinedAt, now)}</span>
                </span>
                <Button disabled={busy || archived} onClick={() => { if (window.confirm(`Remove ${l.name} from ${space.name}? Their progress stays with them.`)) void run(() => api.removeMember(spaceId, 'learner', l.memberId), 'Removed.', "Didn't remove."); }}>
                  Remove from {space.kind}
                </Button>
              </div>
            ))}
          </section>

          <section style={{ ...panelStyle, marginBottom: spacing.lg, borderColor: colors.feedback.danger }} aria-label="Danger zone">
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px`, color: colors.feedback.danger }}>Danger zone</h2>
            <div style={{ marginBottom: spacing.md }}>
              <Button tone="danger" disabled={busy} onClick={() => { if (archived || window.confirm(`Archive ${space.name}? ${COPY.archiveKeeps}`)) void run(() => api.archiveSpace(spaceId, !archived), archived ? 'Unarchived.' : 'Archived.', "Didn't save."); }}>
                {archived ? 'Unarchive' : `Archive this ${space.kind}`}
              </Button>
              <Muted>{COPY.archiveKeeps}</Muted>
            </div>
            <div>
              <h3 style={{ fontSize: typography.size.body, margin: `0 0 ${spacing.xs}px` }}>Delete a learner&apos;s data</h3>
              {!mayDelete ? (
                <Muted>{COPY.deleteAskParent}</Muted>
              ) : (
                <>
                  <Muted>{COPY.deleteLearnerWarn}</Muted>
                  <select value={deleteTarget} onChange={(e) => { setDeleteTarget(e.target.value); setTypedName(''); }} aria-label="Learner to delete" style={{ padding: spacing.xs, marginBottom: spacing.sm }}>
                    <option value="">Choose a learner…</option>
                    {learners.map((l) => (
                      <option key={l.memberId} value={l.memberId}>{l.name}</option>
                    ))}
                  </select>
                  {deleteCandidate ? (
                    <>
                      <Field name="typedName" label={`Type "${deleteCandidate.name}" to confirm`} value={typedName} onChange={setTypedName} />
                      <Button tone="danger" disabled={busy || typedName.trim() !== deleteCandidate.name} onClick={() => void run(() => api.deleteLearnerData(spaceId, deleteCandidate.memberId), 'Deleted everywhere.', "Couldn't delete.").then(() => { setDeleteTarget(''); setTypedName(''); })}>
                        Delete {deleteCandidate.name}&apos;s data
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </section>
          {archived ? <Button onClick={() => router.push(ROUTES.home)}>Back to console</Button> : null}
        </>
      ) : null}
    </ConsoleShell>
  );
}
