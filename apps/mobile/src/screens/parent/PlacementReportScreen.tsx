import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Icon,
  KoreanText,
  Pill,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
} from '@hangul-route/design-system';
import { RUNG_TABLE, type PlacementStrand, type StageKey } from '@hangul-route/content-schema';
import { LOCALE_META, formatDate, type Messages } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { episodesAll, jamoAll, questsAll, stages } from '../../content';
import { PLACEMENT_BANK } from '../../content/placement.generated';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest, localizeStage } from '../../logic/content-locale';
import { isStageEntitled } from '../../logic/entitlement';
import { placementRouteCatalog } from '../../logic/placement/catalog';
import { bandLabel } from '../../logic/placement/copy';
import { overrideAppliedEvent } from '../../logic/placement/events';
import {
  bankLookup,
  reportPage,
  symbolText,
  type ReportPageView,
  type StartChoice,
  type StrandExample,
} from '../../logic/placement/report-page';
import type { ReportRung, ReportStrandStatus } from '../../logic/placement/result-view';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { LinkButton, RadioTile } from '../placement/parts';

/**
 * The grown-up report of the level check (F-PLC-001 section 3.9, wireframe
 * placement/report, W-8), behind the PIN gate. "What we saw" reads the newest
 * result: the five strands with a status word and a plain example of letters
 * (drawn with KoreanText), each step's growth count for Short and Standard or
 * status words for Deep ("checked twice", "not finished"), Spelling with tiles
 * found by bank lookup, and what was not tested and why. "Where the route
 * starts" reads the route in force, with a plain note when the account does
 * not include that stage (no price, no plan name, no purchase button) and
 * "Choose a different start" (the only action that moves the start earlier).
 * Retakes: "Take the check again" (the length is pre-selected by
 * `defaultMode`), the Short hint, and on a child profile the retake with the
 * sound guide hidden. Never a comparison with other learners.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'PlacementReport'>;
type ReportMessages = Messages['caregiver']['placementReport'];
type PillTone = NonNullable<React.ComponentProps<typeof Pill>['tone']>;

const CATALOG = placementRouteCatalog(questsAll, episodesAll);
const LOOKUP = bankLookup(PLACEMENT_BANK);
const STRAND_GATES = new Map<PlacementStrand, readonly ReportRung['gate'][]>();
for (const spec of RUNG_TABLE) STRAND_GATES.set(spec.strand, [...(STRAND_GATES.get(spec.strand) ?? []), spec.gate]);

const STATUS_TONE: Readonly<Record<ReportStrandStatus, PillTone>> = {
  secure: 'success',
  'getting-there': 'info',
  'not-yet': 'neutral',
  'not-tested': 'neutral',
  'not-tested-short': 'neutral',
};

function statusWord(m: ReportMessages, status: ReportStrandStatus): string {
  switch (status) {
    case 'secure':
      return m.status.secure;
    case 'getting-there':
      return m.status.gettingThere;
    case 'not-yet':
      return m.status.notYet;
    case 'not-tested':
      return m.status.notTested;
    case 'not-tested-short':
      return m.notTestedShort;
  }
}

/** One step's line: its name and form, then counts (Short, Standard), a Deep note, or the status word. */
function rungLine(m: ReportMessages, rung: ReportRung): string {
  const name = `${m.rung[rung.gate]}, ${m.form[rung.form]}`;
  const parts: string[] = [];
  if (rung.counts !== null) parts.push(rung.counts.map((c) => m.count(c.correct, c.asked)).join(', '));
  else parts.push(statusWord(m, rung.status));
  if (rung.note !== null) parts.push(m[rung.note]);
  return `${name}: ${parts.join(', ')}`;
}

