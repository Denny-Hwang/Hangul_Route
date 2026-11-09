import { Body, Heading, Screen, Spacer, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import type { GrownUpUse } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { rosterOf, type AccountRoster, type AccountSpaceItem } from '../../logic/account/account-data';
import type { AccountApi } from '../../logic/account/api';
import { codePanelOf, failureOf, familiesOf, learnerCards, worstFailure, type LoadFailure } from '../../logic/account/homes';
import { nativePlanLines } from '../../logic/account/plan-lines';
import { accountQueryKey } from '../../logic/account/queries';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountButton } from './AccountButton';
import { useAccountNetwork } from './account-session.native';
import { CodePanel, HomeEnd, HomeSkeleton, InfoStrip, PlanBlock, StateBox, useAccountApi } from './home-parts.native';
import {
  ONLINE_PAGE,
  joinHere,
  readOrThrow,
  useAccountPlans,
  useAccountSpaces,
  useEndedSession,
  useHomeEvent,
  useHomeSignOut,
  useRetryPages,
  useRetrustNotice,
  type AccountPageNavigation,
} from './home-data.native';

/**
 * F-AUTH-004 sections 8.2, 8.5, 8.6, 8.8 and 15 (row NS-5; design `homes.md` boards 1 to 7 and 15 to 19,
 * `plan-block.html`, D9 to D11, D18; CS-N5, CS-N8; anti-shame): the Family home on iOS and Android, the open content of
 * `AccountHome { use: 'family' | 'account' }` inside `AccountGate`.
 *
 * - **Reads** (online only, ND-10; in memory under `['account', …]`, cleared with the session, CS-N4):
 *   `GET /api/spaces`, one roster per family, and the plan status (`?view=status`, a fact only, 8.5). Each successful
 *   spaces read rewrites the uses record on a PIN device (section 8.1). Row NS-6 moved the reads, the `401`, the event,
 *   the notice, Sign out and Join on this device into `home-data.native.ts`, which the Teacher home shares.
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

export function FamilyHome({ use, navigation, routeKey }: { use: Extract<GrownUpUse, 'family'> | 'account'; navigation: HomeNavigation; routeKey: string }): ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const api = useAccountApi();
  const { online, recheck } = useAccountNetwork();
  const page = navigation as unknown as AccountPageNavigation;
  const m = messages.caregiver.account;
  const title = use === 'account' ? m.card.title : messages.learner.who.use.family;

  const spaces = useAccountSpaces(api, online);
  const families = spaces.data === undefined ? [] : familiesOf(spaces.data);
  const rosters = useQueries({
    queries: families.map((family) => ({
      queryKey: accountQueryKey('roster', family.space.id),
      queryFn: () => readOrThrow(() => api.roster(family.space.id), rosterOf),
      enabled: online,
      ...ONLINE_PAGE,
    })),
  });
  const plans = useAccountPlans(api, online);

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
  useEndedSession(screenFailure, page, routeKey, use);
  useHomeEvent(spaces, use, families.length);
  const ready = screenFailure === null && spaces.data !== undefined;
  const notice = useRetrustNotice(ready);
  const retry = useRetryPages(recheck);
  const { signingOut, signOutHere } = useHomeSignOut(page);

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
                onJoinHere={(code) => joinHere(page, code)}
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
