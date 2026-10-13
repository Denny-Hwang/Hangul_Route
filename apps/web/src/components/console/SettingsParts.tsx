'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import type { ReactNode } from 'react';
import { MoveRowAction } from '@/components/console/TransferParts';
import { Button, Field, Muted, panelStyle } from '@/components/console/ui';
import type { MemberView, Roster } from '@/lib/console/api';
import { canDeleteLearnerData } from '@/lib/console/relink';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The sections of console/space-settings (F-TCH-001 §10.3) once the roster and members have
 * loaded: join code, consent mode, privacy, grown-ups, learners and the danger zone. Every word
 * comes from the dictionary (`console.settings`, F-I18N-001 PR 10c); space, member and learner
 * names are data. The page owns the state, the API calls and the confirm dialogs.
 */
export interface SettingsSectionsProps {
  roster: Roster;
  members: readonly MemberView[];
  /** The signed-in grown-up, marked "(you)" in the grown-ups list. */
  accountId: string;
  now: Date;
  busy: boolean;
  /** School consent mode is selectable (F-TCH-001 §10.3; off until a legal review). */
  schoolConsent: boolean;
  deleteTarget: string;
  typedName: string;
  onRegenerate: () => void;
  onConsent: (mode: 'parent' | 'school') => void;
  onAnonymize: (on: boolean) => void;
  onRemoveAdult: (member: MemberView) => void;
  onRemoveLearner: (member: MemberView) => void;
  onArchive: () => void;
  onDeleteTarget: (memberId: string) => void;
  onTypedName: (value: string) => void;
  onDelete: (member: MemberView) => void;
  /**
   * Class moves (F-SPACE-002 section 4.8, T-6c; design/screens/transfer/start-sheet.md): when set, a live class's
   * learner rows show **Move to another class** before Remove (never in the Danger zone); offline it is disabled
   * with "This needs internet.". Absent while `NEXT_PUBLIC_CLASS_TRANSFER` is unset or the session is locked.
   * `familyMovable` (T-6d): on a family, the learners in a live class, whose rows show **Move to a class**.
   */
  move?: { online: boolean; onMove: (member: MemberView) => void; familyMovable?: ReadonlySet<string> };
  /** Panel D, who may send notes (F-FEEDBACK-001 FB-12, `console/family-notes.md` D): drawn after the learners, before the Danger zone. */
  notesPanel?: ReactNode;
}

