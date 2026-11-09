import { Body, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { schoolPageOf } from '../../logic/account/account-data';
import { failureOf, worstFailure, type LoadFailure } from '../../logic/account/homes';
import { nativePlanLines } from '../../logic/account/plan-lines';
import { accountQueryKey } from '../../logic/account/queries';
import { schoolClassesOf } from '../../logic/account/teacher-home';
import type { GrownUpStackParamList } from '../../navigation/types';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { useAccountNetwork } from './account-session.native';
import { HomeSkeleton, PlanBlock, StateBox, useAccountApi } from './home-parts.native';
import { ONLINE_PAGE, readOrThrow, useAccountPlans, useEndedSession, useRetryPages, type AccountPageNavigation } from './home-data.native';
import { knownSpaceName, useRefusedClasses } from './space-names.native';
import { ClassRow, GroupHeading, RowGrid } from './teacher-parts.native';

/**
 * F-AUTH-004 sections 8.1, 8.4, 8.5 and 8.8 (row NS-6; design `homes.md` board 14, D13; anti-shame): a school page on
 * iOS and Android, `AccountSchool { spaceId }`, inside `AccountGate`, for the school's owner and admins (the Teacher
 * home links only their rows; the Worker answers anyone else 403). Titled with the school's name (D13).
 *
 * - **Reads**: `GET /api/spaces/:id/school`, of which only the school's name, its classes (name, learner count) and its
 *   teacher count are kept (`schoolPageOf`: never a teacher's name, the licence, its seats or dates, or the invite), and
 *   the plan status.
 * - **Classes** (`console.kind.group.class`), live then archived, each oldest first: a row opens the class page, with
 *   **Class report** under it; a class whose page was refused this session (`403`, `404`) reads `home.cantLoad` as
 *   plain text, with no link and no button.
 * - `home.teachers(n)`, then the plan block (its usage line only when the status card carries `usage`, section 8.4).
 * - **States** (8.8) as the class page's; no home end (D18).
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountSchool'>;
type SchoolNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountSchool'>;

export function AccountSchoolScreen({ navigation, route }: Props): ReactElement {
  const { spaceId, use } = route.params;
  return (
    <AccountGate screen="home" use={use} navigation={navigation as unknown as AccountGateNavigation} routeKey={route.key}>
      <AccountSchool spaceId={spaceId} use={use} routeKey={route.key} navigation={navigation} />
    </AccountGate>
  );
}

function AccountSchool({ spaceId, use, routeKey, navigation }: { spaceId: string; use: Props['route']['params']['use']; routeKey: string; navigation: SchoolNavigation }): ReactElement {
  const messages = useMessages();
  const api = useAccountApi();
  const queryClient = useQueryClient();
  const { online, recheck } = useAccountNetwork();
  const page = navigation as unknown as AccountPageNavigation;
  const c = messages.console;

  const school = useQuery({ queryKey: accountQueryKey('school', spaceId), queryFn: () => readOrThrow(() => api.school(spaceId), schoolPageOf), enabled: online, ...ONLINE_PAGE });
  const plans = useAccountPlans(api, online);
  const failure: LoadFailure | null = !online
    ? 'offline'
    : worstFailure([...(school.isError ? [failureOf(school.error)] : []), ...(plans.isError && failureOf(plans.error) !== 'cant_load' ? [failureOf(plans.error)] : [])]);
  useEndedSession(failure, page, routeKey, use);
  const retry = useRetryPages(recheck);

  const data = school.data;
  const classes = data === undefined ? [] : schoolClassesOf(data);
  const refused = useRefusedClasses(
    queryClient,
    classes.map((row) => row.space.id),
  );
  const title = data?.school.name ?? knownSpaceName(queryClient, spaceId) ?? '';
  const withUse = use === undefined ? {} : { use };

  const body = ((): ReactElement => {
    if (failure === 'unauthorized') return <HomeSkeleton />;
    if (failure !== null) return <StateBox failure={failure} onRetry={retry} onBack={() => navigation.goBack()} testID="account-school-state" />;
    if (data === undefined) return <HomeSkeleton />;
    const card = plans.data?.get(spaceId);
    return (
      <View style={{ gap: spacing.lg }}>
        {classes.length > 0 ? (
          <View style={{ gap: spacing.sm }} testID="account-school-classes">
            <GroupHeading>{c.kind.group.class}</GroupHeading>
            <RowGrid>
              {classes.map((row) => {
                const id = row.space.id;
                const no = refused.has(id);
                return (
                  <ClassRow
                    key={id}
                    id={id}
                    name={row.space.name}
                    archivedWord={row.space.archivedAt === null ? null : c.home.archived}
                    count={c.spaceCounts.students(row.students)}
                    attention={null}
                    onOpen={no ? null : () => navigation.navigate('AccountSpace', { spaceId: id, ...withUse })}
                    refused={no ? messages.caregiver.account.home.cantLoad : null}
                    report={no ? null : { label: c.home.classReport, onPress: () => navigation.navigate('AccountClassReport', { spaceId: id, period: 'week', ...withUse }) }}
                    testID={`account-school-class-${id}`}
                  />
                );
              })}
            </RowGrid>
          </View>
        ) : null}
        {data.teachers !== null ? <Body testID="account-school-teachers">{messages.caregiver.account.home.teachers(data.teachers)}</Body> : null}
        {card !== undefined ? <PlanBlock lines={nativePlanLines(card, messages.console.billing)} testID="account-school-plan" /> : null}
      </View>
    );
  })();

  return (
    <Screen tone="canvas" scrollable header={{ title }} testID="account-school">
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}
