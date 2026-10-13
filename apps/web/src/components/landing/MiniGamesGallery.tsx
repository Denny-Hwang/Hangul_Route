import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { minigameCatalog, type LandingMinigame, type MinigameFamily } from '../../data/minigame-catalog';

const familyTint: Record<MinigameFamily, string> = {
  recognition: colors.theme.letters,
  production: colors.theme.crafts,
  application: colors.theme.rites,
  review: colors.theme.nature,
};

/**
 * The mini-games gallery. `games` defaults to the whole catalogue (the old landing); `/learners` passes the games
 * without a speaking one (`siteGames`, F-SITE-002 §3.4: no speaking line). The counts come from the list shown.
 */
export function MiniGamesGallery({ locale = DEFAULT_LOCALE, games = minigameCatalog }: { locale?: UiLocale; games?: readonly LandingMinigame[] }): JSX.Element {
  const t = getMessages(locale).landing.games;
  const shippedCount = games.filter((g) => g.status === 'shipped').length;
  const betaCount = games.length - shippedCount;
  return (
    <section
      aria-labelledby="games-heading"
      style={{ marginTop: spacing.jumbo }}
    >
      <header style={{ marginBottom: spacing.xl }}>
        <span
          style={{
            display: 'inline-block',
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: colors.brand.secondaryLight,
            color: colors.brand.secondaryDark,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            fontSize: typography.size.caption,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {t.eyebrow(shippedCount, betaCount)}
        </span>
        <h2
          id="games-heading"
          style={{
            fontSize: typography.size.display,
            margin: `${spacing.sm}px 0 ${spacing.sm}px`,
            lineHeight: typography.leading.tight,
          }}
        >
          {t.title}
        </h2>
        <p
          style={{
            color: colors.text.secondary,
            fontSize: typography.size.bodyLg,
            maxWidth: 720,
            margin: 0,
          }}
        >
          {t.body}
        </p>
      </header>

      <div
        role="list"
        aria-label={t.listLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: spacing.md,
        }}
      >
        {games.map((game) => (
          <article
            key={game.kind}
            role="listitem"
            style={{
              backgroundColor: colors.surface.paper,
              border: `1px solid ${colors.border.subtle}`,
              borderRadius: radii.lg,
              padding: spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.sm,
              minHeight: 200,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <IconSvg name={game.icon} size={36} color={colors.brand.primary} />
              {/* Family tint is a dot, not the text colour: theme tints are under 3:1 on white. */}
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
                  style={{ width: 10, height: 10, borderRadius: radii.circle, backgroundColor: familyTint[game.family] }}
                />
                {t.family[game.family]}
              </span>
            </div>
            <h3
              style={{
                fontSize: typography.size.title,
                margin: 0,
                color: colors.text.primary,
                lineHeight: typography.leading.tight,
              }}
            >
              {game.title}
            </h3>
            <p
              style={{
                fontSize: typography.size.bodySm,
                color: colors.text.secondary,
                margin: 0,
                lineHeight: typography.leading.normal,
              }}
            >
              {game.blurb}
            </p>
            {game.status === 'beta' ? (
              <span
                style={{
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  marginTop: 'auto',
                  padding: `${spacing.xxs}px ${spacing.sm}px`,
                  backgroundColor: colors.feedback.nudgeLight,
                  color: colors.text.primary,
                  borderRadius: radii.pill,
                  fontSize: typography.size.caption,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {t.beta}
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
