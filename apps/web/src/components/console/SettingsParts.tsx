'use client';

import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useState, type ReactNode } from 'react';
import { ReasonLine, StatusChip } from '@/components/console/LearnerStatusParts';
import { MoveRowAction } from '@/components/console/TransferParts';
import { Button, Field, Muted, panelStyle } from '@/components/console/ui';
import type { MemberView, Roster } from '@/lib/console/api';
import { statusWords, type LearnerStatus, type LearnerStatusKind } from '@/lib/console/learner-status';
import { canDeleteLearnerData } from '@/lib/console/relink';
import { codeExpiry, relativeDay } from '@/lib/console/rollup';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { headRem, rem } from '@/lib/console/rem';
import type { Messages } from '@hangul-route/i18n';

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
  /** [SA] AMENDMENTS-SEATS-ADMINS section 3.4: under the join code, a family's count and its at-cap line. */
  joinCodeNote?: ReactNode;
  /** Panel D, who may send notes (F-FEEDBACK-001 FB-12, `console/family-notes.md` D): drawn after the learners, before the Danger zone. */
  notesPanel?: ReactNode;
  /**
   * [SA] AMENDMENTS-SEATS-ADMINS section 6.6 (SA-0b D16): the viewer is an administrator, not the owner, of this school.
   * Consent mode and Anonymize roster read as text with `ownerOnly`, a grown-up's Remove shows only where the Worker's
   * `canRemove` says so (teachers), and there is no Danger zone (archive and delete are the owner's).
   */
  schoolAdmin?: boolean;
  /**
   * AMENDMENTS-GROWNUP-UX GX-10 (T11, P7): each learner's one status (`attentionModel`, the class roster's own model), by
   * learner id, when the page read the lists. Its chip sits next to the name (none for a family's default state) and an
   * open move turns that learner's Move off with the reason. Absent (a school, a read not made): no chip.
   */
  statuses?: Readonly<Record<string, LearnerStatus>>;
  /** GX-10: an action chip's tap (Needs your OK) opens the decision for that item. */
  onOpenStatus?: (status: LearnerStatus) => void;
  /**
   * GX-10 (P7, section 7.2): a family's learners' class names, from the family's transfer list `options`. null or absent:
   * the read was skipped or failed, so no class line at all (never "Family only" on a guess); a learner missing from the
   * map has none either.
   */
  familyClasses?: ReadonlyMap<string, readonly string[]> | null;
}

