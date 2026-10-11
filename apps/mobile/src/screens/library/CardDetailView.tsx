import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HeritageCardArt,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  supportedCardIds,
} from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlipCard } from '../../components/FlipCard';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { cardById, episodesAll, questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { cardEarnHint } from '../../logic/card-earn';
import { localizeCard, localizeTitle } from '../../logic/content-locale';
import { isStageEntitled } from '../../logic/entitlement';
import { nextFace, type FlipFace } from '../../logic/flip';
import { playPrompt, stop } from '../../platform/audio';
import { isShareAvailable, shareSnapshot } from '../../platform/sharing';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';

export interface CardDetailViewProps {
  cardId: string;
  /** Renders the close button when given (the modal screen passes it; a split pane does not). */
  onClose?: () => void;
  /** A locked card says how it is earned (the Library pane, F-LAYOUT-001 §3.6); the stack screen leaves it out. */
  showHowToEarn?: boolean;
}

export function CardDetailView({ cardId, onClose, showHowToEarn = false }: CardDetailViewProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.cardDetail;
  const locale = useLocale();
  const source = cardById(cardId);
  const card = source && localizeCard(source, locale);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const unlocked = snap?.cards.some((c) => c.cardId === cardId) ?? false;
  const [face, setFace] = useState<FlipFace>('front');
  const [shareAvailable, setShareAvailable] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const captureRef = useRef<View>(null);
  // The Korean name is printed on the card; the panel only says why it is silent (F-AUDIO-004 A-5b).
  const slot = usePromptSlot({ source: 'card-detail', textOnScreen: true });
  const [helpOpen, setHelpOpen] = useState(false);
  // Closing the card (Back, or another card in the split pane, which remounts it by key) stops a word mid-way.
  useEffect(() => () => stop(), []);

  useEffect(() => {
    let cancelled = false;
    void isShareAvailable().then((ok) => {
      if (!cancelled) setShareAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // F-MOTION-002 flip (components/FlipCard.tsx); Share is gated mid-flip (F-CARD-003 §8).
  const [isFlipping, setIsFlipping] = useState(false);
  const canFlip = unlocked;
  // A card that stops being flippable (the active profile changed while it showed its back) returns to its front.
  useEffect(() => {
    if (!canFlip) setFace('front');
  }, [canFlip]);

  if (!card) {
    return (
      <Screen>
        <Body>{m.notFound}</Body>
      </Screen>
    );
  }

  const flip = (): void => setFace((current) => nextFace(current));

  // `audioRef` joins the card schema with F-CNT-002 / F-VOC (spec §3.9); until then the device voice says the name.
  const hear = (): void => {
    const ko = card.subtitleKo;
    if (ko) void slot.play(() => playPrompt({ text: ko, kind: 'word', source: 'card-detail' }));
  };

  return (
    <Screen tone="canvas">
      {onClose ? (
        <>
          <Pressable
            onPress={onClose}
            hitSlop={spacing.md}
            style={{ alignSelf: 'flex-start' }}
          >
            <Icon name="close" size={28} />
          </Pressable>
          <Spacer size="lg" />
        </>
      ) : null}

      <View ref={captureRef} collapsable={false}>
        <FlipCard
          face={face}
          onFlip={flip}
          disabled={!canFlip}
          onFlippingChange={setIsFlipping}
          accessibilityLabelFront={canFlip ? messages.a11y.flipToBack : messages.a11y.lockedCard}
          accessibilityLabelBack={canFlip ? messages.a11y.flipToFront : messages.a11y.lockedCard}
          front={
            <CardShell card={card} rarityLabel={messages.learner.library.rarity[card.rarity]} flipHint={canFlip ? m.flip.front : null}>
              <FrontFaceBody card={card} unlocked={unlocked} />
            </CardShell>
          }
          back={
            <CardShell card={card} rarityLabel={messages.learner.library.rarity[card.rarity]} flipHint={canFlip ? m.flip.back : null}>
              <BackFaceBody card={card} />
            </CardShell>
          }
        />
      </View>

      {showHowToEarn && !unlocked ? <HowToEarn cardId={card.id} /> : null}

      {/* The blurb + fact card is shown only on the front face (the back face
          already contains this content). Keeps the back face from duplicating. */}
      {face === 'front' && unlocked ? (
        <>
          <Spacer size="lg" />
          <Card padding="md">
            <Body size="lg">{card.blurbEn}</Body>
            {card.factEn ? (
              <>
                <Spacer size="sm" />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
                  <Icon name="sparkle" size={16} color={colors.text.muted} />
                  <Body tone="secondary" size="sm" style={{ flex: 1 }}>
                    {card.factEn}
                  </Body>
                </View>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {card.subtitleKo && unlocked ? (
        <>
          <Spacer size="lg" />
          <Button
            label={m.hear.cta}
            tone="secondary"
            size="lg"
            onPress={hear}
            testID="card-detail-hear"
          />
          <Spacer size="sm" />
          <PromptPanel
            variant="status"
            view={slot.view}
            onAction={(action) => slot.act(action, hear)}
            onHelp={() => setHelpOpen(true)}
          />
          <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
      ) : null}

      {/* F-CARD-003 — Share button. Shown only when card is unlocked AND
          OS sharing is available. */}
      {unlocked && shareAvailable ? (
        <>
          <Spacer size="sm" />
          <Button
            label={m.share.cta}
            tone="ghost"
            size="md"
            accessibilityLabel={messages.a11y.shareCard}
            disabled={isFlipping}
            leading={<Icon name="card" size={18} color={colors.brand.primary} />}
            onPress={async () => {
              setShareError(null);
              const slug = card.id.replace('card:', '');
              const res = await shareSnapshot({
                viewRef: captureRef,
                filename: `hangul-route-${slug}`,
                format: 'png',
              });
              if (!res.ok && res.reason === 'capture-failed') {
                setShareError(m.share.error);
              }
            }}
          />
          {shareError ? (
            <>
              <Spacer size="sm" />
              {/* F-CARD-003 §3.4 — quiet Hoya bubble, button stays tappable for retry. */}
              <HoyaBubble tone="thinking" message={shareError} />
            </>
          ) : null}
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}

/** The card frame both faces share: the rarity border, the rarity pill and the flip hint (none on a locked card). */
function CardShell({
  card,
  rarityLabel,
  flipHint,
  children,
}: {
  card: HeritageCard;
  rarityLabel: string;
  flipHint: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  const rarityTone =
    card.rarity === 'legendary'
      ? 'nudge'
      : card.rarity === 'rare'
        ? 'info'
        : card.rarity === 'uncommon'
          ? 'success'
          : 'neutral';
  return (
    <Card padding="lg" tone="paper" style={{ borderWidth: 4, borderColor: colors.rarity[card.rarity], borderRadius: radii.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Pill tone={rarityTone} label={rarityLabel} />
        {flipHint ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
              backgroundColor: colors.surface.sunken,
              borderRadius: radii.pill,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xxs,
            }}
          >
            <Icon name="replay" size={14} color={colors.text.muted} />
            <Caption tone="muted">{flipHint}</Caption>
          </View>
        ) : null}
      </View>
      <Spacer size="md" />
      {children}
    </Card>
  );
}

/** Where a locked card is earned: the quest and the stars it takes, or "later" (no paywall, no Premium pill; D5). */
function HowToEarn({ cardId }: { cardId: string }): React.ReactElement {
  const m = useMessages().learner.cardDetail.earn;
  const profile = useProfileStore(activeProfileSelector);
  const cachedTier = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  void cachedTier; // re-render when the inbox changes the tier
  const tier = effectiveTier(profile?.id ?? '', new Date()).tier;
  // Only quests the learner can open: a card awarded in a stage they cannot play reads "later".
  const locale = useLocale();
  const earned = cardEarnHint(cardId, questsAll, episodesAll, (stage) => isStageEntitled(stage, tier));
  // The quest title in the UI language (F-I18N-001 §3.6).
  const hint =
    earned.kind === 'quest'
      ? { ...earned, questTitle: localizeTitle({ titleEn: earned.questTitle }, earned.questId, locale).titleEn }
      : earned;
  return (
    <>
      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.title}</Heading>
        <Spacer size="xs" />
        <Body tone="secondary">{hint.kind === 'quest' ? m.quest(hint.questTitle, hint.minStars) : m.later}</Body>
      </Card>
    </>
  );
}

function FrontFaceBody({
  card,
  unlocked,
}: {
  card: HeritageCard;
  unlocked: boolean;
}): React.ReactElement {
  const a11y = useMessages().a11y;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 200,
          height: 200,
          borderRadius: radii.xxl,
          backgroundColor: unlocked
            ? supportedCardIds.includes(card.id)
              ? colors.surface.paper
              : colors.theme[card.theme]
            : colors.surface.sunken,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: unlocked ? (supportedCardIds.includes(card.id) ? 1 : 0.85) : 0.4,
          overflow: 'hidden',
        }}
      >
        {unlocked ? (
          supportedCardIds.includes(card.id) ? (
            <HeritageCardArt cardId={card.id} size={200} accessibilityLabel={a11y.cardArt(card.titleEn)} />
          ) : (
            <Text style={{ fontSize: 80, fontWeight: '800', color: colors.text.primary }}>
              {card.subtitleKo ?? card.titleEn.charAt(0)}
            </Text>
          )
        ) : (
          <Icon name="lock" size={80} color={colors.text.muted} />
        )}
      </View>
      <Spacer size="lg" />
      <Heading level="display" align="center">
        {card.titleEn}
      </Heading>
      {card.subtitleKo ? (
        <>
          <Spacer size="xs" />
          <Heading level="title" tone="brand">
            {card.subtitleKo}
          </Heading>
        </>
      ) : null}
      {card.romanization ? (
        <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
          {card.romanization}
        </Caption>
      ) : null}
    </View>
  );
}

function BackFaceBody({ card }: { card: HeritageCard }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      {/* Top 40% — Korean prominent + romanization */}
      {card.subtitleKo ? (
        <Heading level="display" tone="brand" align="center" weight="bold">
          {card.subtitleKo}
        </Heading>
      ) : null}
      {card.romanization ? (
        <>
          <Spacer size="xs" />
          <Body tone="muted" size="sm" align="center" style={{ fontStyle: 'italic' }}>
            {card.romanization}
          </Body>
        </>
      ) : null}

      <Spacer size="lg" />

      {/* Middle 30% — English title + blurb */}
      <Heading level="title" align="center">
        {card.titleEn}
      </Heading>
      <Spacer size="sm" />
      <Body size="md" align="center">
        {card.blurbEn}
      </Body>

      {/* Bottom 30% — fun fact with a sparkle icon */}
      {card.factEn ? (
        <>
          <Spacer size="lg" />
          <View
            style={{
              backgroundColor: colors.surface.sunken,
              borderRadius: radii.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              alignSelf: 'stretch',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.xs }}>
              <Icon name="sparkle" size={16} color={colors.text.muted} />
              <Body tone="secondary" size="sm" align="center" style={{ fontStyle: 'italic', flexShrink: 1 }}>
                {card.factEn}
              </Body>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
