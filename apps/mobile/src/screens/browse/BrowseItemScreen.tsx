import { APP_ROUTES, type StageKey, type StoryLevel } from '@hangul-route/content-schema';
import { Body, Button, Card, Heading, Pill, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cardById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { episodeOfQuest } from '../../logic/browse/bundle';
import { itemFacts, type ItemFacts, type QuestFacts, type StoryFacts, type TopicFacts } from '../../logic/browse/facts';
import { accessOf, billingShown, itemViewedEvent, plansTappedEvent, stepsLine, whereLine } from '../../logic/browse/home-view';
import { BROWSE_REGISTERED_ROUTES, type BrowseStackParamList } from '../../navigation/browse';
import { leaveTo } from '../../platform/browse-env';
import { CardRow, HeaderBack, HeaderRow, KoChip, SkillChips, WordChip, focusRing, sendBrowseEvent, useItemViewed, type FocusState } from './browse-ui';
import { useBrowseSession } from './browse-session';
import { LessonDisplaySheet } from './LessonDisplaySheet';
import { BROWSE_ACTION_MAX_WIDTH, BROWSE_LABEL_COLUMN } from '../../logic/browse/layout';

/**
 * The item page (F-BROWSE-001 sections 4.2, 4.4 and 4.6; wireframe
 * `browse/item.md`; mock `design/screens/browse/item.md`), one template for a
 * lesson, a story and a word topic: the focus line when opened for a letter,
 * the title and kind, What this teaches, Where it sits with [ See on the
 * Journey ], the card it awards, and the primary action, pinned to the bottom
 * edge on phones. Closed (switch on, sampler pass only): the same facts, and
 * in place of the primary the grown-up line with [ Open billing ] for an
 * account pass that is not kept and not a fallback.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'BrowseItem'>;

const PRIMARY_MAX = BROWSE_ACTION_MAX_WIDTH;
const LABEL_COLUMN = BROWSE_LABEL_COLUMN;

export function BrowseItemScreen({ route, navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse;
  const locale = useLocale();
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const { kind, id, focusJamoId } = route.params;
  const facts = itemFacts({ kind, id, ...(focusJamoId !== undefined ? { focusJamoId } : {}) }, bundle, locale);
  const access = pass ? accessOf({ kind, id }, { bundle, scope: pass.scope, gatingEnabled }) : 'access';
  const [displayOpen, setDisplayOpen] = useState(false);
  const compact = useLayoutClass().width === 'compact';
  useItemViewed(facts && pass ? itemViewedEvent(kind, id, access) : null);

  // An id this build does not hold never shows an empty page: home says so (section 4.4).
  useEffect(() => {
    if (!facts) navigation.replace('BrowseHome', { note: 'not-in-version' });
  }, [facts, navigation]);
  if (!facts || !pass) return <Screen tone="canvas">{null}</Screen>;

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('BrowseHome', {});
  };
  const seeOnJourney = (stage: StageKey): void =>
    navigation.navigate('BrowseHome', { section: 'journey', stage });

  const closed = access === 'closed';
  const canPreview = facts.kind === 'quest' && BROWSE_REGISTERED_ROUTES.has('PreviewQuest');
  const previewQuest = (): void => {
    if (facts.kind !== 'quest') return;
    const episodeId = facts.where?.kind === 'episode' ? facts.where.episodeId : (episodeOfQuest(bundle, facts.id)?.id ?? '');
    navigation.navigate('PreviewQuest', { questId: facts.id, episodeId });
  };

  const action = closed ? (
    <View testID="browse-item-closed" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, alignItems: 'flex-start' }}>
      <Body weight="semibold">{m.item.closed}</Body>
      {billingShown(pass) ? (
        <Button
          label={m.item.openBilling.cta}
          tone="ghost"
          size="sm"
          onPress={() => {
            sendBrowseEvent(plansTappedEvent(kind));
            leaveTo(APP_ROUTES.billing);
          }}
          testID="browse-open-billing"
        />
      ) : null}
    </View>
  ) : canPreview ? (
    <View style={{ width: '100%', maxWidth: compact ? undefined : PRIMARY_MAX }}>
      <Button label={m.item.preview.cta} tone="primary" size="lg" fullWidth onPress={previewQuest} testID="browse-preview" />
    </View>
  ) : null;

  return (
    <Screen tone="canvas" scrollable width="reading" testID="browse-item" footer={compact && action && !closed ? action : undefined}>
      <HeaderRow back={<HeaderBack label={m.item.back} showLabel={false} onPress={back} testID="browse-back" />} onDisplay={() => setDisplayOpen(true)} />
      <Spacer size="sm" />
      {facts.kind === 'quest' && facts.focus ? (
        <>
          <View testID="browse-focus-line" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.md }}>
            <Body weight="semibold">{m.item.focus}</Body>
            <KoChip ko={facts.focus.char} romanization={facts.focus.romanization} />
          </View>
          <Spacer size="md" />
        </>
      ) : null}
      <ItemHeader facts={facts} />
      <Spacer size="lg" />
      <Heading level="prompt">{m.item.teaches}</Heading>
      <Spacer size="sm" />
      <Card padding="md">
        {facts.kind === 'quest' ? <QuestRows facts={facts} /> : null}
        {facts.kind === 'story' ? <StoryRows facts={facts} /> : null}
        {facts.kind === 'vocab-topic' ? <TopicRows facts={facts} /> : null}
      </Card>

      {facts.kind === 'quest' && facts.where ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.item.where.title}</Heading>
          <Spacer size="xs" />
          <WhereRow line={whereLine(facts.where, bundle.stages, bundle.themes, m, locale)} onSee={() => facts.where && seeOnJourney(facts.where.stage)} />
        </>
      ) : null}
      {facts.kind === 'story' ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.item.where.title}</Heading>
          <Spacer size="xs" />
          <WhereRow line={whereLine(facts.where, bundle.stages, bundle.themes, m, locale)} onSee={() => seeOnJourney(facts.where.stage)} />
        </>
      ) : null}

      {facts.kind === 'quest' && facts.rewardCardId && cardById(facts.rewardCardId) ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.item.card}</Heading>
          <Spacer size="xs" />
          <CardRow card={cardById(facts.rewardCardId) as NonNullable<ReturnType<typeof cardById>>} onPress={() => navigation.navigate('CardDetail', { cardId: facts.rewardCardId as string })} testID="browse-item-card" />
        </>
      ) : null}

      {action && (closed || !compact) ? (
        <>
          <Spacer size="xl" />
          {action}
        </>
      ) : null}
      <Spacer size="xl" />
      <LessonDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} />
    </Screen>
  );
}

function ItemHeader({ facts }: { facts: ItemFacts }): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const kindLabel = facts.kind === 'quest' ? m.item.kind.quest : facts.kind === 'story' ? m.item.kind.story : m.item.kind.vocabTopic;
  const title = facts.kind === 'story' ? facts.title.gloss : facts.title;
  return (
    <View style={{ gap: spacing.xs }}>
      <Heading level="title">{title}</Heading>
      {facts.kind === 'story' ? (
        <View style={{ flexDirection: 'row' }}>
          <KoChip ko={facts.title.ko} romanization={facts.title.romanization} />
        </View>
      ) : null}
      {facts.kind === 'vocab-topic' ? (
        <View style={{ flexDirection: 'row' }}>
          <KoChip ko={facts.titleKo.ko} romanization={facts.titleKo.romanization} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <Pill label={kindLabel} tone="info" size="sm" />
        <Body size="sm" weight="semibold">
          {facts.kind === 'vocab-topic' ? m.item.wordCount(facts.count) : m.minutes(facts.minutes)}
        </Body>
      </View>
    </View>
  );
}

/** One row of "What this teaches": the label above its value on phones, an 8rem label column from the regular class. */
function FactRow({ label, children, testID }: { label: string; children: React.ReactNode; testID?: string }): React.ReactElement {
  const compact = useLayoutClass().width === 'compact';
  return (
    <View testID={testID} style={{ flexDirection: compact ? 'column' : 'row', gap: compact ? spacing.xs : spacing.md, paddingVertical: spacing.sm }}>
      <View style={compact ? undefined : { width: LABEL_COLUMN }}>
        <Text style={{ fontSize: typography.size.bodySm, fontWeight: typography.weight.bold, color: colors.text.secondary }}>{label}</Text>
      </View>
      <View style={{ flex: compact ? undefined : 1 }}>{children}</View>
    </View>
  );
}

function Chips({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>{children}</View>;
}

function QuestRows({ facts }: { facts: QuestFacts }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse;
  return (
    <View>
      {facts.letters.length > 0 ? (
        <FactRow label={m.facts.letters} testID="browse-facts-letters">
          <Chips>
            {facts.letters.map((l) => {
              const marked = facts.focus?.jamoId === l.jamoId;
              return (
                <KoChip
                  key={l.jamoId}
                  ko={l.char}
                  romanization={l.romanization}
                  marked={marked}
                  testID={marked ? 'browse-focus-chip' : undefined}
                  {...(marked ? { accessibilityLabel: m.item.focusChipA11y(l.char, l.romanization) } : {})}
                />
              );
            })}
          </Chips>
        </FactRow>
      ) : null}
      {facts.words.length > 0 ? (
        <FactRow label={m.facts.words} testID="browse-facts-words">
          <Chips>
            {facts.words.map((w) => (
              <WordChip key={w.ko} ko={w.ko} romanization={w.romanization} gloss={w.gloss} />
            ))}
          </Chips>
        </FactRow>
      ) : null}
      {facts.syllables.length > 0 ? (
        <FactRow label={m.facts.syllables} testID="browse-facts-syllables">
          <Chips>
            {facts.syllables.map((s) => (
              <KoChip key={s.ko} ko={s.ko} romanization={s.romanization} />
            ))}
          </Chips>
        </FactRow>
      ) : null}
      {facts.skills.length > 0 ? (
        <FactRow label={m.facts.skills} testID="browse-facts-skills">
          <SkillChips skills={facts.skills} />
        </FactRow>
      ) : null}
      <FactRow label={m.facts.steps} testID="browse-facts-steps">
        <Body>{stepsLine(facts.steps, messages.learner.quest.step)}</Body>
      </FactRow>
    </View>
  );
}

const LEVEL_KEY: Readonly<Record<StoryLevel, 'listen' | 'readAlong' | 'read'>> = { listen: 'listen', 'read-along': 'readAlong', read: 'read' };

function StoryRows({ facts }: { facts: StoryFacts }): React.ReactElement {
  const m = useMessages().caregiver.browse;
  const [level, setLevel] = useState<StoryLevel>(facts.defaultLevel);
  const scenes = facts.levels.find((l) => l.level === level)?.scenes ?? 0;
  return (
    <View>
      <FactRow label={m.facts.levels}>
        <View role="radiogroup" aria-label={m.facts.levelGroup} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {facts.levels.map((l) => {
            const selected = l.level === level;
            return (
              <Pressable
                key={l.level}
                role="radio"
                aria-checked={selected}
                accessibilityState={{ checked: selected }}
                onPress={() => setLevel(l.level)}
                style={({ focused }: FocusState) => ({
                  minHeight: touchTarget.min,
                  minWidth: touchTarget.min,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.lg,
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
                  ...focusRing(focused, selected ? colors.brand.primary : colors.border.strong),
                  borderWidth: focused ? borderWidth.thick : borderWidth.base,
                })}
              >
                <Text style={{ fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: selected ? colors.text.onPrimary : colors.text.primary }}>{m.facts.level[LEVEL_KEY[l.level]]}</Text>
              </Pressable>
            );
          })}
        </View>
      </FactRow>
      <FactRow label={m.facts.scenes}>
        <Body>{String(scenes)}</Body>
      </FactRow>
      {facts.keywords.length > 0 ? (
        <FactRow label={m.facts.keywords}>
          <Chips>
            {facts.keywords.map((w) => (
              <WordChip key={w.ko} ko={w.ko} romanization={w.romanization} gloss={w.gloss} />
            ))}
          </Chips>
        </FactRow>
      ) : null}
    </View>
  );
}

function TopicRows({ facts }: { facts: TopicFacts }): React.ReactElement {
  const m = useMessages().caregiver.browse;
  return (
    <FactRow label={m.facts.words} testID="browse-facts-words">
      <View style={{ gap: spacing.sm }}>
        {facts.words.map((w) => (
          <WordChip key={w.id} ko={w.ko} romanization={w.romanization} gloss={w.gloss} />
        ))}
      </View>
    </FactRow>
  );
}

function WhereRow({ line, onSee }: { line: string; onSee: () => void }): React.ReactElement {
  const m = useMessages().caregiver.browse;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
      <Body weight="semibold" testID="browse-where">
        {line}
      </Body>
      <Button label={m.item.where.see.cta} tone="ghost" size="sm" onPress={onSee} testID="browse-see-journey" />
    </View>
  );
}
