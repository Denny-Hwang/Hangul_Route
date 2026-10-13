'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { SettingsSections } from '@/components/console/SettingsParts';
import { FamilyStartFlow } from '@/components/console/FamilyTransferParts';
import { StartMoveSheet, TransferSheet, useOnline, useTransfersShown } from '@/components/console/TransferParts';
import { Button, LoadErrorPanel, Muted, Notice } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsole } from '@/components/console/use-console';
import type { MemberView, Roster, TransferOption } from '@/lib/console/api';
import { schoolConsentModeEnabled } from '@/lib/console/config';
import { personaHome, personaOfKind } from '@/lib/console/personas';
import { ROUTES, isKnownSpaceKind, loadErrorKey, spaceIdFrom, type LoadError } from '@/lib/console/routing';
import type { Messages } from '@hangul-route/i18n';

type SettingsNote = keyof Messages['console']['settings']['notes'];

/** console/space-settings — F-TCH-001 §10.3. Housekeeping only; never progress data. */
function SettingsInner(): JSX.Element {
  const spaceId = spaceIdFrom(useSearchParams());
  const router = useRouter();
  const { ready, session, api, signOut, m } = useConsole();
  const c = m.console;
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
  const [moveNote, setMoveNote] = useState<'sent' | 'locked' | 'signIn' | 'familyTooNew' | 'conflicted' | null>(null);
  const movesShown = useTransfersShown();
  const online = useOnline();
  // On a family (T-6d): the learners in a live class, from the class-moves list's `options`.
  const [moveOptions, setMoveOptions] = useState<TransferOption[]>([]);
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
      const moves = await api.transferRequests(spaceId);
      setMoveOptions(moves.ok ? (moves.data.options ?? []) : []);
    }
  }, [api, spaceId, movesShown]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <AdultFrame onSignOut={signOut} title={space ? s.titleFor(space.name) : s.title}>
      <Muted>
        <Link href={ROUTES.space(spaceId, space?.kind)}>{s.back(space?.name ?? null)}</Link>
      </Muted>
      {error ? <LoadErrorPanel error={error} forbidden={s.forbidden} onRetry={() => void load()} /> : null}
      {note ? <Notice tone="nudge">{s.notes[note]}</Notice> : null}
      {archived && space ? <Notice tone="nudge">{s.archived[space.kind]}</Notice> : null}
      {moveNote === 'sent' ? <Notice tone="success">{c.transfer.start.sent}</Notice> : null}
      {moveNote === 'locked' ? <Notice tone="nudge">{c.transfer.states.locked}</Notice> : null}
      {moveNote === 'signIn' ? <Notice tone="nudge">{c.start.signInAgain}</Notice> : null}
      {moveNote === 'familyTooNew' || moveNote === 'conflicted' ? <Notice tone="nudge">{c.transfer.states[moveNote]}</Notice> : null}

      {roster && space && api ? (
        <>
          <SettingsSections
            roster={roster}
            members={members}
            accountId={session.accountId}
            now={now}
            busy={busy}
            schoolConsent={schoolConsentModeEnabled()}
            deleteTarget={deleteTarget}
            typedName={typedName}
            onRegenerate={() => {
              if (roster.joinCode && !window.confirm(`${s.joinCode.regenerateAsk} ${c.oldCodeStops}`)) return;
              void run(() => api.regenerateCode(spaceId), 'codeReady', 'codeFailed');
            }}
            onConsent={(mode) => void run(() => api.patchSettings(spaceId, { consentMode: mode }), 'saved', 'saveFailed')}
            onAnonymize={(on) => void run(() => api.patchSettings(spaceId, { anonymizeRoster: on }), 'saved', 'saveFailed')}
            onRemoveAdult={(member) => {
              if (window.confirm(s.grownUps.removeAsk(member.name, space.name))) void run(() => api.removeMember(spaceId, 'account', member.memberId), 'removed', 'removeFailed');
            }}
            onRemoveLearner={(member) => {
              if (window.confirm(s.learners.removeAsk(member.name, space.name))) void run(() => api.removeMember(spaceId, 'learner', member.memberId), 'removed', 'removeFailed');
            }}
            onArchive={() => {
              if (archived || window.confirm(`${s.danger.archiveAsk(space.name)} ${c.archiveKeeps}`)) void run(() => api.archiveSpace(spaceId, !archived), archived ? 'unarchived' : 'archived', 'saveFailed');
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
                      setMoving(member);
                    },
                  }
                : undefined
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
            <StartMoveSheet
              spaceId={spaceId}
              learner={{ id: moving.memberId, name: moving.name }}
              api={api}
              online={online}
              onClose={() => setMoving(null)}
              onSent={() => {
                setMoving(null);
                setMoveNote('sent');
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
                  setMoveNote(state === 'forbidden' ? 'locked' : state);
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

export default function SettingsPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <SettingsInner />
    </Suspense>
  );
}
