import { APP_ROUTES, type StageKey, type StoryLevel } from '@hangul-route/content-schema';
import { Body, Button, Card, Heading, Pill, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { cardById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { episodeOfQuest } from '../../logic/browse/bundle';
import { itemFacts, type ItemFacts, type QuestFacts, type StoryFacts } from '../../logic/browse/facts';
import { accessOf, billingShown, itemViewedEvent, plansTappedEvent, stepsLine, whereLine } from '../../logic/browse/home-view';
import { presentDeck, presentHref, presentItemShown, presentPlacement, type PresentSlot } from '../../logic/browse/present';
import { storyPreviewParams } from '../../logic/browse/preview';
import { topicHearShown } from '../../logic/browse/topic-view';
import { BROWSE_REGISTERED_ROUTES, type BrowseStackParamList } from '../../navigation/browse';
import { lectureBundle } from '../../logic/lecture/content';
import { leaveTo } from '../../platform/browse-env';
import { openPresenter, presenterRootExists } from '../../platform/present-handoff';
import { CardRow, HeaderBack, HeaderRow, KoChip, SkillChips, WordChip, focusRing, sendBrowseEvent, useItemViewed, type FocusState } from './browse-ui';
import { useBrowseSession } from './browse-session';
import { LessonDisplaySheet } from './LessonDisplaySheet';
import { BROWSE_ACTION_MAX_WIDTH, BROWSE_LABEL_COLUMN } from '../../logic/browse/layout';
import { beginPreview } from './preview-session';
import { TopicWordList } from './TopicWordList';

/**
 * The item page (F-BROWSE-001 sections 4.2, 4.4 and 4.6; wireframe
 * `browse/item.md`; mock `design/screens/browse/item.md`), one template for a
 * lesson, a story and a word topic: the focus line when opened for a letter,
 * the title and kind, What this teaches, Where it sits with [ See on the
 * Journey ], the card it awards, and the primary action, pinned to the bottom
 * edge on phones. Closed (switch on, sampler pass only): the same facts, and
 * in place of the primary the grown-up line with [ Open billing ] for an
 * account pass that is not kept and not a fallback. Under the primary, with
 * a full pass, [ Present this ] opens the item as a one-block deck in the
 * presenter (BR-13, OD-9; `design/screens/presenter/present-this.md`).
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
  // The story level the preview opens at (section 4.7): the lowest unless the grown-up picks another.
  const [level, setLevel] = useState<StoryLevel | null>(null);
  // The same mounted page can get new params (Next story to a closed story): the pick belongs to one story.
  useEffect(() => setLevel(null), [kind, id]);
  // The browser gave no new tab for the last Present this (a pop-up blocker): one line says what to do.
  const [presentBlocked, setPresentBlocked] = useState(false);
  useEffect(() => setPresentBlocked(false), [kind, id]);
  const compact = useLayoutClass().width === 'compact';
  const windowHeight = useWindowDimensions().height;
  const presentTitleText = facts ? (facts.kind === 'story' ? facts.title.gloss : facts.title) : '';
  // Drawn only when the presenter can show at least one slide of this item (BR-13): a check deck, never opened.
  const hasFacts = facts !== null;
  const scope = pass?.scope ?? null;
  const presentShown = useMemo(
    () =>
      presentItemShown({
        item: hasFacts ? { kind, id, title: presentTitleText } : null,
        scope,
        access,
        presenterRoot: presenterRootExists(),
        uiLocale: locale,
        bundle: lectureBundle(locale),
      }),
    [hasFacts, scope, access, kind, id, presentTitleText, locale],
  );
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
  const canPreview = (facts.kind === 'quest' && BROWSE_REGISTERED_ROUTES.has('PreviewQuest')) || (facts.kind === 'story' && BROWSE_REGISTERED_ROUTES.has('StoryReader'));
  const storyLevel = facts.kind === 'story' ? (level ?? facts.defaultLevel) : null;
  const playQuest = (questId: string): void => {
    const episodeId = facts.kind === 'quest' && facts.where?.kind === 'episode' ? facts.where.episodeId : (episodeOfQuest(bundle, questId)?.id ?? '');
    beginPreview('quest', questId);
    // A story's questions come back to the story page (section 4.7), not to the quest's own page.
    navigation.navigate('PreviewQuest', { questId, episodeId, ...(facts.kind === 'story' ? { returnTo: { kind: 'story' as const, id: facts.id } } : {}) });
  };
  const previewItem = (): void => {
    if (facts.kind === 'quest') playQuest(facts.id);
    if (facts.kind === 'story' && storyLevel) {
      beginPreview('story', facts.id);
      navigation.navigate('StoryReader', storyPreviewParams(facts.id, storyLevel));
    }
  };

  const presentItem = (): void => {
    // A fresh deck per press: its own id, clock and quiz seed, no names (numbers picker).
    const deck = presentDeck({ kind, id, title: presentTitleText }, { now: new Date(), rng: Math.random, uiLocale: locale });
    if (deck) setPresentBlocked(!openPresenter(presentHref(deck)));
  };
  const presentButton = (
    <View>
      <Button
        label={m.item.present.cta}
        accessibilityHint={m.item.presentNote}
        tone="ghost"
        size="lg"
        fullWidth
        onPress={presentItem}
        testID="browse-present"
      />
      <View role="status" aria-live="polite" accessibilityLiveRegion="polite">
        {presentBlocked ? (
          <Body size="sm" tone="secondary" testID="browse-present-blocked">
            {m.item.presentBlocked}
          </Body>
        ) : null}
      </View>
    </View>
  );

  const actionBar = (slot: PresentSlot | 'closed' | null): React.ReactElement | null =>
    slot === 'closed' ? (
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
  ) : slot ? (
    // The gap sits only between the buttons a group draws, so a group without the preview starts with its first button.
    <View style={{ width: '100%', maxWidth: compact ? undefined : PRIMARY_MAX, gap: spacing.sm }}>
      {slot.preview ? (
        <Button label={facts.kind === 'story' ? m.item.previewStory.cta : m.item.preview.cta} tone="primary" size="lg" fullWidth onPress={previewItem} testID="browse-preview" />
      ) : null}
      {slot.main && facts.kind === 'story' && BROWSE_REGISTERED_ROUTES.has('PreviewQuest') ? (
        <Button label={m.item.previewQuestions.cta} tone="ghost" size="md" fullWidth onPress={() => playQuest(facts.questId)} testID="browse-preview-questions" />
      ) : null}
      {slot.present ? presentButton : null}
    </View>
  ) : null;

  // On a short phone window (landscape) the pinned footer keeps only the preview; Present this
  // moves to the end of the page, so the facts keep their room (review of #590).
  const placement = presentPlacement({ compact, closed, canPreview, presentShown, windowHeight });
  const footerAction = actionBar(placement.footer);
  const inlineAction = actionBar(placement.inline);

  return (
    <Screen tone="canvas" scrollable width="reading" testID="browse-item" footer={footerAction ?? undefined}>
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
        {facts.kind === 'story' && storyLevel ? (
          <StoryRows facts={facts} level={storyLevel} onLevel={setLevel} onSources={() => navigation.navigate('StorySources', { storyId: facts.id, from: 'episode' })} />
        ) : null}
        {facts.kind === 'vocab-topic' ? <TopicWordList words={facts.words} hear={topicHearShown(access)} /> : null}
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

      {inlineAction ? (
        <>
          <Spacer size="xl" />
          {inlineAction}
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

function StoryRows({
  facts,
  level,
  onLevel: setLevel,
  onSources,
}: {
  facts: StoryFacts;
  level: StoryLevel;
  onLevel: (level: StoryLevel) => void;
  /** [ See the sources ]: the sources page, copy-only links (section 4.7). */
  onSources: () => void;
}): React.ReactElement {
  const m = useMessages().caregiver.browse;
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
      {BROWSE_REGISTERED_ROUTES.has('StorySources') ? (
        <FactRow label={m.facts.sources}>
          <View style={{ flexDirection: 'row' }}>
            <Button label={m.facts.seeSources.cta} tone="ghost" size="sm" onPress={onSources} testID="browse-see-sources" />
          </View>
        </FactRow>
      ) : null}
    </View>
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
