'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsoleAuth } from '@/components/console/auth-context';
import { ClassMoves } from '@/components/console/ClassTransferParts';
import { FamilyMoves, FamilyPageStateLine, type FamilyPageState } from '@/components/console/FamilyTransferParts';
import { TeacherMovesSection } from '@/components/console/TeacherMovesSection';
import { MoveButton, useOnline, useTransfersShown } from '@/components/console/TransferParts';
import { useConsole } from '@/components/console/use-console';
import type { Roster, SpaceListItem } from '@/lib/console/api';
import { signInAgainUrl } from '@/lib/console/grown-up-lock';
import { ROUTES, isKnownSpaceKind, spaceIdFrom } from '@/lib/console/routing';
import { TRANSFER_REFRESH_MS } from '@/lib/console/transfer';
import { directClassIds } from '@/lib/console/transfer-requests';
import { rem } from '@/lib/console/rem';

/**
 * console/class-moves, F-SPACE-002 section 4.8 (wireframe `console/class-transfer.md` screen 3; mockups
 * `design/screens/transfer/family-page.md` and `consent-sheet.md`, T-0b). A family `id` shows its learners' requests,
 * Start a move and the teacher-requests switch (T-6d); a class `id` the requests page, *Leaving this class* and
 * *Joining this class* (T-6b, `requests-page.md`; an archived class is read-only). A school has no page of its own:
 * its home row links straight to each child class's page (counts only), so a school id reads "Class moves aren't
 * available yet." The URL carries the space id only (T14); the heading names the space from the roster, never a
 * literal "Our family".
 * Nothing renders and nothing is asked of the Worker while `NEXT_PUBLIC_CLASS_TRANSFER` is unset.
 */
function TransfersInner(): JSX.Element {
  const params = useSearchParams();
  const pathname = usePathname();
  const spaceId = spaceIdFrom(params);
  const auth = useConsoleAuth();
  const { ready, session, api, signOut, m } = useConsole();
  const c = m.console;
  const t = c.transfer;
  const shown = useTransfersShown();
  const online = useOnline();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [state, setState] = useState<FamilyPageState | 'failed' | null>(null);
  // Agree for both classes (T11) needs the classes this account owns or teaches itself. The class page waits for this
  // read (or its failure, which means plain Agree) so a card's Agree never changes its words under the pointer.
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [spacesRead, setSpacesRead] = useState(false);

  const loadRoster = useCallback(async (): Promise<void> => {
    if (!api || !shown) return;
    const r = await api.roster(spaceId);
    if (!r.ok) {
      setState(r.error === 'unauthorized' ? 'signIn' : r.error === 'forbidden' || r.error === 'not_found' ? 'forbidden' : 'failed');
      return;
    }
    if (!isKnownSpaceKind(r.data.space.kind)) {
      setState('failed');
      return;
    }
    setRoster(r.data);
    if (r.data.space.kind === 'class') {
      const list = await api.listSpaces();
      if (list.ok) setSpaces(list.data);
      setSpacesRead(true);
    }
  }, [api, shown, spaceId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const space = roster?.space ?? null;
  const pageState: FamilyPageState | 'failed' | null = !shown ? 'locked' : state ?? (space && space.kind === 'school' ? 'locked' : null);
  const stateText =
    pageState === 'locked' ? t.states.locked : pageState === 'signIn' ? c.start.signInAgain : pageState === 'forbidden' ? t.states.forbidden : pageState === 'failed' ? c.cantReach : null;

  return (
    <AdultFrame onSignOut={signOut}>
      <p style={{ margin: `0 0 ${spacing.sm}px` }}>
        <Link href={ROUTES.space(spaceId, space?.kind)}>{space ? t.back(space.name) : t.actions.backToRoster.cta}</Link>
      </p>
      <h1 style={{ fontSize: rem(typography.size.prompt), margin: 0 }}>{t.title}</h1>
      {space ? <p style={{ margin: `0 0 ${spacing.md}px`, color: colors.text.secondary, fontWeight: typography.weight.semibold }}>{space.name}</p> : null}
      {stateText ? (
        <FamilyPageStateLine>{stateText}</FamilyPageStateLine>
      ) : null}
      {pageState === 'signIn' ? (
        // A rejected session: sign out, then the sign-in page brings the guardian back here (spec 4.8).
        <MoveButton primary onClick={() => void auth.signOut(signInAgainUrl(`${pathname}?${params.toString()}`))} testId="transfers-sign-in">
          {c.lock.signInAgain.cta}
        </MoveButton>
      ) : null}
      {stateText ? null : space && api && space.kind === 'family' ? (
        <FamilyMoves familyId={spaceId} familyName={space.name} api={api} online={online} refreshMs={TRANSFER_REFRESH_MS} onPageState={setState} />
      ) : space && api && space.kind === 'class' && spacesRead ? (
        <>
        {/* [TV] Teacher moves (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D8): asks into and out of this class. */}
        <TeacherMovesSection spaceId={spaceId} api={api} online={online} readOnly={space.archivedAt !== null} refreshMs={TRANSFER_REFRESH_MS} onPageState={setState} />
        <ClassMoves
          spaceId={spaceId}
          spaceName={space.name}
          api={api}
          online={online}
          refreshMs={TRANSFER_REFRESH_MS}
          readOnly={space.archivedAt !== null}
          direct={directClassIds(spaces)}
          confirm={(question) => typeof window !== 'undefined' && window.confirm(question)}
          onPageState={setState}
        />
        </>
      ) : null}
    </AdultFrame>
  );
}

export default function TransfersPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <TransfersInner />
    </Suspense>
  );
}
