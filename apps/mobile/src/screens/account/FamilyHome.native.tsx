import { Body, Heading, Screen, Spacer, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import type { GrownUpUse } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { flags } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { planCardsOf, rosterOf, spaceItemsOf, type AccountRoster, type AccountSpaceItem } from '../../logic/account/account-data';
import type { AccountApi } from '../../logic/account/api';
import {
  AccountLoadError,
  codePanelOf,
  failureOf,
  familiesOf,
  learnerCards,
  routesAfterEndedSession,
  signOutLanding,
  spacesBucket,
  worstFailure,
  type LoadFailure,
} from '../../logic/account/homes';
import { joinHereTarget } from '../../logic/account/join-here';
import { nativePlanLines } from '../../logic/account/plan-lines';
import { accountQueryKey } from '../../logic/account/queries';
import { DEVICE_USES_RECORD_KEY, deviceUsesRecord, keepsRecords, trustOfRead, usesOfSpaces, RETRUST_NOTICE_KEY } from '../../logic/account/sign-in-records';
import type { GrownUpStackParamList, RootStackParamList } from '../../navigation/types';
import { readRetrustNotice, readTrust, removeRecord, writeDeviceUses } from '../../platform/account-records';
import { useAccountVisit } from '../../store/account-visit';
import { closeGrownUpSession } from '../../store/grown-up-session';
import { nativeGateState } from '../../store/native-gate-state';
import { useProfileStore } from '../../store/profile-store';
import { deviceShared, holdJoin } from '../../store/who-chooser';
import { AccountButton } from './AccountButton';
import { trackHome, useAccountNetwork, useAccountSessionEnded, useAccountSignOut } from './account-session.native';
import { CodePanel, HomeEnd, HomeSkeleton, InfoStrip, PlanBlock, StateBox, useAccountApi } from './home-parts.native';

/**
 * F-AUTH-004 sections 8.2, 8.5, 8.6, 8.8 and 15 (row NS-5; design `homes.md` boards 1 to 7 and 15 to 19,
 * `plan-block.html`, D9 to D11, D18; CS-N5, CS-N8; anti-shame): the Family home on iOS and Android, the open content of
 * `AccountHome { use: 'family' | 'account' }` inside `AccountGate`.
 *
 * - **Reads** (online only, ND-10; in memory under `['account', …]`, cleared with the session, CS-N4):
 *   `GET /api/spaces`, one roster per family, and the plan status (`?view=status`, a fact only, 8.5). Each successful
 *   spaces read rewrites the uses record on a PIN device (section 8.1).
 * - **Families** (owner or caregiver), live then archived, each oldest first; learners in join order, never by
 *   activity (`logic/account/homes.ts`). Per learner: the name, the last-active line, the minutes line, See report.
 * - **The code panel** (owner only; none on an archived family): the code with Copy and Join on this device, or Make a
 *   code; anyone else reads `askOwner`.
 * - **States** (8.8): loading, offline (reloads by itself when the network returns), an error while online, `401`
 *   (the records go and the sign-in opens), `403 native_off` (Back only), one family refused (its section only).
 * - The re-trust notice once at the top (8.2); the quiet line and Sign out at the end (8.6, D18).
 * - `auth.native.home { os, use, spaces }` once per mount, after the first successful load (section 15).
 */

export type HomeNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountHome'>;

/** A read that throws why it failed (`AccountLoadError`), so the screen can tell offline, `401` and the switch apart. */
async function read<T>(call: () => ReturnType<AccountApi['spaces']>, parse: (data: unknown) => T | null): Promise<T> {
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

/** The home's form of the cached spaces answer (module level, so a render never parses again for nothing). */
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

/** Every account page is read fresh when shown, and never retried by itself (8.8: Try again, or the network's return). */
const ONLINE_PAGE = { retry: false, staleTime: 0 } as const;

export function FamilyHome({ use, navigation, routeKey }: { use: Extract<GrownUpUse, 'family'> | 'account'; navigation: HomeNavigation; routeKey: string }): ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const api = useAccountApi();
  const { online, recheck } = useAccountNetwork();
  const queryClient = useQueryClient();
  const sessionEnded = useAccountSessionEnded();
  const signOut = useAccountSignOut();
  const m = messages.caregiver.account;
  const title = use === 'account' ? m.card.title : messages.learner.who.use.family;

  // The cache holds the Worker's answer as it came (`{ spaces: [...] }`), the shape the sign-in stores under the same key
  // and the account card and the gate read (`usesOfSpaces`); the home reads its own form through `select`.
  const spaces = useQuery({
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
  const families = spaces.data === undefined ? [] : familiesOf(spaces.data);
  const rosters = useQueries({
    queries: families.map((family) => ({
      queryKey: accountQueryKey('roster', family.space.id),
      queryFn: () => read(() => api.roster(family.space.id), rosterOf),
      enabled: online,
      ...ONLINE_PAGE,
    })),
  });
  // The plan block is a fact beside the home: a status read that fails shows no block, and fails nothing else.
  const plans = useQuery({ queryKey: accountQueryKey('plan'), queryFn: () => read(() => api.planStatus(), planCardsOf), enabled: online, ...ONLINE_PAGE });

  // Section 8.8: what the whole screen draws when a read failed. One family's refusal is its own section's.
  const rosterFailures = rosters.flatMap((roster) => (roster.isError ? [failureOf(roster.error)] : []));
  const screenFailure: LoadFailure | null = !online
    ? 'offline'
    : worstFailure([
        ...(spaces.isError ? [failureOf(spaces.error)] : []),
        // A family's own refusal stays in its section; a session that ended, the switch, or a network that dropped
        // during the read is the whole screen's (8.8).
        ...rosterFailures.filter((failure) => failure !== 'cant_load'),
        ...(plans.isError && failureOf(plans.error) !== 'cant_load' ? [failureOf(plans.error)] : []),
      ]);

  // `401`: the session ended elsewhere. The records go, then the sign-in opens (its AccountGate decides it).
  const ending = useRef(false);
  useEffect(() => {
    if (screenFailure !== 'unauthorized' || ending.current) return;
    ending.current = true;
    const key = routeKey;
    void sessionEnded()
      .catch(() => false)
      .then(() => {
        // As the report does: the run of account routes gives way to one sign-in (a report's own 401 may have run first).
        navigation.dispatch((state) => {
          const routes = [...routesAfterEndedSession(state.routes, key), { key: `SignIn-${key}`, name: 'SignIn' as const, params: { use } }];
          return { type: 'RESET', payload: { ...state, routes, index: routes.length - 1 } } as never;
        });
      });
  }, [screenFailure, sessionEnded, navigation, use, routeKey]);

  // `auth.native.home` once per mount, after the first successful spaces read of this mount (section 15).
  const mountedAt = useRef(Date.now());
  const homeSent = useRef(false);
  useEffect(() => {
    if (homeSent.current || !spaces.isSuccess || spaces.isFetching || spaces.dataUpdatedAt < mountedAt.current) return;
    homeSent.current = true;
    trackHome(use, spacesBucket(families.length));
  }, [spaces.isSuccess, spaces.isFetching, spaces.dataUpdatedAt, use, families.length]);

  // Section 8.2: the re-trust notice, once. Read at mount; deleted once the home has drawn it.
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
  const ready = screenFailure === null && spaces.data !== undefined;
  useEffect(() => {
    if (notice && ready) void removeRecord(RETRUST_NOTICE_KEY).catch(() => undefined);
  }, [notice, ready]);

  // Try again: the network is read again (offline), and every account page shown now is read again.
  const retry = (): void => {
    recheck();
    void queryClient.refetchQueries({ queryKey: accountQueryKey(), type: 'active' });
  };

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

  /**
   * Section 8.2, OA-D20: Join on this device holds the code in memory and leaves the account like a `join` boot intent
   * (`joinHereTarget`); the session then closes (the learner screen it lands on asks the PIN for any grown-up surface
   * again). Nothing here joins anyone: Join and its consent step do (CS-N8).
   */
  const joinHere = (code: string): void => {
    const target = joinHereTarget(code, useProfileStore.getState().profiles.length > 0, flags.whoChooserEnabled && deviceShared());
    const root = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>() ?? (navigation as unknown as NativeStackNavigationProp<RootStackParamList>);
    if (target.screen === 'WhoIsUsing') {
      holdJoin(target.hold.code);
      root.navigate('WhoIsUsing', target.params);
    } else if (target.screen === 'JoinSpace') root.navigate('JoinSpace', target.params);
    else root.navigate('Onboarding', target.params);
    // After the navigation has applied, so the area is left from the learner screen, never asked for again in front.
    setTimeout(() => closeGrownUpSession('exit'), 0);
  };

  const body = ((): ReactElement => {
    if (screenFailure === 'unauthorized') return <HomeSkeleton />;
    if (screenFailure !== null) return <StateBox failure={screenFailure} onRetry={retry} onBack={() => navigation.goBack()} />;
    if (spaces.data === undefined) return <HomeSkeleton />;
    return (
      <View style={{ gap: spacing.lg }}>
        {notice ? <InfoStrip text={m.home.retrustNotice} testID="account-home-retrust" /> : null}
        {families.length === 0 ? (
          <Body testID="account-home-no-family">{m.home.noFamily}</Body>
        ) : (
          families.map((family, k) => {
            const roster = rosters[k];
            const card = plans.data?.get(family.space.id);
            return (
              <FamilySection
                key={family.space.id}
                family={family}
                roster={roster?.data ?? null}
                rosterState={roster === undefined || roster.isPending ? 'loading' : roster.isError ? 'refused' : 'ready'}
                onRetryRoster={() => void roster?.refetch()}
                plan={card === undefined ? null : nativePlanLines(card, messages.console.billing)}
                navigation={navigation}
                onJoinHere={joinHere}
                api={api}
                locale={locale}
                use={use}
              />
            );
          })
        )}
        <HomeEnd onSignOut={signOutHere} working={signingOut} />
      </View>
    );
  })();

  return (
    <Screen tone="canvas" scrollable header={{ title }} testID="account-home-family">
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}

interface FamilySectionProps {
  family: AccountSpaceItem;
  roster: AccountRoster | null;
  rosterState: 'loading' | 'refused' | 'ready';
  onRetryRoster: () => void;
  plan: ReturnType<typeof nativePlanLines> | null;
  navigation: HomeNavigation;
  onJoinHere: (code: string) => void;
  api: AccountApi;
  locale: ReturnType<typeof useLocale>;
  use: 'family' | 'account';
}

/** One family (board 1): its name as a heading, its learners, its code panel and its plan block. */
function FamilySection({ family, roster, rosterState, onRetryRoster, plan, navigation, onJoinHere, api, locale, use }: FamilySectionProps): ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.account;
  const archived = family.space.archivedAt !== null;
  const id = family.space.id;
  const panel = codePanelOf(family, roster);
  return (
    <View testID={`account-family-${id}`} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm }}>
        <Heading level="prompt">{family.space.name}</Heading>
        {archived ? (
          <Body tone="secondary" testID={`account-family-${id}-archived`}>
            {messages.console.home.archived}
          </Body>
        ) : null}
      </View>
      {rosterState === 'loading' ? <HomeSkeleton testID={`account-family-${id}-loading`} /> : null}
      {rosterState === 'refused' ? (
        <View testID={`account-family-${id}-refused`} style={{ gap: spacing.sm }}>
          <Body>{m.home.cantLoad}</Body>
          <AccountButton label={messages.common.buttons.tryAgain} tone="paper" onPress={onRetryRoster} testID={`account-family-${id}-try-again`} />
        </View>
      ) : null}
      {rosterState === 'ready' && roster !== null ? (
        <>
          {roster.learners.length === 0 ? <Body testID={`account-family-${id}-empty`}>{messages.console.parentHome.empty.title}</Body> : <LearnerCards familyId={id} roster={roster} navigation={navigation} locale={locale} use={use} />}
          <CodeSlot familyId={id} panel={panel} onJoinHere={onJoinHere} api={api} />
        </>
      ) : null}
      {plan !== null ? <PlanBlock lines={plan} testID={`account-family-${id}-plan`} /> : null}
    </View>
  );
}

/** The learner cards (D10): join order; one column on a phone, two across from 18rem (`acc-card-min`). */
const CARD_MIN = 288;

function LearnerCards({ familyId, roster, navigation, locale, use }: { familyId: string; roster: AccountRoster; navigation: HomeNavigation; locale: ReturnType<typeof useLocale>; use: 'family' | 'account' }): ReactElement {
  const messages = useMessages();
  const cards = learnerCards(roster, new Date(), locale, messages);
  return (
    <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {cards.map((card) => (
        <View
          key={card.id}
          testID={`account-learner-${card.id}`}
          style={{ flexGrow: 1, flexBasis: CARD_MIN, backgroundColor: colors.surface.paper, borderRadius: radii.lg, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, padding: spacing.lg, gap: spacing.xs }}
        >
          <Body size="lg" weight="bold">
            {card.name}
          </Body>
          <Body size="sm" tone="secondary">
            {card.lastActive}
          </Body>
          {card.minutes !== null ? (
            <Body size="sm" tone="secondary">
              {card.minutes}
            </Body>
          ) : null}
          <Spacer size="xs" />
          <AccountButton
            label={messages.console.parentHome.child.seeReport}
            tone="paper"
            fullWidth
            onPress={() => navigation.navigate('AccountLearnerReport', { spaceId: familyId, learnerId: card.id, period: 'week', use })}
            testID={`account-learner-${card.id}-report`}
          />
        </View>
      ))}
    </View>
  );
}

/** The code panel, Make a code (owner, no live code: `POST /api/spaces/:id/code`, then the panel), or `askOwner`. */
function CodeSlot({ familyId, panel, onJoinHere, api }: { familyId: string; panel: ReturnType<typeof codePanelOf>; onJoinHere: (code: string) => void; api: AccountApi }): ReactElement | null {
  const messages = useMessages();
  const m = messages.caregiver.account;
  const queryClient = useQueryClient();
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  if (panel.kind === 'none') return null;
  if (panel.kind === 'ask') {
    return (
      <Body tone="secondary" testID={`account-family-${familyId}-ask-owner`}>
        {messages.console.parentHome.askOwner}
      </Body>
    );
  }
  if (panel.kind === 'code') return <CodePanel label={m.home.codeLabel.family} code={panel.code} onJoinHere={() => onJoinHere(panel.code)} testID={`account-family-${familyId}-code`} />;
  const make = async (): Promise<void> => {
    setMaking(true);
    setFailed(false);
    const result = await api.makeCode(familyId);
    if (!live.current) return;
    setMaking(false);
    if (!result.ok) {
      setFailed(true);
      // VoiceOver reads no live region (the strip is one on Android).
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(m.home.cantLoad);
      return;
    }
    // The new code comes back with the space's next reads (the spaces item and the roster carry it).
    await queryClient.refetchQueries({ queryKey: accountQueryKey('spaces'), type: 'active' });
    await queryClient.refetchQueries({ queryKey: accountQueryKey('roster', familyId), type: 'active' });
  };
  return (
    <View testID={`account-family-${familyId}-make`} style={{ backgroundColor: colors.surface.paper, borderRadius: radii.lg, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, padding: spacing.lg, gap: spacing.md }}>
      <Body size="sm" weight="bold" tone="secondary">
        {m.home.codeLabel.family}
      </Body>
      {/* No string of its own: the write that failed reads as the home's cantLoad line (a write, but the same fact). */}
      {failed ? <InfoStrip text={m.home.cantLoad} testID={`account-family-${familyId}-make-failed`} /> : null}
      <AccountButton label={messages.console.confirm.issueCode} tone="paper" busy={making} onPress={() => void make()} testID={`account-family-${familyId}-make-code`} />
    </View>
  );
}