export function PlacementReportScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId } = route.params;
  const messages = useMessages();
  const m = messages.caregiver.placementReport;
  const locale = useLocale();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  // The access tier (F-ENT-003 section 3.4) decides the start quest, as the level check itself does.
  const tier = useAccessTier(profileId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
  }, [profileId]);

  const page = useMemo(() => {
    const completed = new Set((snapshot?.quests ?? []).filter((q) => q.completedAt !== undefined).map((q) => q.questId));
    return reportPage({
      placements: snapshot?.placements ?? [],
      catalog: CATALOG,
      completedQuestIds: completed,
      isEntitled: (stage) => isStageEntitled(stage, tier),
      profileType: profile === null ? 'child' : effectiveLearnerType(profile),
      lookup: LOOKUP,
    });
  }, [snapshot, profile, tier]);

  const questTitle = (id: string): string => {
    const quest = questsAll.find((q) => q.id === id);
    return quest === undefined ? id : localizeQuest(quest, locale).titleEn;
  };
  const stageTitle = (key: StageKey): string => {
    const stage = stages.find((s) => s.key === key);
    return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
  };

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ParentDashboard');
  };

  /** A new check for this learner: it becomes the active profile (the check always runs for the active one). */
  const retake = (retakeMode?: 'standard' | 'deep'): void => {
    const profiles = useProfileStore.getState();
    if (profiles.activeId !== profileId) profiles.setActive(profileId);
    navigation.replace('Placement', { source: 'parent', ...(retakeMode === undefined ? {} : { retakeMode }) });
  };

  const saveStart = (questId: string): void => {
    if (page.kind !== 'report') return;
    if (useProgressStore.getState().applyPlacementOverride(profileId, page.resultId, questId)) {
      void track(overrideAppliedEvent(profileId));
      setSaved(true);
    }
    setSheetOpen(false);
  };

  return (
    <Screen
      tone="canvas"
      testID="placement-report"
      footer={
        <Button
          label={page.kind === 'report' ? m.takeAgain : m.takeFirst}
          tone="primary"
          size="lg"
          fullWidth
          onPress={() => retake()}
          testID="placement-report-retake"
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={messages.common.buttons.back}
          testID="placement-report-back"
          style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-left" size={spacing.xl} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {profile === null ? null : <Caption tone="muted">{profile.displayName}</Caption>}
          <Heading level="title">{m.title}</Heading>
        </View>
      </View>
      <Spacer size="md" />

      {page.kind === 'empty' ? (
        <Body testID="placement-report-empty">{m.noCheck}</Body>
      ) : (
        <ReportBody
          page={page}
          m={m}
          messages={messages}
          locale={locale}
          name={profile?.displayName ?? ''}
          saved={saved}
          questTitle={questTitle}
          stageTitle={stageTitle}
          onChooseStart={() => setSheetOpen(true)}
          onRetake={retake}
        />
      )}

      {page.kind === 'report' ? (
        <ChooseStartSheet
          visible={sheetOpen}
          choices={page.choices}
          m={m}
          messages={messages}
          questTitle={questTitle}
          onCancel={() => setSheetOpen(false)}
          onSave={saveStart}
        />
      ) : null}
    </Screen>
  );
}

interface ReportBodyProps {
  page: ReportPageView;
  m: ReportMessages;
  messages: Messages;
  locale: ReturnType<typeof useLocale>;
  name: string;
  saved: boolean;
  questTitle: (id: string) => string;
  stageTitle: (key: StageKey) => string;
  onChooseStart: () => void;
  onRetake: (mode?: 'standard' | 'deep') => void;
}

function ReportBody({ page, m, messages, locale, name, saved, questTitle, stageTitle, onChooseStart, onRetake }: ReportBodyProps): React.ReactElement {
  const { view } = page;
  return (
    <>
      <Body weight="semibold" size="lg" testID="placement-report-level">
        {`${stageTitle(page.level.stage)} · ${bandLabel(messages, page.level)}`}
      </Body>
      <Caption tone="muted">{m.takenOn(formatDate(locale, page.takenAt, 'monthDayYear'), LOCALE_META[page.testLocale].endonym)}</Caption>

      <Spacer size="lg" />
      <Card padding="md" testID="placement-report-saw">
        <Heading level="prompt">{m.whatWeSaw}</Heading>
        {view.strands.map(({ strand, status }) => {
          const rungs = view.rungs.filter((r) => (STRAND_GATES.get(strand) ?? []).includes(r.gate));
          const example = strand === 'sound-letter' || strand === 'syllable-reading' ? page.examples[strand] : undefined;
          return (
            <View
              key={strand}
              testID={`placement-report-strand-${strand}`}
              style={{ paddingVertical: spacing.sm, borderBottomWidth: borderWidth.thin, borderBottomColor: colors.border.subtle, gap: spacing.xs }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Body weight="semibold">{m.strand[strand]}</Body>
                <Pill label={statusWord(m, status)} tone={STATUS_TONE[status]} size="sm" />
              </View>
              {rungs.map((rung) => (
                <Caption key={`${rung.gate}:${rung.form}`} tone="secondary">
                  {rungLine(m, rung)}
                </Caption>
              ))}
              {example === undefined ? null : <ExampleRows example={example} m={m} messages={messages} />}
            </View>
          );
        })}
        {view.spellingTiles === null ? null : (
          <View
            testID="placement-report-tiles"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, flexWrap: 'wrap' }}
          >
            <Body weight="semibold">{m.spellingTiles}</Body>
            <Pill label={statusWord(m, view.spellingTiles)} tone={STATUS_TONE[view.spellingTiles]} size="sm" />
          </View>
        )}
        {view.shortNotTested ? (
          <>
            <Spacer size="sm" />
            <Body size="sm" tone="secondary">
              {m.shortNotTested}
            </Body>
          </>
        ) : null}
        {view.notTested.map((reason) => (
          <React.Fragment key={reason}>
            <Spacer size="sm" />
            <Body size="sm" tone="secondary" testID={`placement-report-not-tested-${reason}`}>
              {m.notTestedReason[reason]}
            </Body>
          </React.Fragment>
        ))}
        <Spacer size="sm" />
        <Caption tone="muted">{messages.caregiver.skillsNote}</Caption>
      </Card>

      <Spacer size="lg" />
      <Card padding="md" testID="placement-report-start">
        <Heading level="prompt">{m.whereStarts}</Heading>
        <Spacer size="sm" />
        {page.startQuestId === null ? (
          <Body testID="placement-report-no-start">
            {page.needsStage === null ? m.noStart(name) : m.needsStage(name, stages.findIndex((s) => s.key === page.needsStage) + 1)}
          </Body>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="pin" size={spacing.lg} color={colors.brand.primary} />
            <Body weight="semibold" testID="placement-report-start-quest">
              {questTitle(page.startQuestId)}
            </Body>
          </View>
        )}
        {page.overridden ? <Caption tone="muted">{m.changedByGrownUp}</Caption> : null}
        {saved ? (
          <Body size="sm" tone="secondary" testID="placement-report-saved">
            {m.saved}
          </Body>
        ) : null}
        {page.choices.length > 0 ? (
          <>
            <Spacer size="sm" />
            <Button label={m.chooseStart} tone="ghost" size="md" onPress={onChooseStart} testID="placement-report-choose" />
          </>
        ) : null}
      </Card>

      <Spacer size="md" />
      <Caption tone="muted" align="center">
        {m.onlyForward}
      </Caption>
      {page.shortHint ? (
        <View style={{ alignItems: 'center', marginTop: spacing.md }} testID="placement-report-short-hint">
          <Body align="center" tone="secondary">
            {m.shortHint}
          </Body>
          <LinkButton label={m.tryStandard} onPress={() => onRetake()} testID="placement-report-try-standard" />
        </View>
      ) : null}
      {page.retakeHidden === null ? null : (
        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <LinkButton
            label={m.retryHidden}
            onPress={() => onRetake(page.retakeHidden?.mode)}
            testID="placement-report-retry-hidden"
          />
        </View>
      )}
      <Spacer size="lg" />
    </>
  );
}

