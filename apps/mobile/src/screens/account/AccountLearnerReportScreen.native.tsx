import { Body, Screen, Spacer } from '@hangul-route/design-system';
import { CATALOG, type ReportPeriod, type StageKey } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Platform } from 'react-native';
import { jamoAll, questsAll, stages } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { reportBodyOf, type AccountReportBody } from '../../logic/account/account-data';
import { accountReportView } from '../../logic/account/account-report';
import { AccountLoadError, failureOf } from '../../logic/account/homes';
import { accountQueryKey } from '../../logic/account/queries';
import { localizeJamo, localizeQuest, localizeStage } from '../../logic/content-locale';
import type { GrownUpStackParamList } from '../../navigation/types';
import { ReportSkeleton, ReportView } from '../parent/report-blocks';
import { AccountButton } from './AccountButton';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { useAccountNetwork, useAccountSessionEnded } from './account-session.native';
import { StateBox, useAccountApi } from './home-parts.native';

/**
 * F-AUTH-004 sections 8.1, 8.7 and 8.8 (row NS-5; design `account-reports.md` boards 1 and 3, D14; CS-N5, CS-N8): one
 * learner's report on iOS and Android, `AccountLearnerReport { spaceId, learnerId, period }`, inside `AccountGate`,
 * opened by See report on a home. It reads `GET /api/spaces/:id/learners/:learnerId/report?period=` (the consented
 * roster projection the console reads, never the device's snapshot), and draws it through the in-app report's blocks
 * (`screens/parent/report-blocks.tsx`) with the period switch and the stepper of F-REPORT-001. Left out on native
 * (`accountReportView`): "Now on" and Open Learning Route, the free-end line, Preview lessons, line actions and the
 * skills rows; nothing on the page leads out of it. A period change reads again; a step reads the same answer.
 *
 * States (8.8): the report's skeleton while loading; offline, `home.offline` with Try again (it reloads by itself when
 * the network returns); an error while online, `report.state.error` with Try again; `401`, the records go and the
 * sign-in opens; `403 native_off`, `home.unavailable` with Back only. No telemetry of its own: the Worker records the
 * view (F-REPORT-001), and no id, name or period ever leaves in an event (section 15).
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountLearnerReport'>;
type ReportNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountLearnerReport'>;

export function AccountLearnerReportScreen({ navigation, route }: Props): ReactElement {
  const { spaceId, learnerId, period } = route.params;
  return (
    <AccountGate screen="home" use={undefined} navigation={navigation as unknown as AccountGateNavigation} routeKey={route.key}>
      <AccountLearnerReport spaceId={spaceId} learnerId={learnerId} initialPeriod={period} navigation={navigation} />
    </AccountGate>
  );
}

function AccountLearnerReport({ spaceId, learnerId, initialPeriod, navigation }: { spaceId: string; learnerId: string; initialPeriod: ReportPeriod; navigation: ReportNavigation }): ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const titles = useLessonTitlesVersion();
  const api = useAccountApi();
  const { online, recheck } = useAccountNetwork();
  const sessionEnded = useAccountSessionEnded();
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [at, setAt] = useState<string | null>(null);
  // The live region speaks only after the grown-up changed the period or stepped, never on open.
  const [changed, setChanged] = useState(false);

  const report = useQuery({
    queryKey: accountQueryKey('report', spaceId, learnerId, period),
    queryFn: async (): Promise<AccountReportBody> => {
      const result = await api.learnerReport(spaceId, learnerId, period);
      if (!result.ok) throw new AccountLoadError(result.error);
      const body = reportBodyOf(result.data);
      if (body === null) throw new AccountLoadError('error');
      return body;
    },
    enabled: online,
    retry: false,
    staleTime: 0,
    // A period change keeps the report on screen while the next one is read.
    placeholderData: (previous) => previous,
  });

  const view = useMemo(() => {
    if (report.data === undefined) return null;
    void titles;
    return accountReportView({
      body: report.data,
      period,
      at,
      now: new Date(),
      catalog: CATALOG,
      locale,
      messages,
      stageTitle: (key: StageKey) => {
        const stage = stages.find((s) => s.key === key);
        return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
      },
      questTitle: (id) => {
        const quest = questsAll.find((q) => q.id === id);
        return quest === undefined ? null : localizeQuest(quest, locale).titleEn;
      },
      letterInfo: (letter) => {
        const jamo = jamoAll.find((j) => j.char === letter && j.kind !== 'batchim');
        if (jamo === undefined) return null;
        const local = localizeJamo(jamo, locale);
        return { romanization: local.romanization, gloss: local.soundHint ?? null };
      },
      platform: Platform.OS,
    });
  }, [report.data, period, at, locale, messages, titles]);

  const failure = !online ? 'offline' : report.isError && !report.isFetching ? failureOf(report.error) : null;

  // `401`: the session ended elsewhere; the records go and the sign-in opens (its AccountGate decides it).
  const ending = useRef(false);
  useEffect(() => {
    if (failure !== 'unauthorized' || ending.current) return;
    ending.current = true;
    void sessionEnded()
      .catch(() => false)
      .then(() => navigation.replace('SignIn', {}));
  }, [failure, sessionEnded, navigation]);

  const retry = (): void => {
    recheck();
    if (online) void report.refetch();
  };
  let body: ReactElement;
  if (failure === 'offline' || failure === 'unavailable') body = <StateBox failure={failure} onRetry={retry} onBack={() => navigation.goBack()} testID="account-report-state" />;
  else if (failure === 'cant_load' || (report.data !== undefined && view === null)) {
    body = (
      <>
        <Body testID="learner-report-error">{messages.report.state.error}</Body>
        <Spacer size="md" />
        <AccountButton label={messages.common.buttons.tryAgain} tone="primary" onPress={retry} testID="learner-report-retry" />
      </>
    );
  } else if (view === null) body = <ReportSkeleton label={messages.a11y.report.loading} />;
  else {
    body = (
      <ReportView
        view={view}
        period={period}
        announce={changed ? view.announce : null}
        onChoosePeriod={(next) => {
          setPeriod(next);
          setAt(null);
          setChanged(true);
        }}
        onStep={(target) => {
          setAt(target);
          setChanged(true);
        }}
      />
    );
  }
  return (
    <Screen tone="canvas" scrollable testID="account-learner-report">
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}
