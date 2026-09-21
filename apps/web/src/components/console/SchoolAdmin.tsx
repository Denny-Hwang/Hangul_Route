'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleShell, Field, Muted, Notice, panelStyle } from '@/components/console/ui';
import type { ConsoleApi, MemberView, SchoolView } from '@/lib/console/api';
import { statusLine as entitlementStatus } from '@/lib/console/billing';
import { COPY } from '@/lib/console/copy';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { ROUTES } from '@/lib/console/routing';
import { assignableTeachers, limitNote, limitState, usageLine, weekLine } from '@/lib/console/school';

/** console/school-admin — F-SCHOOL-001 §3.3. Rendered by /teach/space/[id] for school spaces. */
export function SchoolAdmin({ api, spaceId, onSignOut }: { api: ConsoleApi; spaceId: string; onSignOut: () => void }): JSX.Element {
  const [view, setView] = useState<SchoolView | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    const [v, m] = await Promise.all([api.school(spaceId), api.members(spaceId)]);
    if (!v.ok) {
      setError(v.error === 'forbidden' ? "This school isn't yours to manage." : COPY.cantReach);
      return;
    }
    setError(null);
    setView(v.data);
    if (m.ok) setMembers(m.data);
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<{ ok: boolean }>, okNote: string, failNote: string): Promise<void> => {
    setBusy(true);
    setNote(null);
    const result = await action();
    setBusy(false);
    setNote(result.ok ? okNote : failNote);
    if (result.ok) await load();
  };

  const copy = async (): Promise<void> => {
    if (!view?.invite.joinCode) return;
    try {
      await navigator.clipboard.writeText(view.invite.joinCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const state = view ? limitState(view.usage, view.limits) : 'unlicensed';
  const teachers = assignableTeachers(members);
  const empty = view !== null && view.classes.length === 0 && members.filter((m) => m.memberKind === 'account').length <= 1;

  return (
    <ConsoleShell onSignOut={onSignOut} title={view ? `${view.school.name} · school` : 'School'}>
      {error ? (
        <div style={panelStyle}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={() => void load()}>{COPY.tryAgain}</Button>
        </div>
      ) : null}
      {note ? <Notice tone="nudge">{note}</Notice> : null}
      {view?.license && !view.license.active ? <Notice tone="nudge">{COPY.schoolLicenceLapsed} <Link href="/teach/billing">Billing</Link></Notice> : null}
      {view ? (
        <>
          <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="Licence and seats">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
              <div>
                <strong>Licence</strong>
                <Muted>{view.license ? `${view.license.planKey === 'school_seat' ? 'School Seats' : 'School License'} · ${entitlementStatus(view.license, now)}` : 'none'}</Muted>
              </div>
              <div>
                <strong>Seats</strong>
                <Muted>{usageLine(view.usage, view.limits)}</Muted>
              </div>
              <Link href="/teach/billing">
                <Button>Manage billing</Button>
              </Link>
            </div>
            {limitNote(state) ? <Muted>{limitNote(state)}</Muted> : null}
          </section>

          <section style={{ ...panelStyle, marginBottom: spacing.lg, textAlign: empty ? 'center' : 'left' }} aria-label="Invite a teacher">
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>Invite a teacher</h2>
            <div data-testid="invite-code" style={{ fontSize: empty ? typography.size.hero : typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>
              {view.invite.joinCode ?? '—'}
            </div>
            <Muted>
              role: teacher · {codeExpiry(view.invite.joinCodeExpiresAt, now)}
            </Muted>
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: empty ? 'center' : 'flex-start' }}>
              {view.invite.joinCode ? <Button onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button> : null}
              <Button disabled={busy} onClick={() => { if (!view.invite.joinCode || window.confirm(`Make a new invite code? ${COPY.oldCodeStops}`)) void run(() => api.regenerateCode(spaceId), 'New invite code ready.', "Couldn't make a new code."); }}>
                {view.invite.joinCode ? 'Regenerate' : 'Create a code'}
              </Button>
            </div>
            <Muted>{COPY.schoolInviteHint}</Muted>
          </section>

          {empty ? (
            <Notice>{COPY.schoolEmpty}</Notice>
          ) : (
            <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label="This week">
              <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>This week (whole school)</h2>
              <Muted>{weekLine(view.thisWeek)}</Muted>
            </section>
          )}

          <section aria-label="Classes" style={{ marginBottom: spacing.lg }}>
            <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>Classes</h2>
            <div style={{ display: 'grid', gap: spacing.sm }}>
              {view.classes.map((row) => (
                <article key={row.space.id} style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center', opacity: row.space.archivedAt ? 0.6 : 1 }} data-testid="class-row">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong>
                      {row.space.name}
                      {row.space.archivedAt ? <span style={{ color: colors.text.muted }}> (archived)</span> : null}
                    </strong>
                    <Muted>
                      {row.teacher ? row.teacher.name : 'no teacher yet'} · {row.students} student{row.students === 1 ? '' : 's'} · active {relativeDay(row.lastActiveAt, now)}
                      {row.hasPublishedPlan ? ' · plan published' : ''}
                    </Muted>
                  </div>
                  <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    {assigning === row.space.id ? (
                      <>
                        <select aria-label={`Teacher for ${row.space.name}`} defaultValue="" onChange={(e) => { const id = e.target.value; if (id) void run(() => api.addMember(row.space.id, id), 'Teacher assigned.', "Couldn't assign — have they joined the school?").then(() => setAssigning(null)); }} style={{ padding: spacing.xs }}>
                          <option value="">Choose a teacher…</option>
                          {teachers.map((t) => (
                            <option key={t.accountId} value={t.accountId}>{t.name}</option>
                          ))}
                        </select>
                        <Button onClick={() => setAssigning(null)}>Cancel</Button>
                      </>
                    ) : (
                      <Button disabled={busy || !!row.space.archivedAt} onClick={() => setAssigning(row.space.id)}>{row.teacher ? 'Change teacher' : 'Assign teacher'}</Button>
                    )}
                    <Link href={ROUTES.space(row.space.id)}>
                      <Button>Open roster →</Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <form
              style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.md, flexWrap: 'wrap' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!newClass.trim()) return;
                void run(() => api.createSpace({ kind: 'class', name: newClass.trim(), parentSpaceId: spaceId }), 'Class created — assign a teacher when they have joined.', "Couldn't create the class.").then(() => setNewClass(''));
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <Field name="newClass" label="New class" value={newClass} onChange={setNewClass} placeholder="Sunday Class C" maxLength={40} />
              </div>
              <Button type="submit" disabled={busy || newClass.trim().length === 0}>+ New class</Button>
            </form>
          </section>
          <Muted>
            <Link href={`${ROUTES.space(spaceId)}/settings`}>School settings</Link> · rosters opened from here show initials by default.
          </Muted>
        </>
      ) : null}
    </ConsoleShell>
  );
}