function ExampleRows({ example, m, messages }: { example: StrandExample; m: ReportMessages; messages: Messages }): React.ReactElement {
  const row = (label: string, keys: readonly string[], testID: string): React.ReactElement | null => {
    const letters = keys.flatMap((key) => {
      const text = symbolText(key, jamoAll);
      return text === undefined ? [] : [{ key, ...text }];
    });
    if (letters.length === 0) return null;
    return (
      <View testID={testID} style={{ gap: spacing.xs }}>
        <Caption tone="secondary">{label}</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {letters.map((letter) => (
            <KoreanText
              key={letter.key}
              ko={letter.ko}
              romanization={letter.romanization}
              size="sm"
              accessibilityLabel={messages.a11y.koreanItem({ ko: letter.ko, romanization: letter.romanization })}
            />
          ))}
        </View>
      </View>
    );
  };
  return (
    <>
      {row(m.examples.known, example.known, 'placement-report-known')}
      {row(m.examples.fresh, example.fresh, 'placement-report-new')}
    </>
  );
}

interface SheetProps {
  visible: boolean;
  choices: readonly StartChoice[];
  m: ReportMessages;
  messages: Messages;
  questTitle: (id: string) => string;
  onCancel: () => void;
  onSave: (questId: string) => void;
}

/** "Choose a different start": the learner's quests in order; everything before the pick is skipped. */
function ChooseStartSheet({ visible, choices, m, messages, questTitle, onCancel, onSave }: SheetProps): React.ReactElement {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayoutClass();
  const current = choices.find((c) => c.state === 'start')?.questId ?? null;
  const [picked, setPicked] = useState<string | null>(current);

  useEffect(() => {
    if (visible) setPicked(current);
  }, [visible, current]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.surface.overlay }}>
        <View
          accessibilityViewIsModal
          testID="placement-report-sheet"
          style={{
            width: '100%',
            maxWidth: layout.maxWidth.reading,
            maxHeight: window.height - insets.top,
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm }}>
            <Heading level="prompt">{m.sheet.title}</Heading>
            <Body size="sm" tone="secondary">
              {m.sheet.help}
            </Body>
            <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
              {choices.map((choice) => {
                const title = questTitle(choice.questId);
                const word = choice.state === 'ahead' ? null : m.sheet.state[choice.state];
                return (
                  <RadioTile
                    key={choice.questId}
                    selected={picked === choice.questId}
                    onPress={() => setPicked(choice.questId)}
                    accessibilityLabel={word === null ? title : `${title}, ${word}`}
                    testID={`placement-report-choice-${choice.questId}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Body weight="semibold">{title}</Body>
                      {word === null ? null : <Caption tone="muted">{word}</Caption>}
                    </View>
                  </RadioTile>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl + insets.bottom }}>
            <View style={{ flex: 1 }}>
              <Button label={messages.common.buttons.cancel} tone="ghost" size="lg" fullWidth onPress={onCancel} testID="placement-report-sheet-cancel" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={messages.common.buttons.save}
                tone="primary"
                size="lg"
                fullWidth
                disabled={picked === null || picked === current}
                onPress={() => {
                  if (picked !== null) onSave(picked);
                }}
                testID="placement-report-sheet-save"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
