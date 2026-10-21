import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type Messages, type UiLocale } from '@hangul-route/i18n';
import type { CardRarity, SiteCard } from '../../data/stage1-cards';
import { rem } from '../../lib/site-style';

const rarityBorder: Record<CardRarity, string> = {
  common: colors.rarity.common,
  uncommon: colors.rarity.uncommon,
  rare: colors.rarity.rare,
  legendary: colors.rarity.legendary,
};

type CardWords = Messages['landing']['cards'];

/**
 * One card: the Korean word, its romanization and its gloss in the UI language (`card.gloss`, CLAUDE.md §1: never
 * the English title, which for some cards is the romanization again, such as Bap), then the blurb. A card whose
 * overlay title only repeats the word (`gloss: null`, every Korean title) shows the word and its romanization alone,
 * and the word then carries `lang="ko"` so a screen reader reads it in Korean.
 */
function CardTile({ card, t }: { card: SiteCard; t: CardWords }): JSX.Element {
  return (
    <article
      style={{
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        border: `2px solid ${rarityBorder[card.rarity]}`,
        padding: spacing.md,
        boxShadow: `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px rgba(42, 31, 20, ${shadows.card.shadowOpacity})`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        // The even height (and the blurb's `marginTop: 'auto'`) lines up a row of glossed cards. A card with no gloss
        // takes its own height, so it shows no empty band between the romanization and the blurb (every ko card).
        ...(card.gloss === null ? {} : { minHeight: 168 }),
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* The label is in the UI language, so `lang="ko"` marks the word only when it is read as itself. */}
        <span
          {...(card.gloss === null ? { lang: 'ko' } : { 'aria-label': t.cardLabel(card.romanization, card.gloss) })}
          style={{
            fontSize: rem(typography.size.title),
            fontWeight: typography.weight.bold,
            color: colors.text.primary,
            lineHeight: 1,
          }}
        >
          {card.ko}
        </span>
        {/* Rarity colour is a dot, not the text colour: it is under 3:1 on white. */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            fontSize: rem(typography.size.caption),
            color: colors.text.secondary,
            fontWeight: typography.weight.semibold,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: radii.circle, backgroundColor: rarityBorder[card.rarity] }}
          />
          {t.rarity[card.rarity]}
        </span>
      </header>
      <div
        style={{
          fontSize: rem(typography.size.bodySm),
          color: colors.text.muted,
          fontVariant: 'small-caps',
        }}
      >
        {card.romanization}
      </div>
      {card.gloss === null ? null : (
        <div
          style={{
            fontSize: rem(typography.size.bodyLg),
            color: colors.text.primary,
            fontWeight: typography.weight.semibold,
          }}
        >
          {card.gloss}
        </div>
      )}
      <div
        style={{
          fontSize: rem(typography.size.bodySm),
          color: colors.text.secondary,
          marginTop: 'auto',
          lineHeight: typography.leading.normal,
        }}
      >
        {card.blurb}
      </div>
    </article>
  );
}

/**
 * The Stage 1 Heritage Card grid inside the `/learners` cards fold (F-SITE-002 §3.4): the section's h2 and the fold's
 * summary already name it, so it renders the list alone, with text in rem so the browser text size scales it
 * (§3.11). The page passes the cards already in its UI language (`stage1CardsIn`), so the content overlays stay on
 * the server.
 */
export function HeritageCardsPreview({ locale = DEFAULT_LOCALE, cards }: { locale?: UiLocale; cards: readonly SiteCard[] }): JSX.Element {
  const t = getMessages(locale).landing.cards;
  return (
    <div
      role="list"
      aria-label={t.listLabel}
      style={{
        display: 'grid',
        // min(100%, …): one column when the box is narrower than a card (a fold at 320 px), never past its edge.
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
        gap: spacing.md,
      }}
    >
      {cards.map((card) => (
        <div role="listitem" key={card.id}>
          <CardTile card={card} t={t} />
        </div>
      ))}
    </div>
  );
}
