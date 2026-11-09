import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flags } from '../../config/flags';
import { planCardsOf, spaceItemsOf, type AccountSpaceItem } from '../../logic/account/account-data';
import type { AccountApi, AccountApiResult } from '../../logic/account/api';
import { AccountLoadError, signOutLanding, spacesBucket } from '../../logic/account/homes';
import { joinHereTarget } from '../../logic/account/join-here';
import type { NativePlanCard } from '../../logic/account/plan-lines';
import { accountQueryKey } from '../../logic/account/queries';
import { DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY, deviceUsesRecord, keepsRecords, trustOfRead, usesOfSpaces } from '../../logic/account/sign-in-records';
import type { RootStackParamList } from '../../navigation/types';
import { readRetrustNotice, readTrust, removeRecord, writeDeviceUses } from '../../platform/account-records';
import { useAccountVisit } from '../../store/account-visit';
import { closeGrownUpSession } from '../../store/grown-up-session';
import { nativeGateState } from '../../store/native-gate-state';
import { useProfileStore } from '../../store/profile-store';
import { deviceShared, holdJoin } from '../../store/who-chooser';
import { trackHome, useAccountSignOut } from './account-session.native';
import type { AccountPageNavigation } from './ended-session.native';

export { useEndedSession, type AccountPageNavigation } from './ended-session.native';

/**
 * F-AUTH-004 sections 6.6, 8.1, 8.2, 8.5, 8.8 and 15 (rows NS-5, NS-6): what every native home and account page reads
 * and does the same way, on iOS and Android, inside `AccountGate`: the spaces and plan-status reads (in memory under
 * `['account', …]`, cleared with the session, CS-N4; each successful spaces read rewrites the uses record on a PIN
 * device), the `401` that ends the session, `auth.native.home` once per home mount, the re-trust notice once, Sign out
 * and where it lands, and Join on this device. Row NS-5 wrote these for the Family home; row NS-6 shares them with the
 * Teacher and School homes and the class, school and report pages.
 */

/** Every account page is read fresh when shown, and never retried by itself (8.8: Try again, or the network's return). */
export const ONLINE_PAGE = { retry: false, staleTime: 0 } as const;

/** A read that throws why it failed (`AccountLoadError`), so the screen can tell offline, `401` and the switch apart. */
export async function readOrThrow<T>(call: () => Promise<AccountApiResult>, parse: (data: unknown) => T | null): Promise<T> {
  const result = await call();
  if (!result.ok) throw new AccountLoadError(result.error);
  const parsed = parse(result.data);
  if (parsed === null) throw new AccountLoadError('error');
  return parsed;
}

/** The visit a read was asked in: its number, and the sign-in it ran under (another account's sign-in moves it). */
interface VisitMark {
  visit: number;
  signedInAt: number | null;
}

function visitMark(): VisitMark {
  const { visit, lastAccountSignInAt } = useAccountVisit.getState();
  return { visit, signedInAt: lastAccountSignInAt };
}

function sameVisit(asked: VisitMark): boolean {
  const now = useAccountVisit.getState();
  return now.visit === asked.visit && now.lastAccountSignInAt === asked.signedInAt && !now.signedOutThisRun;
}

/** The homes' form of the cached spaces answer (module level, so a render never parses again for nothing). */
const selectSpaceItems = (data: unknown): AccountSpaceItem[] => spaceItemsOf(data) ?? [];

/**
 * Section 8.1: the uses record rewritten from a spaces answer, on a PIN device whose trust matches its epoch, while the
 * visit that asked is still the one open and no Sign out ran since. Never throws.
 */
async function rewriteUsesRecord(data: unknown, asked: VisitMark): Promise<void> {
  try {
    const uses = usesOfSpaces(data);
    const [gate, trust] = await Promise.all([nativeGateState(), readTrust()]);
    if (uses === null || !sameVisit(asked) || !keepsRecords(gate)) return;
    if (trustOfRead(trust)?.epoch !== gate.epoch) return;
    await writeDeviceUses(deviceUsesRecord(uses, Date.now()));
    // A Sign out or a 401 that landed while the record was written deletes it again (NS-5 review).
    if (!sameVisit(asked)) await removeRecord(DEVICE_USES_RECORD_KEY);
  } catch {
    // The uses record waits for the next successful read.
  }
}

/**
 * `GET /api/spaces`. The cache holds the Worker's answer as it came (`{ spaces: [...] }`), the shape the sign-in stores
 * under the same key and the account card and the gate read (`usesOfSpaces`); a home reads its own form through
 * `select`. Each successful read rewrites the uses record on a PIN device (section 8.1).
 */
