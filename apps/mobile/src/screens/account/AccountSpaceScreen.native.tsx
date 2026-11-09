import { Body, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { rosterOf } from '../../logic/account/account-data';
import { failureOf, worstFailure, type LoadFailure } from '../../logic/account/homes';
import { nativePlanLines } from '../../logic/account/plan-lines';
import { accountQueryKey } from '../../logic/account/queries';
import { classCodeOf, classLearners } from '../../logic/account/teacher-home';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountButton } from './AccountButton';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { useAccountNetwork } from './account-session.native';
import { CodePanel, HomeSkeleton, PlanBlock, StateBox, useAccountApi } from './home-parts.native';
import { ONLINE_PAGE, joinHere, readOrThrow, useAccountPlans, useEndedSession, useRetryPages, type AccountPageNavigation } from './home-data.native';
import { knownSpaceName } from './space-names.native';

/**
 * F-AUTH-004 sections 8.1, 8.3, 8.5 and 8.8 (row NS-6; design `homes.md` boards 12 and 13, D13; CS-N8; anti-shame): a
 * class page on iOS and Android, `AccountSpace { spaceId }`, inside `AccountGate`, opened from a class row of the
 * Teacher home or of a school page. Titled with the class's name (D13).
 *
 * - **Class report** at the top (D13: on a phone a teacher enters the class first), opening the class report on the
 *   week.
 * - The roster's learners in the order they joined (never by activity, section 8.1), each with **See report**.
 * - The class code panel only when the roster carries `joinCode` (the Worker sends it with `space.manage`, while live):
 *   Copy and **Join on this device** (a class code keeps the one-learner flow, OA-D14, OA-D20); otherwise no panel and
 *   no line (board 13): Make a code stays in the console.
 * - The plan block when a status card exists for the space (8.5: a fact, never an action).
 * - **States** (8.8): loading; offline (reloads by itself); an error while online, and a `403` or `404` on this class,
 *   `home.cantLoad` with Try again; `401`, the records go and the sign-in opens; `403 native_off`, Back only. No home end
 *   (the quiet line and Sign out are the homes', D18).
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountSpace'>;
type SpaceNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountSpace'>;

export function AccountSpaceScreen({ navigation, route }: Props): ReactElement {
  const { spaceId, use } = route.params;
  return (
    <AccountGate screen="home" use={use} navigation={navigation as unknown as AccountGateNavigation} routeKey={route.key}>
      <AccountSpace spaceId={spaceId} use={use} routeKey={route.key} navigation={navigation} />
    </AccountGate>
  );
}

function AccountSpace({ spaceId, use, routeKey, navigation }: { spaceId: string; use: Props['route']['params']['use']; routeKey: string; navigation: SpaceNavigation }): ReactElement {
  const messages = useMessages();
  const api = useAccountApi();
  const queryClient = useQueryClient();
  const { online, recheck } = useAccountNetwork();
  const page = navigation as unknown as AccountPageNavigation;
  const m = messages.caregiver.account;

  const roster = useQuery({ queryKey: accountQueryKey('roster', spaceId), queryFn: () => readOrThrow(() => api.roster(spaceId), rosterOf), enabled: online, ...ONLINE_PAGE });
  const plans = useAccountPlans(api, online);
  const failure: LoadFailure | null = !online
    ? 'offline'
    : worstFailure([...(roster.isError ? [failureOf(roster.error)] : []), ...(plans.isError && failureOf(plans.error) !== 'cant_load' ? [failureOf(plans.error)] : [])]);
  useEndedSession(failure, page, routeKey, use);
  const retry = useRetryPages(recheck);

  const data = roster.data;
  // D13: titled with the space's name; before the roster answers, the name a list already read (the home, a school page).
  const title = data?.space?.name ?? knownSpaceName(queryClient, spaceId) ?? '';
  const isClass = (data?.space?.kind ?? 'class') === 'class';

  const body = ((): ReactElement => {
    if (failure === 'unauthorized') return <HomeSkeleton />;
    if (failure !== null) return <StateBox failure={failure} onRetry={retry} onBack={() => navigation.goBack()} testID="account-space-state" />;
    if (data === undefined) return <HomeSkeleton />;
    const learners = classLearners(data);
    const code = classCodeOf(data);
    const card = plans.data?.get(spaceId);
    return (
      <View style={{ gap: spacing.lg }}>
        {isClass ? (
          <AccountButton
            label={messages.console.home.classReport}
            tone="paper"
            onPress={() => navigation.navigate('AccountClassReport', { spaceId, period: 'week', ...(use === undefined ? {} : { use }) })}
            testID="account-space-class-report"
          />
        ) : null}
        {learners.length === 0 ? (
          <Body testID="account-space-empty">{messages.console.parentHome.empty.title}</Body>
        ) : (
          <View accessibilityRole="list" testID="account-space-roster" style={{ backgroundColor: colors.surface.paper, borderRadius: radii.lg, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, paddingHorizontal: spacing.md }}>
            {learners.map((learner, k) => (
              <View
                key={learner.id}
                testID={`account-space-learner-${learner.id}`}
                style={{ minHeight: touchTarget.min, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md, rowGap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: k === 0 ? 0 : borderWidth.thin, borderTopColor: colors.border.subtle }}
              >
                <Body weight="semibold" style={{ flexShrink: 1 }}>
                  {learner.name}
                </Body>
                <AccountButton
                  label={messages.console.parentHome.child.seeReport}
                  tone="paper"
                  onPress={() => navigation.navigate('AccountLearnerReport', { spaceId, learnerId: learner.id, period: 'week', ...(use === undefined ? {} : { use }) })}
                  testID={`account-space-learner-${learner.id}-report`}
                />
              </View>
            ))}
          </View>
        )}
        {code !== null ? <CodePanel label={isClass ? m.home.codeLabel.class : m.home.codeLabel.family} code={code} onJoinHere={() => joinHere(page, code)} testID="account-space-code" /> : null}
        {card !== undefined ? <PlanBlock lines={nativePlanLines(card, messages.console.billing)} testID="account-space-plan" /> : null}
      </View>
    );
  })();

  return (
    <Screen tone="canvas" scrollable header={{ title }} testID="account-space">
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}