const h2Style = { fontSize: rem(typography.size.bodyLg), margin: `0 0 ${spacing.xs}px` } as const;
/** A setting's value as text, for a school administrator (no switch). */
const readValue = { margin: 0, color: colors.text.primary, lineHeight: typography.leading.relaxed } as const;
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px 0` } as const;
/** The states that mean a move of this learner is open: Move is off while one is (GX-10, T11). */
const MOVE_OPEN: ReadonlySet<LearnerStatusKind> = new Set(['move_yours', 'move_others', 'move_room', 'move_scheduled']);

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
  joinCodeNote,
  schoolAdmin = false,
  statuses,
  onOpenStatus,
  familyClasses,
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
          <div style={{ fontSize: headRem(typography.size.display), fontWeight: typography.weight.bold, letterSpacing: spacing.sm, fontFamily: typography.family.mono }}>{roster.joinCode ?? '—'}</div>
          <Muted>{codeExpiry(roster.joinCodeExpiresAt, now, locale)}</Muted>
          {joinCodeNote}
          <Button disabled={busy} onClick={onRegenerate}>
            {roster.joinCode ? s.joinCode.regenerate.cta : s.joinCode.create.cta}
          </Button>
        </section>
      ) : null}

      {space.kind !== 'family' && schoolAdmin ? (
        <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.consent.title} data-testid="settings-consent-readonly">
          <h2 style={h2Style}>{s.consent.title}</h2>
          <p style={readValue}>{s.consent[space.settings.consentMode]}</p>
        </section>
      ) : space.kind !== 'family' ? (
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

      {schoolAdmin ? (
        <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.privacy.title} data-testid="settings-privacy-readonly">
          <h2 style={h2Style}>{s.privacy.title}</h2>
          <p style={readValue}>{s.privacy.anonymize}</p>
          <p style={{ ...readValue, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>{space.settings.anonymizeRoster ? s.privacy.anonymizeOn : s.privacy.anonymizeOff}</p>
          <p style={{ ...readValue, marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} data-testid="settings-owner-only">
            {s.ownerOnly}
          </p>
        </section>
      ) : (
      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.privacy.title}>
        <h2 style={h2Style}>{s.privacy.title}</h2>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={space.settings.anonymizeRoster} disabled={busy || archived} onChange={(e) => onAnonymize(e.target.checked)} /> {s.privacy.anonymize}
        </label>
        <Muted>{c.anonymizeHint}</Muted>
      </section>
      )}

      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.grownUps.label}>
        <h2 style={h2Style}>{s.grownUps.title}</h2>
        {adults.map((m) => (
          <div key={m.memberId} style={rowStyle}>
            <span>
              {m.name} <span style={{ color: colors.text.muted }}>· {s.grownUps.roleLine(s.grownUps.role[m.role] ?? m.role, m.memberId === accountId)}</span>
            </span>
            {(schoolAdmin ? m.canRemove === true : !m.isOwner) ? (
              <Button disabled={busy || archived} onClick={() => onRemoveAdult(m)}>
                {s.grownUps.remove.cta}
              </Button>
            ) : null}
          </div>
        ))}
        {space.kind === 'family' && roster.joinCode && !archived ? <InviteGrownUp code={roster.joinCode} /> : <Muted>{s.grownUps.invite[space.kind]}</Muted>}
      </section>

      <section style={{ ...panelStyle, marginBottom: spacing.lg }} aria-label={s.learners.label}>
        <h2 style={h2Style}>{s.learners.title[space.kind]}</h2>
        {learners.length === 0 ? <Muted>{s.learners.none}</Muted> : null}
        {learners.map((l, index) => {
          const status = statuses?.[l.memberId];
          const words = status && space.kind !== 'school' ? statusWords(status, now, locale) : null;
          const reasonId = `settings-reason-${index}`;
          const moveOpen = status ? MOVE_OPEN.has(status.kind) : false;
          const classes = space.kind === 'family' ? familyClasses?.get(l.memberId) : undefined;
          return (
            <div key={l.memberId} data-testid="settings-learner-row" data-status={status?.kind} style={{ ...rowStyle, flexWrap: 'wrap', borderTop: index > 0 ? `${borderWidth.thin}px solid ${colors.border.subtle}` : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xxs, minWidth: 0, flex: '1 1 12em' }}>
                <span data-testid="settings-learner-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                  <strong style={{ overflowWrap: 'anywhere' }}>{l.name}</strong>
                  {words ? <StatusChip words={words} onActivate={status && onOpenStatus ? () => onOpenStatus(status) : undefined} /> : null}
                </span>
                <span style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm) }}>
                  {classes ? `${classLine(classes, c.parentHome.classLine)} · ` : null}
                  {c.space.learner.joined(relativeDay(l.joinedAt, now, locale))}
                </span>
                {classes && classes.length > 1 ? <span style={{ color: colors.text.secondary, fontSize: rem(typography.size.bodySm), overflowWrap: 'anywhere' }}>{classes.join(', ')}</span> : null}
                {words?.reason ? <ReasonLine id={reasonId} text={words.reason} /> : null}
              </div>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
                {move && space.kind === 'class' && !archived ? <MoveRowAction name={l.name} online={move.online} blocked={moveOpen ? s.moveOpen : null} onMove={() => move.onMove(l)} /> : null}
                {move && space.kind === 'family' && !archived && move.familyMovable?.has(l.memberId) ? <MoveRowAction family name={l.name} online={move.online} blocked={moveOpen ? s.moveOpen : null} onMove={() => move.onMove(l)} /> : null}
                <Button tone="dangerText" testId="remove-learner" disabled={busy || archived} onClick={() => onRemoveLearner(l)}>
                  {s.learners.remove[space.kind].cta}
                </Button>
              </span>
            </div>
          );
        })}
      </section>

      {notesPanel}

      {schoolAdmin ? null : (
      <section style={{ ...panelStyle, marginBottom: spacing.lg, borderColor: colors.feedback.danger }} aria-label={s.danger.title}>
        <h2 style={{ ...h2Style, color: colors.feedback.danger }}>{s.danger.title}</h2>
        <div style={{ marginBottom: spacing.md }}>
          <Button tone="danger" disabled={busy} onClick={onArchive}>
            {archived ? s.danger.unarchive.cta : s.danger.archive[space.kind].cta}
          </Button>
          <Muted>{c.archiveKeeps}</Muted>
        </div>
        <div>
          <h3 style={{ fontSize: rem(typography.size.body), margin: `0 0 ${spacing.xs}px` }}>{s.danger.deleteTitle}</h3>
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
      )}
    </>
  );
}

type ClassLineWords = Messages['console']['parentHome']['classLine'];

/** A family learner's class line (section 7.2): one class by name, two or more as a count (the names follow), or none. */
function classLine(classes: readonly string[], t: ClassLineWords): string {
  if (classes.length === 0) return t.none;
  if (classes.length === 1) return t.one(classes[0] as string);
  return t.many(classes.length);
}

/**
 * GX-10 (P7): a family's **Invite another grown-up**. It copies the family code (the code alone, ready to paste in a
 * message) and one line says what the other grown-up does with it. The outcome is said in a polite live region, which
 * is always in the page; a refused clipboard says the code is on the screen (the Join code panel above).
 */
function InviteGrownUp({ code }: { code: string }): JSX.Element {
  const { messages } = useConsoleLocale();
  const c = messages.console;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async (): Promise<void> => {
    try {
      // No clipboard (an old browser, a page not in a secure context) throws here too.
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };
  return (
    <div data-testid="invite-grown-up-block" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm }}>
      <Button testId="invite-grown-up" onClick={() => void copy()}>
        {c.settings.inviteGrownUp.cta}
      </Button>
      <p style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodySm), overflowWrap: 'anywhere' }}>{c.settings.inviteGrownUpLine(code)}</p>
      <p role="status" aria-live="polite" data-testid="invite-grown-up-status" style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.bodySm) }}>
        {copyState === 'copied' ? c.joinCode.copied.cta : copyState === 'failed' ? c.parentHome.copyFailed : null}
      </p>
    </div>
  );
}
