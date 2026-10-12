import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { FlipCard } from '../../components/FlipCard';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { cardById } from '../../content';
import { awardWorld } from '../../content/award-world';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { earnHint } from '../../logic/awards/earn-hint';
import { cardDetailDisplay, type CardDetailState } from '../../logic/library/card-detail-state';
import { localizeCard, localizeEpisode } from '../../logic/content-locale';
import { nextFace, type FlipFace } from '../../logic/flip';
import { playPrompt, stop } from '../../platform/audio';
import { isShareAvailable, shareSnapshot } from '../../platform/sharing';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

/** Side of the card face on the front of the card page. */
const CARD_FACE = 200;

export interface CardDetailViewProps {
  cardId: string;
  /** Renders the close button when given (the modal screen passes it; a split pane does not). */
  onClose?: () => void;
  /** A locked card says how it is earned (F-LAYOUT-001 §3.6, F-STORY-006 §3.7): the Library pane and the stack screen pass it. */
  showHowToEarn?: boolean;
  /**
   * `learner` (default): today's card for the active profile. `preview` (All lessons, F-BROWSE-001 §4.7):
   * front and back as an earned card looks, no earn hint, no share action, no progress-store read.
   */
  state?: CardDetailState;
}

export function CardDetailView({ cardId, onClose, showHowToEarn = false, state = 'learner' }: CardDetailViewProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.cardDetail;
  const locale = useLocale();
  const source = cardById(cardId);
  const card = source && localizeCard(source, locale);
  const profile = useProfileStore(activeProfileSelector);
  // A preview reads no learner's cards: it shows every card as an earned one.
  const snap = useProgressStore((s) => (state === 'preview' || !profile ? undefined : s.byProfile[profile.id]));
  const earned = snap?.cards.some((c) => c.cardId === cardId) ?? false;
  // How a locked card is earned, from its award rule, with the episode title in the UI language (F-STORY-006 §3.7).
  const hint = useMemo(() => {
    if (!source) return null;
    const world = { ...awardWorld, episodes: awardWorld.episodes.map((e) => localizeEpisode(e, locale)) };
    return earnHint(source, world, messages.learner.library.earnHint)?.text ?? null;
  }, [source, locale, messages]);
  const lockedLabel = hint ? messages.a11y.lockedCardHint(hint) : messages.a11y.lockedCard;
  const [face, setFace] = useState<FlipFace>('front');
  const [shareAvailable, setShareAvailable] = useState(false);
  const display = cardDetailDisplay({ state, earned, showHowToEarn, shareAvailable });
  const unlocked = display.faceUp;
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
          accessibilityLabelFront={canFlip ? messages.a11y.flipToBack : lockedLabel}
          accessibilityLabelBack={canFlip ? messages.a11y.flipToFront : lockedLabel}
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

      {display.howToEarn ? <HowToEarn hint={hint} /> : null}

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
          OS sharing is available; never in a preview. */}
      {display.share ? (
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

/**
 * How a locked card is earned (wireframe library/earn-hints F2): the earn hint of its award rule
 * (F-STORY-006 §3.7), or "later" for a rule this build cannot explain. Never how far along; no
 * paywall, no Premium pill (D5).
 */
function HowToEarn({ hint }: { hint: string | null }): React.ReactElement {
  const m = useMessages().learner.cardDetail.earn;
  return (
    <>
      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.title}</Heading>
        <Spacer size="xs" />
        <Body tone="secondary">{hint ?? m.later}</Body>
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
      {unlocked ? (
        <CardArt card={card} size={CARD_FACE} accessibilityLabel={a11y.cardArt(card.titleEn)} style={{ borderRadius: radii.xxl }} />
      ) : (
        <View
          style={{
            width: CARD_FACE,
            height: CARD_FACE,
            borderRadius: radii.xxl,
            backgroundColor: colors.surface.sunken,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.4,
          }}
        >
          <Icon name="lock" size={80} color={colors.text.muted} />
        </View>
      )}
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
