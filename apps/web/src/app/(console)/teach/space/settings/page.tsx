'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SettingsSections } from '@/components/console/SettingsParts';
import { FamilyStartFlow } from '@/components/console/FamilyTransferParts';
import { NoteSendersPanel } from '@/components/console/FamilyNotesParts';
import { TeacherMoveSheet } from '@/components/console/TeacherMoveSheet';
import { TransferSheet, useOnline, useTransfersShown } from '@/components/console/TransferParts';
import { Button, LoadErrorPanel, Notice } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConfirm } from '@/components/console/ConfirmSheet';
import { useConsole } from '@/components/console/use-console';
import { useNotesApi } from '@/components/console/use-notes-api';
import type { MemberView, Roster, TransferOption } from '@/lib/console/api';
import { archiveConfirmText, archivePlanNote, settleWithin } from '@/lib/console/archive-plan-note';
import { notesEnabled, schoolConsentModeEnabled } from '@/lib/console/config';
import { personaHome, personaOfKind } from '@/lib/console/personas';
import { isKnownSpaceKind, loadErrorKey, spaceIdFrom, type LoadError } from '@/lib/console/routing';
import { spaceSubPageBack } from '@/lib/console/page-back';
import { capState, familyCountLine, seatLine } from '@/lib/console/rollup';
import { RenameStyles, SettingsNameRow, useAnnouncer, useSpaceRename } from '@/components/console/RenameParts';
import type { BillingSummary } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

type SettingsNote = keyof Messages['console']['settings']['notes'];

/** F-BILL-002 B-12: how long the archive confirm waits for a billing read still under way. */
const ARCHIVE_PLAN_WAIT_MS = 1500;

