import { Body, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, type ReactElement } from 'react';
import { Platform, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { failureOf, worstFailure, type LoadFailure } from '../../logic/account/homes';
import { attentionOf, opensSchool, teacherHomeView } from '../../logic/account/teacher-home';
import type { GrownUpStackParamList } from '../../navigation/types';
import { focusForScreenReader } from '../../platform/screen-reader';
import { useAccountNetwork } from './account-session.native';
import { HomeEnd, HomeSkeleton, InfoStrip, StateBox, useAccountApi } from './home-parts.native';
import { useAccountSpaces, useEndedSession, useHomeEvent, useHomeSignOut, useRetryPages, useRetrustNotice, type AccountPageNavigation } from './home-data.native';
import { ClassRow, GroupHeading, RowGrid, SchoolRow } from './teacher-parts.native';

/**
 * F-AUTH-004 sections 8.3, 8.4, 8.6, 8.8 and 15 (row NS-6; design `homes.md` boards 8 to 11 and 15 to 18, D13, D18;
 * anti-shame): the Teacher home on iOS and Android, the open content of `AccountHome { use: 'teacher' | 'school' }`
 * inside `AccountGate`. The School use is this page, titled School, with the screen reader's focus on its first school
 * row (the native form of the console's `focus=school`).
 *
 * - **Reads** (online only, ND-10): `GET /api/spaces` only (no roster read per class: the count is the item's), in
 *   memory under `['account', 'spaces']`, cleared with the session (CS-N4); each successful read rewrites the uses
 *   record on a PIN device (section 8.1, `home-data.native.ts`).
 * - **Classes** (owner or teacher), live then archived, each oldest first: the row's top opens the class page, **Class
 *   report** under it opens the class report on the week; the attention line is plain text with no action.
 * - **Schools** (owner, admin or teacher): owner and admin open the school page; a teacher member's row is plain text.
 * - **States** (8.8): loading, offline (reloads by itself), an error while online, `401` (the records go and the
 *   sign-in opens), `403 native_off` (Back only). The re-trust notice once at the top (8.2); `noSchool` above the page
 *   for the School use on an account with no school; `noClass` with no class and no school; the quiet line and Sign
 *   out at the end (8.6, D18). `auth.native.home { os, use, spaces }` once per mount (section 15).
 */

export type TeacherHomeNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountHome'>;

export function TeacherHome({ use, navigation, routeKey }: { use: 'teacher' | 'school'; navigation: TeacherHomeNavigation; routeKey: string }): ReactElement {
  const messages = useMessages();
  const api = useAccountApi();
  const { online, recheck } = useAccountNetwork();
  const page = navigation as unknown as AccountPageNavigation;
  const m = messages.caregiver.account;
  const c = messages.console;

  const spaces = useAccountSpaces(api, online);
  const view = spaces.data === undefined ? null : teacherHomeView(spaces.data, use);
  const screenFailure: LoadFailure | null = !online ? 'offline' : worstFailure(spaces.isError ? [failureOf(spaces.error)] : []);

  useEndedSession(screenFailure, page, routeKey, use);
  useHomeEvent(spaces, use, view === null ? 0 : view.classes.length + view.schools.length);
  const ready = screenFailure === null && view !== null;
  const notice = useRetrustNotice(ready);
  const retry = useRetryPages(recheck);
  const { signingOut, signOutHere } = useHomeSignOut(page);

  // Section 8.4: the School use moves the screen reader's focus to the first school row, once, when it is drawn.
  const focusRow = useRef<View>(null);
  const focused = useRef(false);
  const focusId = ready ? view.focusId : null;
  useEffect(() => {
    if (focusId === null || focused.current || Platform.OS === 'web') return;
    focused.current = true;
    focusForScreenReader(focusRow.current);
  }, [focusId]);

  const body = ((): ReactElement => {
    if (screenFailure === 'unauthorized') return <HomeSkeleton />;
    if (screenFailure !== null) return <StateBox failure={screenFailure} onRetry={retry} onBack={() => navigation.goBack()} />;
    if (view === null) return <HomeSkeleton />;
    return (
      <View style={{ gap: spacing.lg }}>
        {notice ? <InfoStrip text={m.home.retrustNotice} testID="account-home-retrust" /> : null}
        {view.noSchool ? <InfoStrip text={m.home.noSchool} testID="account-home-no-school" /> : null}
        {view.noClass ? <Body testID="account-home-no-class">{m.home.noClass}</Body> : null}
        {view.classes.length > 0 ? (
          <View style={{ gap: spacing.sm }} testID="account-home-classes">
            <GroupHeading>{c.kind.group.class}</GroupHeading>
            <RowGrid>
              {view.classes.map((item) => {
                const id = item.space.id;
                const waiting = attentionOf(item);
                return (
                  <ClassRow
                    key={id}
                    id={id}
                    name={item.space.name}
                    archivedWord={item.space.archivedAt === null ? null : c.home.archived}
                    count={c.spaceCounts.students(item.counts.learners)}
                    attention={waiting === null ? null : c.home.attention(waiting)}
                    onOpen={() => navigation.navigate('AccountSpace', { spaceId: id, use })}
                    refused={null}
                    report={{ label: c.home.classReport, onPress: () => navigation.navigate('AccountClassReport', { spaceId: id, period: 'week', use }) }}
                    testID={`account-class-${id}`}
                  />
                );
              })}
            </RowGrid>
          </View>
        ) : null}
        {view.schools.length > 0 ? (
          <View style={{ gap: spacing.sm }} testID="account-home-schools">
            <GroupHeading>{c.kind.group.school}</GroupHeading>
            <RowGrid>
              {view.schools.map((item) => {
                const id = item.space.id;
                return (
                  <SchoolRow
                    key={id}
                    name={item.space.name}
                    archivedWord={item.space.archivedAt === null ? null : c.home.archived}
                    onOpen={opensSchool(item) ? () => navigation.navigate('AccountSchool', { spaceId: id, use }) : null}
                    focusRef={id === view.focusId ? focusRow : undefined}
                    testID={`account-school-${id}`}
                  />
                );
              })}
            </RowGrid>
          </View>
        ) : null}
        <HomeEnd onSignOut={signOutHere} working={signingOut} />
      </View>
    );
  })();

  return (
    <Screen tone="canvas" scrollable header={{ title: messages.learner.who.use[use] }} testID={`account-home-${use}`}>
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}
