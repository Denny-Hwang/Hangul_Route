'use client';

import { colors, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsoleAuth } from '@/components/console/auth-context';
import { FamilyMoves, FamilyPageStateLine, type FamilyPageState } from '@/components/console/FamilyTransferParts';
import { MoveButton, useOnline, useTransfersShown } from '@/components/console/TransferParts';
import { useConsole } from '@/components/console/use-console';
import type { Roster } from '@/lib/console/api';
import { signInAgainUrl } from '@/lib/console/grown-up-lock';
import { ROUTES, isKnownSpaceKind, spaceIdFrom } from '@/lib/console/routing';
import { TRANSFER_REFRESH_MS } from '@/lib/console/transfer';

/**
 * console/class-moves, F-SPACE-002 section 4.8 (wireframe `console/class-transfer.md` screen 3; mockups
 * `design/screens/transfer/family-page.md` and `consent-sheet.md`, T-0b). This PR (T-6d) draws the family variant:
 * a family `id` shows its learners' requests, Start a move and the teacher-requests switch. The class and school
 * variants (the requests page) are T-6b; until then such an id reads "Class moves aren't available yet." The URL
 * carries the space id only (T14); the heading names the family from the roster, never a literal "Our family".
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
  }, [api, shown, spaceId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const space = roster?.space ?? null;
  const pageState: FamilyPageState | 'failed' | null = !shown ? 'locked' : state ?? (space && space.kind !== 'family' ? 'locked' : null);
  const stateText =
    pageState === 'locked' ? t.states.locked : pageState === 'signIn' ? c.start.signInAgain : pageState === 'forbidden' ? t.states.forbidden : pageState === 'failed' ? c.cantReach : null;

  return (
    <AdultFrame onSignOut={signOut}>
      <p style={{ margin: `0 0 ${spacing.sm}px` }}>
        <Link href={ROUTES.space(spaceId, space?.kind)}>{space ? t.back(space.name) : t.actions.backToRoster.cta}</Link>
      </p>
      <h1 style={{ fontSize: typography.size.prompt, margin: 0 }}>{t.title}</h1>
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
      {stateText ? null :  space && api ? (
        <FamilyMoves familyId={spaceId} familyName={space.name} api={api} online={online} refreshMs={TRANSFER_REFRESH_MS} onPageState={setState} />
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
