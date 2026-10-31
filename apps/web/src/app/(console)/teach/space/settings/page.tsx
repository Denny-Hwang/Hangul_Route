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
import { useRosterChanges } from '@/components/console/use-roster-changes';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import { unarchiveOverCap, type ApiResult, type MemberView, type RelinkView, type Roster, type TransferOption, type TransferView } from '@/lib/console/api';
import type { ClassMoveLists } from '@/lib/console/class-moves';
import { attentionModel, type LearnerStatus } from '@/lib/console/learner-status';
import { archiveConfirmText, archivePlanNote, settleWithin } from '@/lib/console/archive-plan-note';
import { notesEnabled, schoolConsentModeEnabled } from '@/lib/console/config';
import { personaHome, personaOfKind } from '@/lib/console/personas';
import { ROUTES, isKnownSpaceKind, loadErrorKey, spaceIdFrom, type LoadError } from '@/lib/console/routing';
import { spaceSubPageBack } from '@/lib/console/page-back';
import { capState, familyCountLine, seatLine } from '@/lib/console/rollup';
import { RenameStyles, SettingsNameRow, useAnnouncer, useNameOverrides, useSpaceRename } from '@/components/console/RenameParts';
import { LEARNER_CLASS_CAP, type BillingSummary } from '@hangul-route/content-schema';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import type { Messages } from '@hangul-route/i18n';

type SettingsNote = keyof Messages['console']['settings']['notes'];

/** F-BILL-002 B-12: how long the archive confirm waits for a billing read still under way. */
const ARCHIVE_PLAN_WAIT_MS = 1500;

/**
 * What a read of the class found: its members, or why it drew nothing (`gone`: the space no longer reads). A read that
 * a newer one replaced answers the newer one's outcome.
 */