/** console/space-settings — F-TCH-001 §10.3. Housekeeping only; never progress data. */
function SettingsInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const notesApi = useNotesApi();
  const c = m.console;
  // The confirm step in the console language (AMENDMENTS-DISPLAY-NAV section 8).
  const { confirm, sheet: confirmSheet } = useConfirm();
  const s = c.settings;
  const [roster, setRoster] = useState<Roster | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  // Keys, not text: the messages are looked up at render time, so they follow the header language select.
  const [error, setError] = useState<LoadError | null>(null);
  const [note, setNote] = useState<SettingsNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const [typedName, setTypedName] = useState('');
  // Class moves (F-SPACE-002 T-6c): the learner whose start sheet is open, and the page line it left behind.
  const [moving, setMoving] = useState<MemberView | null>(null);
  const [moveNote, setMoveNote] = useState<'sent' | 'locked' | 'signIn' | 'forbidden' | 'familyTooNew' | 'conflicted' | null>(null);
  // [TV] A teacher move's outcome line (TV-D7: moved now; TV-D8: sent to the other class).
  const [teacherMoveLine, setTeacherMoveLine] = useState<string | null>(null);
  const movesShown = useTransfersShown();
  const online = useOnline();
  // On a family (T-6d): the learners in a live class, from the class-moves list's `options`.
  const [moveOptions, setMoveOptions] = useState<TransferOption[]>([]);
  // F-BILL-002 B-12: the billing summary read, so the archive confirm can name the plan it affects; null = no line.
  const billingRead = useRef<Promise<BillingSummary | null> | null>(null);
  const asking = useRef(false);
  const now = new Date();

  const load = useCallback(async (): Promise<void> => {
    if (!api) return;
    setError(null);
    const [r, mem] = await Promise.all([api.roster(spaceId), api.members(spaceId)]);
    if (!r.ok) {
      setError(loadErrorKey(r.error));
      return;
    }
    // A space kind this bundle cannot word (a newer Worker) reads as a failed load, never a blank page.
    if (!mem.ok || !isKnownSpaceKind(r.data.space.kind)) {
      setError('cantReach');
      return;
    }
    setRoster(r.data);
    setMembers(mem.data);
    if (r.data.space.kind === 'family' && movesShown) {
      // The move options are extra: a failed read leaves them empty and never breaks the settings page.
      const moves = await Promise.resolve()
        .then(() => api.transferRequests(spaceId))
        .catch(() => null);
      setMoveOptions(moves?.ok ? (moves.data.options ?? []) : []);
    }
  }, [api, spaceId, movesShown]);

  useEffect(() => {
    void load();
  }, [load]);

  // [SA] The Name block (AMENDMENTS-SEATS-ADMINS section 5.3): the title and the Back label read the new name at once.
  const { announce, region: renameLive } = useAnnouncer();
  const setName = useCallback((name: string) => setRoster((prev) => (prev ? { ...prev, space: { ...prev.space, name } } : prev)), []);
  const rename = useSpaceRename({ api, spaceId, name: roster?.space.name ?? '', onName: setName, announce });

  // Known once the roster loads: null until then. Only a live space reads the summary.
  const archivedFlag = roster ? !!roster.space.archivedAt : null;
  useEffect(() => {
    // Once per space while it is live, not on every reload after a settings action. Read quietly
    // (`poll`: no billing view event); a failed read keeps the plain confirm.
    billingRead.current = api && archivedFlag === false ? api.billingSummary({ poll: true }).then((summary) => (summary.ok ? summary.data : null)) : null;
  }, [api, spaceId, archivedFlag]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const run = async (action: () => Promise<{ ok: boolean }>, okNote: SettingsNote, failNote: SettingsNote): Promise<void> => {
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
  // [SA] AMENDMENTS-SEATS-ADMINS section 6.6: an administrator (not the owner) of this school sees it control by control.
  const schoolAdmin = space?.kind === 'school' && members.some((mb) => mb.memberKind === 'account' && mb.memberId === session.accountId && mb.role === 'admin' && !mb.isOwner);

  return (
    <AdultFrame onSignOut={signOut} back={spaceSubPageBack(spaceId, space?.kind, s.back(space?.name ?? null))} title={space ? s.titleFor(space.name) : s.title}>
      {confirmSheet}
      {error ? <LoadErrorPanel error={error} forbidden={s.forbidden} onRetry={() => void load()} /> : null}
      {note ? <Notice tone="nudge">{s.notes[note]}</Notice> : null}
      {archived && space ? <Notice tone="nudge">{s.archived[space.kind]}</Notice> : null}
      {moveNote === 'sent' ? <Notice tone="success">{c.transfer.start.sent}</Notice> : null}
      {teacherMoveLine ? <Notice tone="success">{teacherMoveLine}</Notice> : null}
      {moveNote === 'locked' ? <Notice tone="nudge">{c.transfer.states.locked}</Notice> : null}
      {moveNote === 'forbidden' ? <Notice tone="nudge">{c.transfer.states.forbidden}</Notice> : null}
      {moveNote === 'signIn' ? <Notice tone="nudge">{c.start.signInAgain}</Notice> : null}
      {moveNote === 'familyTooNew' || moveNote === 'conflicted' ? <Notice tone="nudge">{c.transfer.states[moveNote]}</Notice> : null}

      <RenameStyles />
      {renameLive}
      {roster && space && api ? (
        <>
          <SettingsNameRow rename={rename} name={space.name} kind={space.kind} canRename={roster.canRename === true} openMoves={roster.openMoves === true} archived={archived} />
          <SettingsSections
            joinCodeNote={space.kind === 'family' ? <FamilySeats roster={roster} /> : undefined}
            roster={roster}
            members={members}
            accountId={session.accountId}
            now={now}
            busy={busy}
            schoolConsent={schoolConsentModeEnabled()}
            schoolAdmin={schoolAdmin}
            deleteTarget={deleteTarget}
            typedName={typedName}
            onRegenerate={() => {
              void (async () => {
                if (roster.joinCode && !(await confirm({ title: s.joinCode.regenerateAsk, message: c.oldCodeStops, confirmLabel: c.confirm.newCode }))) return;
                void run(() => api.regenerateCode(spaceId), 'codeReady', 'codeFailed');
              })();
            }}
            onConsent={(mode) => void run(() => api.patchSettings(spaceId, { consentMode: mode }), 'saved', 'saveFailed')}
            onAnonymize={(on) => void run(() => api.patchSettings(spaceId, { anonymizeRoster: on }), 'saved', 'saveFailed')}
            onRemoveAdult={(member) => {
              void confirm({ title: s.grownUps.removeAsk(member.name, space.name), confirmLabel: c.confirm.remove }).then((yes) => {
                if (yes) void run(() => api.removeMember(spaceId, 'account', member.memberId), 'removed', 'removeFailed');
              });
            }}
            onRemoveLearner={(member) => {
              void confirm({ title: s.learners.removeAsk(member.name, space.name), confirmLabel: c.confirm.remove }).then((yes) => {
                if (yes) void run(() => api.removeMember(spaceId, 'learner', member.memberId), 'removed', 'removeFailed');
              });
            }}
            onArchive={() => {
              if (archived) {
                void run(() => api.archiveSpace(spaceId, false), 'unarchived', 'saveFailed');
                return;
              }
              if (asking.current) return;
              asking.current = true;
              // A click that lands before the billing read settles waits for it briefly, then asks.
              void settleWithin(billingRead.current, ARCHIVE_PLAN_WAIT_MS)
                .then((summary) => confirm({ title: archiveConfirmText(space.name, archivePlanNote(summary, spaceId, new Date(), locale), locale), confirmLabel: c.confirm.archive }))
                .then((yes) => {
                  asking.current = false;
                  if (yes) void run(() => api.archiveSpace(spaceId, true), 'archived', 'saveFailed');
                });
            }}
            onDeleteTarget={(memberId) => {
              setDeleteTarget(memberId);
              setTypedName('');
            }}
            move={
              movesShown
                ? {
                    online,
                    familyMovable: new Set(moveOptions.filter((o) => o.classes.length > 0 && !o.selfManaged).map((o) => o.learnerId)),
                    onMove: (member) => {
                      setMoveNote(null);
                      setTeacherMoveLine(null);
                      setMoving(member);
                    },
                  }
                : undefined
            }
            notesPanel={
              // Panel D (F-FEEDBACK-001 FB-12): who may send notes, behind the notes flag, on a family only.
              space.kind === 'family' && notesEnabled() && notesApi ? <NoteSendersPanel notesApi={notesApi} familyId={spaceId} viewerAccountId={session.accountId} m={m} locale={locale} /> : undefined
            }
            onTypedName={setTypedName}
            onDelete={(member) =>
              void run(() => api.deleteLearnerData(spaceId, member.memberId), 'deleted', 'deleteFailed').then(() => {
                setDeleteTarget('');
                setTypedName('');
              })
            }
          />
          {archived ? <Button onClick={() => router.push(personaHome(personaOfKind(space.kind)))}>{s.backToConsole.cta}</Button> : null}
          {moving && movesShown && space.kind === 'class' && !archived ? (
            <TeacherMoveSheet
              spaceId={spaceId}
              learner={{ id: moving.memberId, name: moving.name }}
              api={api}
              online={online}
              onClose={() => setMoving(null)}
              onDone={(move) => {
                const name = moving.name;
                setMoving(null);
                setTeacherMoveLine(move.status === 'moved' ? c.teacherMove.moved(name, move.to.name) : c.teacherMove.sent(move.to.name));
                // The learner left this class: the list below reads the new roster.
                if (move.status === 'moved') void load();
              }}
              onPageState={(state) => {
                setMoving(null);
                setMoveNote(state);
              }}
            />
          ) : null}
          {moving && movesShown && space.kind === 'family' && !archived ? (
            <TransferSheet title={c.transfer.start.title(moving.name)} onClose={() => setMoving(null)} testId="family-start-sheet">
              <FamilyStartFlow
                familyId={spaceId}
                familyName={space.name}
                options={moveOptions}
                api={api}
                online={online}
                preselect={{ learnerId: moving.memberId }}
                answersHidden={false}
                onCreated={() => {
                  setMoving(null);
                  setMoveNote('sent');
                }}
                onPageState={(state) => {
                  setMoving(null);
                  setMoveNote(state);
                }}
                onNotice={(notice) => {
                  setMoving(null);
                  setMoveNote(notice);
                }}
              />
            </TransferSheet>
          ) : null}
        </>
      ) : null}
    </AdultFrame>
  );
}

/**
 * A family's count and, at the cap or over it, the one line that says so ([SA] section 3.4): "3 of 4 learners", then
 * `seats.family.at` / `seats.family.over`. Nobody is removed; the line says to remove a learner below to add someone.
 */
function FamilySeats({ roster }: { roster: Roster }): JSX.Element | null {
  const { locale } = useConsole();
  const seats = capState('family', roster.learners.length, roster.seats);
  if (!seats) return null;
  const line = seatLine('family', seats, locale);
  return (
    <div data-testid="family-seats" style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, margin: `${spacing.xs}px 0 ${spacing.sm}px` }}>
      <p style={{ margin: 0, color: colors.text.secondary }}>{familyCountLine(seats, locale)}</p>
      {line ? (
        <p style={{ margin: 0, fontWeight: typography.weight.semibold }} data-testid="family-seats-line">
          {line.text}
        </p>
      ) : null}
    </div>
  );
}

export default function SettingsPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <SettingsInner />
    </Suspense>
  );
}
