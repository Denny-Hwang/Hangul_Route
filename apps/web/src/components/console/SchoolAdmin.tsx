'use client';

import type { Messages } from '@hangul-route/i18n';
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Field, LoadErrorPanel, Muted, Notice, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import type { ConsoleApi, MemberView, SchoolView } from '@/lib/console/api';
import { planTitle, statusLine as entitlementStatus } from '@/lib/console/billing';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { ROUTES, loadErrorKey, type LoadError } from '@/lib/console/routing';
import { assignableTeachers, limitNote, limitState, usageLine, weekLine } from '@/lib/console/school';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { aroundSlot } from '@/lib/i18n/slot';

type SchoolNote = keyof Messages['console']['school']['notes'];

/** console/school-admin — F-SCHOOL-001 §3.3. Rendered by /teach/space?id= for school spaces. */
export function SchoolAdmin({ api, spaceId, onSignOut }: { api: ConsoleApi; spaceId: string; onSignOut: () => void }): JSX.Element {
  const [view, setView] = useState<SchoolView | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  // Keys, not text: the messages are looked up at render time, so they follow the header language select.
  const [error, setError] = useState<LoadError | null>(null);
  const [note, setNote] = useState<SchoolNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const now = new Date();
  const c = useConsoleLocale().messages.console;
  const s = c.school;

  const load = useCallback(async (): Promise<void> => {
    const [v, m] = await Promise.all([api.school(spaceId), api.members(spaceId)]);
    if (!v.ok) {
      setError(loadErrorKey(v.error));
      return;
    }
    setError(null);
    setView(v.data);
    if (m.ok) setMembers(m.data);
  }, [api, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<{ ok: boolean }>, okNote: SchoolNote, failNote: SchoolNote): Promise<void> => {
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

  return (
    <AdultFrame onSignOut={onSignOut} title={view ? s.titleFor(view.school.name) : s.title}>
      {error ? <LoadErrorPanel error={error} forbidden={s.forbidden} onRetry={() => void load()} /> : null}
      {note ? <Notice tone="nudge">{s.notes[note]}</Notice> : null}
      {view ? (
        <SchoolAdminView
          view={view}
          members={members}
          spaceId={spaceId}
          now={now}
          busy={busy}
          copied={copied}
          assigning={assigning}
          newClass={newClass}
          onCopy={() => void copy()}
          onRegenerate={() => {
            if (!view.invite.joinCode || window.confirm(`${s.invite.regenerateAsk} ${c.oldCodeStops}`)) void run(() => api.regenerateCode(spaceId), 'codeReady', 'codeFailed');
          }}
          onAssigning={setAssigning}
          onAssign={(classId, accountId) => void run(() => api.addMember(classId, accountId), 'assigned', 'assignFailed').then(() => setAssigning(null))}
          onNewClass={setNewClass}
          onCreateClass={(name) => void run(() => api.createSpace({ kind: 'class', name, parentSpaceId: spaceId }), 'classCreated', 'createFailed').then(() => setNewClass(''))}
        />
      ) : null}
    </AdultFrame>
  );
}

/**
 * The loaded school view (wireframe console/school-admin): licence and seats, the teacher
 * invite, the week line, the class list and the new-class form. Every word comes from the
 * dictionary (`console.school`, F-I18N-001 PR 10c); school, class and teacher names are data.
 * `SchoolAdmin` owns the state, the API calls and the confirm dialogs.
 */
export function SchoolAdminView({
  view,
  members,
  spaceId,
  now,
  busy,
  copied,
  assigning,
  newClass,
  onCopy,
  onRegenerate,
  onAssigning,
  onAssign,
  onNewClass,
  onCreateClass,
}: {
  view: SchoolView;
  members: readonly MemberView[];
  spaceId: string;
  now: Date;
  busy: boolean;
  copied: boolean;
  /** The class whose teacher picker is open. */
  assigning: string | null;
  newClass: string;
  onCopy: () => void;
  onRegenerate: () => void;
  onAssigning: (classId: string | null) => void;
  onAssign: (classId: string, accountId: string) => void;
  onNewClass: (value: string) => void;
  onCreateClass: (name: string) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const s = c.school;
  const state = limitState(view.usage, view.limits);
  const note = limitNote(state, locale);
  const teachers = assignableTeachers(members);
  const empty = view.classes.length === 0 && members.filter((m) => m.memberKind === 'account').length <= 1;
  // The settings link sits inside the footer sentence; a translation may move it (aroundSlot).
  const footer = aroundSlot(s.footer);

  return (
    <>
      {view.license && !view.license.active ? <Notice tone="nudge">{c.schoolLicenceLapsed} <Link href={ROUTES.billing}>{s.billingLink}</Link></Notice> : null}
      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.licence.label}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
          <div>
            <strong>{s.licence.title}</strong>
            <Muted>{view.license ? s.licence.line(planTitle(view.license.planKey, locale), entitlementStatus(view.license, now, locale)) : s.licence.none}</Muted>
          </div>
          <div>
            <strong>{s.licence.seats}</strong>
            <Muted>{usageLine(view.usage, view.limits, locale)}</Muted>
          </div>
          <Link href={ROUTES.billing}>
            <Button>{s.licence.manage.cta}</Button>
          </Link>
        </div>
        {note ? <Muted>{note}</Muted> : null}
      </section>

      <section style={{ ...panelStyle, marginBottom: spacing.lg, textAlign: empty ? 'center' : 'left' }} aria-label={s.invite.title}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>{s.invite.title}</h2>
        <div data-testid="invite-code" style={{ fontSize: empty ? typography.size.hero : typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>
          {view.invite.joinCode ?? '—'}
        </div>
        <Muted>{s.invite.role(codeExpiry(view.invite.joinCodeExpiresAt, now, locale))}</Muted>
        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: empty ? 'center' : 'flex-start' }}>
          {view.invite.joinCode ? <Button onClick={onCopy}>{copied ? c.joinCode.copied.cta : c.joinCode.copy.cta}</Button> : null}
          <Button disabled={busy} onClick={onRegenerate}>
            {view.invite.joinCode ? s.invite.regenerate.cta : s.invite.create.cta}
          </Button>
        </div>
        <Muted>{c.schoolInviteHint}</Muted>
      </section>

      {empty ? (
        <Notice>{c.schoolEmpty}</Notice>
      ) : (
        <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.week.label}>
          <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` }}>{s.week.title}</h2>
          <Muted>{weekLine(view.thisWeek, locale)}</Muted>
        </section>
      )}

      <section aria-label={s.classes.title} style={{ marginBottom: spacing.lg }}>
        <h2 style={{ fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.sm}px` }}>{s.classes.title}</h2>
        <div style={{ display: 'grid', gap: spacing.sm }}>
          {view.classes.map((row) => (
            <article key={row.space.id} style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center', opacity: row.space.archivedAt ? 0.6 : 1 }} data-testid="class-row">
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>
                  {row.space.name}
                  {row.space.archivedAt ? <span style={{ color: colors.text.muted }}> {c.home.archived}</span> : null}
                </strong>
                <Muted>{s.classes.line(row.teacher ? row.teacher.name : null, row.students, relativeDay(row.lastActiveAt, now, locale), row.hasPublishedPlan)}</Muted>
              </div>
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                {assigning === row.space.id ? (
                  <>
                    <select aria-label={s.classes.teacherFor(row.space.name)} defaultValue="" onChange={(e) => { const id = e.target.value; if (id) onAssign(row.space.id, id); }} style={{ padding: spacing.xs }}>
                      <option value="">{s.classes.chooseTeacher}</option>
                      {teachers.map((t) => (
                        <option key={t.accountId} value={t.accountId}>{t.name}</option>
                      ))}
                    </select>
                    <Button onClick={() => onAssigning(null)}>{s.classes.cancel.cta}</Button>
                  </>
                ) : (
                  <Button disabled={busy || !!row.space.archivedAt} onClick={() => onAssigning(row.space.id)}>{row.teacher ? s.classes.change.cta : s.classes.assign.cta}</Button>
                )}
                <Link href={ROUTES.space(row.space.id)}>
                  <Button>{s.classes.open.cta}</Button>
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
            onCreateClass(newClass.trim());
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field name="newClass" label={s.classes.newField.label} value={newClass} onChange={onNewClass} placeholder={s.classes.newField.placeholder} maxLength={40} />
          </div>
          <Button type="submit" disabled={busy || newClass.trim().length === 0}>{s.classes.add.cta}</Button>
        </form>
      </section>
      <Muted>
        {footer.before}
        <Link href={ROUTES.spaceSettings(spaceId)}>{s.settingsLink}</Link>
        {footer.after}
      </Muted>
    </>
  );
}
