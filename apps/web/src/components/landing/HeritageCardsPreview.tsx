import { colors, radii, shadows, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type Messages, type UiLocale } from '@hangul-route/i18n';
import { stage1Cards, type CardRarity, type LandingCard } from '../../data/stage1-cards';

const rarityBorder: Record<CardRarity, string> = {
  common: colors.rarity.common,
  uncommon: colors.rarity.uncommon,
  rare: colors.rarity.rare,
  legendary: colors.rarity.legendary,
};

type CardWords = Messages['landing']['cards'];

function CardTile({ card, t }: { card: LandingCard; t: CardWords }): JSX.Element {
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
        minHeight: 168,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          aria-label={t.cardLabel(card.romanization, card.en)}
          style={{
            fontSize: typography.size.title,
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
            fontSize: typography.size.caption,
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
          fontSize: typography.size.bodySm,
          color: colors.text.muted,
          fontVariant: 'small-caps',
        }}
      >
        {card.romanization}
      </div>
      <div
        style={{
          fontSize: typography.size.bodyLg,
          color: colors.text.primary,
          fontWeight: typography.weight.semibold,
        }}
      >
        {card.title}
      </div>
      <div
        style={{
          fontSize: typography.size.bodySm,
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

export function HeritageCardsPreview({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.cards;
  const rarityCounts = stage1Cards.reduce<Record<CardRarity, number>>(
    (acc, card) => {
      acc[card.rarity] += 1;
      return acc;
    },
    { common: 0, uncommon: 0, rare: 0, legendary: 0 },
  );

  return (
    <section
      aria-labelledby="cards-heading"
      style={{ marginTop: spacing.jumbo }}
    >
      <header style={{ marginBottom: spacing.xl }}>
        <span
          style={{
            display: 'inline-block',
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: colors.brand.primaryLight,
            color: colors.brand.primaryDark,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            fontSize: typography.size.caption,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {t.eyebrow}
        </span>
        <h2
          id="cards-heading"
          style={{
            fontSize: typography.size.display,
            margin: `${spacing.sm}px 0 ${spacing.sm}px`,
            lineHeight: typography.leading.tight,
          }}
        >
          {t.title(stage1Cards.length)}
        </h2>
        <p style={{ color: colors.text.secondary, fontSize: typography.size.bodyLg, maxWidth: 720, margin: 0 }}>
          {t.body(stage1Cards.length, rarityCounts.common, rarityCounts.uncommon, rarityCounts.rare, rarityCounts.legendary)}
        </p>
      </header>

      <div
        role="list"
        aria-label={t.listLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: spacing.md,
        }}
      >
        {stage1Cards.map((card) => (
          <div role="listitem" key={card.id}>
            <CardTile card={card} t={t} />
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: spacing.xl,
          fontSize: typography.size.bodySm,
          color: colors.text.muted,
          textAlign: 'center',
        }}
      >
        {t.more}
      </p>
    </section>
  );
}