type LoadOutcome = { members: MemberView[] } | { failed: 'forbidden' | 'gone' | 'cantReach' };

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
  // Owner report 2026-10-23: a move the server could not find, read again: the learner already left this class (their
  // name), or is still listed (`still`: the plain "did not work" line). Never the forbidden line while the class reads.
  const [moveGone, setMoveGone] = useState<{ name: string } | 'still' | null>(null);
  // An unarchive the class cap refused (`409 unarchive_over_cap`): how many learners, when the answer said.
  const [overCap, setOverCap] = useState<{ learners: number | null } | null>(null);
  const movesShown = useTransfersShown();
  const online = useOnline();
  // On a family (T-6d): the learners in a live class, from the class-moves list's `options`.
  const [moveOptions, setMoveOptions] = useState<TransferOption[]>([]);
  // AMENDMENTS-GROWNUP-UX GX-10 (T11, P7): the lists each learner row's status is drawn from (`attentionModel`, the class
  // roster's model) and whether the family's classes were read (a class line only then). null: not read, adds nothing.
  const [relinkList, setRelinkList] = useState<RelinkView[] | null>(null);
  const [transferList, setTransferList] = useState<TransferView[] | null>(null);
  const [classMoveLists, setClassMoveLists] = useState<ClassMoveLists | null>(null);
  const [optionsRead, setOptionsRead] = useState(false);
  // F-BILL-002 B-12: the billing summary read, so the archive confirm can name the plan it affects; null = no line.
  const billingRead = useRef<Promise<BillingSummary | null> | null>(null);
  const asking = useRef(false);
  const now = new Date();

  // [SA] A read that began before a rename settled may hold the old name: the renamed name is laid over it (section 5.3).
  const names = useNameOverrides();
  // Which read may still draw (the roster page's pattern, owner report 2026-10-23): every read takes a new number, and a
  // read that ends after a newer one started draws nothing, so an older list never puts back a learner who moved out.
  const loadSeq = useRef(0);
  // The newest read: a read that a newer one replaced answers what the newer one found, never "failed".
  const latestRead = useRef<Promise<LoadOutcome> | null>(null);
  // Whether a list has been drawn yet: until then a quiet read is a first load, so a failure shows the retry panel.
  const drawn = useRef(false);
  // `quiet`: a read after the move sheet closes, or when the tab comes back into view. It keeps what is drawn while it
  // reads, and one that cannot reach the Worker changes nothing; a removed teacher or a deleted space still shows.
  const load = useCallback(
    (quiet = false): Promise<LoadOutcome> => {
      if (!api) return Promise.resolve({ failed: 'cantReach' });
      const call = ++loadSeq.current;
      const loud = !quiet || !drawn.current;
      const read = (async (): Promise<LoadOutcome> => {
        if (loud) setError(null);
        const started = names.begin();
        const [r, mem] = await Promise.all([api.roster(spaceId), api.members(spaceId)]);
        if (call !== loadSeq.current) return latestRead.current ?? { failed: 'cantReach' };
        if (!r.ok) {
          const failed = r.error === 'forbidden' ? 'forbidden' : r.error === 'not_found' ? 'gone' : 'cantReach';
          if (loud || failed !== 'cantReach') setError(loadErrorKey(r.error));
          return { failed };
        }
        // A space kind this bundle cannot word (a newer Worker) reads as a failed load, never a blank page.
        if (!mem.ok || !isKnownSpaceKind(r.data.space.kind)) {
          if (loud) setError('cantReach');
          return { failed: 'cantReach' };
        }
        if (!loud) setError(null);
        drawn.current = true;
        setRoster({ ...r.data, space: { ...r.data.space, name: names.nameFor(r.data.space.id, r.data.space.name, started) } });
        setMembers(mem.data);
        // GX-10: the status lists, extra like the move options: a failed read (or a method an older bundle lacks) adds
        // nothing and never breaks the settings page. Re-links whatever CLASS_TRANSFER says; moves only while shown.
        const kind = r.data.space.kind;
        const movesRead = movesShown && (kind === 'class' || kind === 'family');
        const extra = <T,>(read: () => Promise<ApiResult<T>>): Promise<ApiResult<T> | null> => Promise.resolve().then(read).catch(() => null);
        const [relinks, moves, teacherMoves] = await Promise.all([
          kind === 'class' || kind === 'family' ? extra(() => api.relinkRequests(spaceId)) : null,
          movesRead ? extra(() => api.transferRequests(spaceId)) : null,
          movesRead && kind === 'class' ? extra(() => api.classMoves(spaceId)) : null,
        ]);
        if (call === loadSeq.current) {
          setRelinkList(relinks?.ok ? relinks.data : null);
          setTransferList(moves?.ok ? moves.data.requests : null);
          setClassMoveLists(teacherMoves?.ok ? teacherMoves.data : null);
          // On a family (T-6d): the learners in a live class, from the class-moves list's `options`.
          setMoveOptions(moves?.ok ? (moves.data.options ?? []) : []);
          setOptionsRead(kind === 'family' && moves?.ok === true && Array.isArray(moves.data.options));
        }
        return { members: mem.data };
      })();
      latestRead.current = read;
      return read;
    },
    [api, spaceId, movesShown, names],
  );

  useEffect(() => {
    drawn.current = false;
    void load();
  }, [load]);

  // An open settings page never keeps a learner who moved to another class: it reads again when the tab comes back
  // into view (no slow poll: a settings page is not a classroom screen) and when another console tab changed a roster.
  useVisibleRefresh(() => void load(true), !!api && !error);
  useRosterChanges(() => void load(true), !!api && !error);

  // [SA] The Name block (AMENDMENTS-SEATS-ADMINS section 5.3): the title and the Back label read the new name at once.
  const { announce, region: renameLive } = useAnnouncer();
  const setName = useCallback(
    (name: string, settled: boolean) => {
      names.set(spaceId, name, settled);
      setRoster((prev) => (prev ? { ...prev, space: { ...prev.space, name } } : prev));
    },
    [names, spaceId],
  );
  const rename = useSpaceRename({ api, spaceId, name: roster?.space.name ?? '', onName: setName, announce });

  // Known once the roster loads: null until then. Only a live space reads the summary.
  const archivedFlag = roster ? !!roster.space.archivedAt : null;
  useEffect(() => {
    // Once per space while it is live, not on every reload after a settings action. Read quietly
    // (`poll`: no billing view event); a failed read keeps the plain confirm.
    billingRead.current = api && archivedFlag === false ? api.billingSummary({ poll: true }).then((summary) => (summary.ok ? summary.data : null)) : null;
  }, [api, spaceId, archivedFlag]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const run = async (action: () => Promise<ApiResult<unknown>>, okNote: SettingsNote, failNote: SettingsNote): Promise<boolean> => {
    if (!api) return false;
    setBusy(true);
    setNote(null);
    setOverCap(null);
    const result = await action();
    setBusy(false);
    // An unarchive the class cap refused says why, not just "Didn't save." (owner report 2026-10-23).
    const refused = unarchiveOverCap(result);
    if (refused) setOverCap(refused);
    else setNote(result.ok ? okNote : failNote);
    if (result.ok) await load();
    return result.ok;
  };

  // The one remove flow for a learner of this space: the settings row and the move sheet's Remove here both use it.
  const removeLearner = (member: MemberView, spaceName: string): void => {
    if (!api) return;
    void confirm({ title: s.learners.removeAsk(member.name, spaceName), confirmLabel: c.confirm.remove }).then(async (yes) => {
      if (!yes) return;
      // Who is in this class changed: an open roster in another console tab reads again at once.
      if (await run(() => api.removeMember(spaceId, 'learner', member.memberId), 'removed', 'removeFailed')) announceRosterChange();
    });
  };

  const space = roster?.space ?? null;
  const archived = !!space?.archivedAt;
  // [SA] AMENDMENTS-SEATS-ADMINS section 6.6: an administrator (not the owner) of this school sees it control by control.
  // GX-10: one status per learner, the class roster's own model (a school's rows carry none).
  const statuses: Record<string, LearnerStatus> | undefined =
    roster && (roster.space.kind === 'class' || roster.space.kind === 'family')
      ? attentionModel({ kind: roster.space.kind, roster: roster.learners, relinks: relinkList, transfers: movesShown ? transferList : null, classMoves: movesShown && roster.space.kind === 'class' ? classMoveLists : null, now }).byLearner
      : undefined;
  // P7: a family learner's classes, only when the options were read (never "Family only" on a guess).
  const familyClasses = optionsRead ? new Map(moveOptions.map((o) => [o.learnerId, o.classes.map((k) => k.name)] as const)) : null;
  const schoolAdmin = space?.kind === 'school' && members.some((mb) => mb.memberKind === 'account' && mb.memberId === session.accountId && mb.role === 'admin' && !mb.isOwner);

  return (
    <AdultFrame onSignOut={signOut} back={spaceSubPageBack(spaceId, space?.kind, s.back(space?.name ?? null))} title={space ? s.titleFor(space.name) : s.title}>
      {confirmSheet}
      {error ? <LoadErrorPanel error={error} forbidden={s.forbidden} onRetry={() => void load()} /> : null}
      {note ? <Notice tone="nudge">{s.notes[note]}</Notice> : null}
      {archived && space ? <Notice tone="nudge">{s.archived[space.kind]}</Notice> : null}
      {moveNote === 'sent' ? <Notice tone="success">{c.transfer.start.sent}</Notice> : null}
      {teacherMoveLine ? <Notice tone="success">{teacherMoveLine}</Notice> : null}
      {moveGone === 'still' ? <Notice tone="nudge">{c.teacherMove.errors.failed}</Notice> : moveGone ? <Notice tone="info">{s.learnerGone(moveGone.name)}</Notice> : null}
      {overCap ? <Notice tone="nudge">{s.unarchiveOverCap(overCap.learners, LEARNER_CLASS_CAP)}</Notice> : null}
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
            statuses={statuses}
            familyClasses={familyClasses}
            // An action chip opens the decision for that item on its shipped page (ids only in the address).
            onOpenStatus={(status) => router.push(status.kind === 'relink' ? ROUTES.spaceRelink(spaceId, space.kind) : ROUTES.spaceTransfers(spaceId, space.kind))}
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
            onRemoveLearner={(member) => removeLearner(member, space.name)}
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
                      setMoveGone(null);
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
              // Every way out of the sheet reads the members again (owner report 2026-10-23): a move may have landed even
              // when the sheet did not say so, and the list below must never keep a learner who left this class.
              onClose={() => {
                setMoving(null);
                void load(true);
              }}
              onDone={(move) => {
                const name = moving.name;
                setMoving(null);
                setTeacherMoveLine(move.status === 'moved' ? c.teacherMove.moved(name, move.to.name) : c.teacherMove.sent(move.to.name));
                void load(true);
              }}
              onPageState={(state) => {
                const learner = moving;
                setMoving(null);
                void load(true).then((read) => {
                  if (state === 'forbidden') {
                    // A not-found move while this class still reads: the caller still manages it, so never the forbidden
                    // line. Most often the learner already left (another tab, another teacher, the family).
                    if ('members' in read) {
                      const still = read.members.some((mb) => mb.memberKind === 'learner' && mb.memberId === learner.memberId);
                      setMoveGone(still ? 'still' : { name: learner.name });
                      return;
                    }
                    // The read could not tell (the Worker did not answer): the plain "did not work" line. The forbidden
                    // line only when the class itself no longer reads.
                    if (read.failed === 'cantReach') {
                      setMoveGone('still');
                      return;
                    }
                  }
                  setMoveNote(state);
                });
              }}
              onRemoveHere={() => {
                const learner = moving;
                setMoving(null);
                removeLearner(learner, space.name);
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
