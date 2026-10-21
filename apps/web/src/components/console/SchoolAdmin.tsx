'use client';

import type { Messages } from '@hangul-route/i18n';
import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { SchoolClassRow } from '@/lib/console/api';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, LoadErrorPanel, Muted, Notice, panelStyle } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConfirm } from './ConfirmSheet';
import { spacePageBack } from '@/lib/console/page-back';
import type { ConsoleApi, MemberView, SchoolView } from '@/lib/console/api';
import { planTitle, statusLine as entitlementStatus } from '@/lib/console/billing';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { ROUTES, loadErrorKey, type LoadError } from '@/lib/console/routing';
import { assignableTeachers, limitNote, limitState, usageLine, weekLine } from '@/lib/console/school';
import { renameShown } from '@/lib/console/rename';
import { RenameButton, RenameForm, RenameStyles, RenameTitle, useAnnouncer, useNameOverrides, useSpaceRename } from './RenameParts';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { aroundSlot } from '@/lib/i18n/slot';
import { headRem, rem } from '@/lib/console/rem';

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
  // The confirm step in the console language (AMENDMENTS-DISPLAY-NAV section 8).
  const { confirm, sheet: confirmSheet } = useConfirm();

  // A newer read supersedes an older one. A rename never drops a read: the read draws in full and only the renamed
  // names are laid over it ([SA] section 5.3, `NameOverrides`), so a class created while a rename settles still shows.
  const loadSeq = useRef(0);
  const names = useNameOverrides();
  const load = useCallback(async (): Promise<void> => {
    const call = ++loadSeq.current;
    const read = names.begin();
    const [v, m] = await Promise.all([api.school(spaceId), api.members(spaceId)]);
    if (call !== loadSeq.current) return;
    if (!v.ok) {
      setError(loadErrorKey(v.error));
      return;
    }
    setError(null);
    const named = (space: SchoolView['school']): SchoolView['school'] => ({ ...space, name: names.nameFor(space.id, space.name, read) });
    setView({ ...v.data, school: named(v.data.school), classes: v.data.classes.map((row) => ({ ...row, space: named(row.space) })) });
    if (m.ok) setMembers(m.data);
  }, [api, spaceId, names]);

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

  // [SA] The school's own name and each class row's (AMENDMENTS-SEATS-ADMINS section 5.3): one live region for the page.
  const { announce, region: renameLive } = useAnnouncer();
  const setSchoolName = useCallback(
    (name: string, settled: boolean) => {
      names.set(spaceId, name, settled);
      setView((prev) => (prev ? { ...prev, school: { ...prev.school, name } } : prev));
    },
    [names, spaceId],
  );
  const setClassName = useCallback(
    (classId: string, name: string, settled: boolean) => {
      names.set(classId, name, settled);
      setView((prev) => (prev ? { ...prev, classes: prev.classes.map((row) => (row.space.id === classId ? { ...row, space: { ...row.space, name } } : row)) } : prev));
    },
    [names],
  );
  const rename = useSpaceRename({ api, spaceId, name: view?.school.name ?? '', onName: setSchoolName, announce });

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
    // A school's own page goes back to Classes (PageBack, AMENDMENTS-DISPLAY-NAV section 7.3).
    <AdultFrame onSignOut={onSignOut} back={spacePageBack('school', c)} title={view ? undefined : s.title}>
      {confirmSheet}
      <RenameStyles />
      {renameLive}
      {view ? (
        <div style={{ marginBottom: spacing.md }} data-testid="school-head">
          <RenameTitle
            rename={rename}
            name={view.school.name}
            title={s.titleFor(view.school.name)}
            kind="school"
            canRename={renameShown(view.school, view.canRename)}
            openMoves={false}
            heading="h1"
            headingStyle={{ fontSize: headRem(typography.size.title), lineHeight: typography.leading.tight, fontWeight: typography.weight.bold }}
          />
        </div>
      ) : null}
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
            void (async () => {
              if (view.invite.joinCode && !(await confirm({ title: s.invite.regenerateAsk, message: c.oldCodeStops, confirmLabel: c.confirm.newCode }))) return;
              void run(() => api.regenerateCode(spaceId), 'codeReady', 'codeFailed');
            })();
          }}
          onAssigning={setAssigning}
          onAssign={(classId, accountId) => void run(() => api.addMember(classId, accountId), 'assigned', 'assignFailed').then(() => setAssigning(null))}
          onNewClass={setNewClass}
          rename={{ api, announce, onClassName: setClassName }}
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
  rename,
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
  /** [SA] section 5.3: renaming a class from its row (shown with the row's `canRename`); absent, rows show no Rename. */
  rename?: { api: ConsoleApi | null; announce: (text: string) => void; onClassName: (classId: string, name: string, settled: boolean) => void };
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const s = c.school;
  const state = limitState(view.usage, view.limits, view.license?.active === true && view.license.planKey === 'school_seat');
  const note = limitNote(state, locale, { students: view.usage.students, cap: view.limits.students });
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
        <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` }}>{s.invite.title}</h2>
        <div data-testid="invite-code" style={{ fontSize: headRem(empty ? typography.size.hero : typography.size.display), fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>
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
          <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` }}>{s.week.title}</h2>
          <Muted>{weekLine(view.thisWeek, locale)}</Muted>
        </section>
      )}

      <section aria-label={s.classes.title} style={{ marginBottom: spacing.lg }}>
        <h2 style={{ fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.sm}px` }}>{s.classes.title}</h2>
        <div style={{ display: 'grid', gap: spacing.sm }}>
          {view.classes.map((row) => (
            <ClassRowView
              key={row.space.id}
              row={row}
              now={now}
              busy={busy}
              teachers={teachers}
              assigning={assigning === row.space.id}
              onAssigning={onAssigning}
              onAssign={onAssign}
              rename={rename}
            />
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

/**
 * One class row of the school page: name and line, then Change or Assign teacher, Rename ([SA] section 5.3, between
 * the teacher button and Open roster) and Open roster. Open, the row's name and line become the field and its other
 * buttons step aside until Save or Cancel (D6: one task per row); focus then returns to the row's Rename.
 */
function ClassRowView({
  row,
  now,
  busy,
  teachers,
  assigning,
  onAssigning,
  onAssign,
  rename,
}: {
  row: SchoolClassRow;
  now: Date;
  busy: boolean;
  teachers: ReadonlyArray<{ accountId: string; name: string }>;
  assigning: boolean;
  onAssigning: (classId: string | null) => void;
  onAssign: (classId: string, accountId: string) => void;
  rename?: { api: ConsoleApi | null; announce: (text: string) => void; onClassName: (classId: string, name: string, settled: boolean) => void };
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const s = c.school;
  const classId = row.space.id;
  const onClassName = rename?.onClassName;
  const setName = useCallback((name: string, settled: boolean) => onClassName?.(classId, name, settled), [onClassName, classId]);
  const field = useSpaceRename({ api: rename?.api ?? null, spaceId: classId, name: row.space.name, onName: setName, announce: rename?.announce ?? noAnnounce });
  const canRename = !!rename && renameShown(row.space, row.canRename);
  const open = canRename && field.state.open;
  return (
    <article style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center', opacity: row.space.archivedAt ? 0.6 : 1 }} data-testid="class-row">
      <div style={{ flex: 1, minWidth: 220 }}>
        {open ? (
          <>
            <p className="hr-rn-hidden">{field.state.stored}</p>
            <RenameForm rename={field} kind="class" openMoves={row.openMoves === true} testId="class-rename-form" />
          </>
        ) : (
          <>
            <strong style={{ overflowWrap: 'anywhere' }}>
              {row.space.name}
              {row.space.archivedAt ? <span style={{ color: colors.text.muted }}> {c.home.archived}</span> : null}
            </strong>
            <Muted>{s.classes.line(row.teacher ? row.teacher.name : null, row.students, relativeDay(row.lastActiveAt, now, locale), row.hasPublishedPlan)}</Muted>
          </>
        )}
      </div>
      {open ? null : (
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          {assigning ? (
            <>
              <select aria-label={s.classes.teacherFor(row.space.name)} defaultValue="" onChange={(e) => { const id = e.target.value; if (id) onAssign(classId, id); }} style={{ padding: spacing.xs }}>
                <option value="">{s.classes.chooseTeacher}</option>
                {teachers.map((t) => (
                  <option key={t.accountId} value={t.accountId}>{t.name}</option>
                ))}
              </select>
              <Button onClick={() => onAssigning(null)}>{s.classes.cancel.cta}</Button>
            </>
          ) : (
            <Button disabled={busy || !!row.space.archivedAt} onClick={() => onAssigning(classId)}>{row.teacher ? s.classes.change.cta : s.classes.assign.cta}</Button>
          )}
          {canRename ? <RenameButton rename={field} name={row.space.name} testId="class-rename" /> : null}
          <Link href={ROUTES.space(classId)}>
            <Button>{s.classes.open.cta}</Button>
          </Link>
        </div>
      )}
    </article>
  );
}

const noAnnounce = (): void => undefined;