export function useAccountSpaces(api: AccountApi, online: boolean): UseQueryResult<AccountSpaceItem[]> {
  return useQuery({
    queryKey: accountQueryKey('spaces'),
    queryFn: async (): Promise<unknown> => {
      // The visit this read belongs to: a Sign out, a `401` or a session close while it is out must not see the uses
      // record written back after it deleted it (13.1, CS-N4).
      const asked = visitMark();
      const result = await api.spaces();
      if (!result.ok) throw new AccountLoadError(result.error);
      if (spaceItemsOf(result.data) === null) throw new AccountLoadError('error');
      // Section 8.1: on a PIN device each successful read rewrites the uses record (no names, no ids), only while the
      // trust still matches the epoch (the home is open only past the gate) and this visit is still the one open.
      void rewriteUsesRecord(result.data, asked);
      return result.data;
    },
    select: selectSpaceItems,
    enabled: online,
    ...ONLINE_PAGE,
  });
}

/** Section 8.5: the plan status (a fact beside the page: a read that fails shows no block, and fails nothing else). */
export function useAccountPlans(api: AccountApi, online: boolean): UseQueryResult<Map<string, NativePlanCard>> {
  return useQuery({ queryKey: accountQueryKey('plan'), queryFn: () => readOrThrow(() => api.planStatus(), planCardsOf), enabled: online, ...ONLINE_PAGE });
}

/** `auth.native.home { os, use, spaces }` once per home mount, after the first successful spaces read of it (section 15). */
export function useHomeEvent(spaces: UseQueryResult<AccountSpaceItem[]>, use: 'family' | 'teacher' | 'school' | 'account', listed: number): void {
  const mountedAt = useRef(Date.now());
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !spaces.isSuccess || spaces.isFetching || spaces.dataUpdatedAt < mountedAt.current) return;
    sent.current = true;
    trackHome(use, spacesBucket(listed));
  }, [spaces.isSuccess, spaces.isFetching, spaces.dataUpdatedAt, use, listed]);
}

/** Section 8.2: the re-trust notice, once. Read at mount; deleted once the home has drawn it (`ready`). */
export function useRetrustNotice(ready: boolean): boolean {
  const [notice, setNotice] = useState(false);
  useEffect(() => {
    let live = true;
    void readRetrustNotice().then((waiting) => {
      if (live && waiting) setNotice(true);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (notice && ready) void removeRecord(RETRUST_NOTICE_KEY).catch(() => undefined);
  }, [notice, ready]);
  return notice;
}

/** Try again: the network is read again (offline), and every account page shown now is read again. */
export function useRetryPages(recheck: () => void): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    recheck();
    void queryClient.refetchQueries({ queryKey: accountQueryKey(), type: 'active' });
  }, [recheck, queryClient]);
}

/**
 * Section 6.6: a home's Sign out, then where it lands: the Grown-up area when it is under the home, the Grown-up area in
 * the home's place (a chooser row), or Welcome on a device with no learner profile (by leaving the area).
 */
export function useHomeSignOut(navigation: AccountPageNavigation): { signingOut: boolean; signOutHere: () => void } {
  const signOut = useAccountSignOut();
  const [signingOut, setSigningOut] = useState(false);
  const signOutHere = (): void => {
    setSigningOut(true);
    void signOut('user')
      .catch(() => false)
      .then(() => {
        const landing = signOutLanding(navigation.getState().routes, useProfileStore.getState().profiles.length > 0);
        if (landing === 'area_below') navigation.navigate('ParentDashboard');
        else if (landing === 'area_here') navigation.replace('ParentDashboard');
        else (navigation.getParent<NativeStackNavigationProp<RootStackParamList>>() ?? navigation).goBack();
      });
  };
  return { signingOut, signOutHere };
}

/**
 * Section 8.2, OA-D20: Join on this device holds the code in memory and leaves the account like a `join` boot intent
 * (`joinHereTarget`); the session then closes (the learner screen it lands on asks the PIN for any grown-up surface
 * again). Nothing here joins anyone: Join and its consent step do (CS-N8). A class code keeps the one-learner flow.
 */
export function joinHere(navigation: AccountPageNavigation, code: string): void {
  const target = joinHereTarget(code, useProfileStore.getState().profiles.length > 0, flags.whoChooserEnabled && deviceShared());
  const root = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>() ?? (navigation as unknown as NativeStackNavigationProp<RootStackParamList>);
  if (target.screen === 'WhoIsUsing') {
    holdJoin(target.hold.code);
    root.navigate('WhoIsUsing', target.params);
  } else if (target.screen === 'JoinSpace') root.navigate('JoinSpace', target.params);
  else root.navigate('Onboarding', target.params);
  // After the navigation has applied, so the area is left from the learner screen, never asked for again in front.
  setTimeout(() => closeGrownUpSession('exit'), 0);
}