const h2Style = { fontSize: typography.size.bodyLg, margin: `0 0 ${spacing.xs}px` } as const;
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px 0` } as const;

export function SettingsSections({
  roster,
  members,
  accountId,
  now,
  busy,
  schoolConsent,
  deleteTarget,
  typedName,
  onRegenerate,
  onConsent,
  onAnonymize,
  onRemoveAdult,
  onRemoveLearner,
  onArchive,
  onDeleteTarget,
  onTypedName,
  onDelete,
  move,
  notesPanel,
}: SettingsSectionsProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const s = c.settings;
  const space = roster.space;
  const archived = !!space.archivedAt;
  const learners = members.filter((m) => m.memberKind === 'learner');
  const adults = members.filter((m) => m.memberKind === 'account');
  const mayDelete = canDeleteLearnerData(space.kind, space.settings.consentMode);
  const deleteCandidate = learners.find((l) => l.memberId === deleteTarget);

  return (
    <>
      {!archived ? (
        <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.joinCode.title}>
          <h2 style={h2Style}>{s.joinCode.title}</h2>
          <div style={{ fontSize: typography.size.display, fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>{roster.joinCode ?? '—'}</div>
          <Muted>{codeExpiry(roster.joinCodeExpiresAt, now, locale)}</Muted>
          <Button disabled={busy} onClick={onRegenerate}>
            {roster.joinCode ? s.joinCode.regenerate.cta : s.joinCode.create.cta}
          </Button>
        </section>
      ) : null}

      {space.kind !== 'family' ? (
        <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.consent.title}>
          <h2 style={h2Style}>{s.consent.title}</h2>
          <Muted>{c.consentHint}</Muted>
          {(['parent', 'school'] as const).map((mode) => (
            <label key={mode} style={{ display: 'block', marginBottom: spacing.xs }}>
              <input type="radio" name="consent" checked={space.settings.consentMode === mode} disabled={busy || archived || (mode === 'school' && !schoolConsent)} onChange={() => onConsent(mode)} />{' '}
              {s.consent[mode]}
              {mode === 'school' && !schoolConsent ? <span style={{ color: colors.text.muted }}> · {s.consent.notYet}</span> : null}
            </label>
          ))}
          {!schoolConsent ? <Muted>{c.consentLocked}</Muted> : null}
        </section>
      ) : null}

      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.privacy.title}>
        <h2 style={h2Style}>{s.privacy.title}</h2>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={space.settings.anonymizeRoster} disabled={busy || archived} onChange={(e) => onAnonymize(e.target.checked)} /> {s.privacy.anonymize}
        </label>
        <Muted>{c.anonymizeHint}</Muted>
      </section>

      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.grownUps.label}>
        <h2 style={h2Style}>{s.grownUps.title}</h2>
        {adults.map((m) => (
          <div key={m.memberId} style={rowStyle}>
            <span>
              {m.name} <span style={{ color: colors.text.muted }}>· {s.grownUps.roleLine(s.grownUps.role[m.role] ?? m.role, m.memberId === accountId)}</span>
            </span>
            {!m.isOwner ? (
              <Button disabled={busy || archived} onClick={() => onRemoveAdult(m)}>
                {s.grownUps.remove.cta}
              </Button>
            ) : null}
          </div>
        ))}
        <Muted>{s.grownUps.invite[space.kind]}</Muted>
      </section>

      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.learners.label}>
        <h2 style={h2Style}>{s.learners.title[space.kind]}</h2>
        {learners.length === 0 ? <Muted>{s.learners.none}</Muted> : null}
        {learners.map((l) => (
          <div key={l.memberId} style={{ ...rowStyle, flexWrap: 'wrap' }}>
            <span>
              {l.name} <span style={{ color: colors.text.muted }}>· {c.space.learner.joined(relativeDay(l.joinedAt, now, locale))}</span>
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
              {move && space.kind === 'class' && !archived ? <MoveRowAction name={l.name} online={move.online} onMove={() => move.onMove(l)} /> : null}
              {move && space.kind === 'family' && !archived && move.familyMovable?.has(l.memberId) ? <MoveRowAction family name={l.name} online={move.online} onMove={() => move.onMove(l)} /> : null}
              <Button disabled={busy || archived} onClick={() => onRemoveLearner(l)}>
                {s.learners.remove[space.kind].cta}
              </Button>
            </span>
          </div>
        ))}
      </section>

      {notesPanel}

      <section style={{ ...panelStyle, marginBottom: spacing.lg, borderColor: colors.feedback.danger }} aria-label={s.danger.title}>
        <h2 style={{ ...h2Style, color: colors.feedback.danger }}>{s.danger.title}</h2>
        <div style={{ marginBottom: spacing.md }}>
          <Button tone="danger" disabled={busy} onClick={onArchive}>
            {archived ? s.danger.unarchive.cta : s.danger.archive[space.kind].cta}
          </Button>
          <Muted>{c.archiveKeeps}</Muted>
        </div>
        <div>
          <h3 style={{ fontSize: typography.size.body, margin: `0 0 ${spacing.xs}px` }}>{s.danger.deleteTitle}</h3>
          {!mayDelete ? (
            <Muted>{c.deleteAskParent}</Muted>
          ) : (
            <>
              <Muted>{c.deleteLearnerWarn}</Muted>
              <select value={deleteTarget} onChange={(e) => onDeleteTarget(e.target.value)} aria-label={s.danger.deleteLabel} style={{ padding: spacing.xs, marginBottom: spacing.sm }}>
                <option value="">{s.danger.chooseLearner}</option>
                {learners.map((l) => (
                  <option key={l.memberId} value={l.memberId}>{l.name}</option>
                ))}
              </select>
              {deleteCandidate ? (
                <>
                  <Field name="typedName" label={s.danger.typeToConfirm(deleteCandidate.name)} value={typedName} onChange={onTypedName} />
                  <Button tone="danger" disabled={busy || typedName.trim() !== deleteCandidate.name} onClick={() => onDelete(deleteCandidate)}>
                    {s.danger.deleteData(deleteCandidate.name)}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}
