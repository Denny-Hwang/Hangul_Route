import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { minigameCatalog, type LandingMinigame, type MinigameFamily } from '../../data/minigame-catalog';
import { rem } from '../../lib/site-style';

const familyTint: Record<MinigameFamily, string> = {
  recognition: colors.theme.letters,
  production: colors.theme.crafts,
  application: colors.theme.rites,
  review: colors.theme.nature,
};

/**
 * The mini-games gallery. `games` defaults to the whole catalogue (the old landing); `/learners` passes the games
 * without a speaking one (`siteGames`, F-SITE-002 §3.4: no speaking line). The counts come from the list shown.
 *
 * `embedded` is the gallery inside a fold of a layered-site page (F-SITE-002 §3.4): the section's h2 and the fold's
 * summary already name it, so it renders the list alone (no eyebrow, heading, body line or top margin; the game
 * titles are h3 under the section's h2), with text in rem so the browser text size scales it (§3.11).
 */
export function MiniGamesGallery({
  locale = DEFAULT_LOCALE,
  games = minigameCatalog,
  embedded = false,
}: {
  locale?: UiLocale;
  games?: readonly LandingMinigame[];
  embedded?: boolean;
}): JSX.Element {
  const t = getMessages(locale).landing.games;
  const shippedCount = games.filter((g) => g.status === 'shipped').length;
  const betaCount = games.length - shippedCount;
  const size = (px: number): number | string => (embedded ? rem(px) : px);
  const list = (
    <div
      role="list"
      aria-label={t.listLabel}
      style={{
        display: 'grid',
        // min(100%, …): one column when the box is narrower than a card (a fold at 320 px), never past its edge.
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
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
            ...(embedded ? {} : { minHeight: 200 }),
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
                fontSize: size(typography.size.caption),
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
              fontSize: size(typography.size.title),
              margin: 0,
              color: colors.text.primary,
              lineHeight: typography.leading.tight,
            }}
          >
            {game.title}
          </h3>
          <p
            style={{
              fontSize: size(typography.size.bodySm),
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
                fontSize: size(typography.size.caption),
                fontWeight: typography.weight.semibold,
              }}
            >
              {t.beta}
            </span>
          ) : null}
        </article>
      ))}
    </div>
  );
  if (embedded) return list;
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

      {list}
    </section>
  );
}
