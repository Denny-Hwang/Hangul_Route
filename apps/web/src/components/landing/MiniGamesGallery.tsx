import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { siteGames, type LandingMinigame, type MinigameFamily } from '../../data/minigame-catalog';
import { rem } from '../../lib/site-style';

const familyTint: Record<MinigameFamily, string> = {
  recognition: colors.theme.letters,
  production: colors.theme.crafts,
  application: colors.theme.rites,
  review: colors.theme.nature,
};

/**
 * The mini-game list inside the `/learners` games fold (F-SITE-002 §3.4): the Stage 1 games without a speaking one
 * (`siteGames`, §3.4: no speaking line). The section's h2 and the fold's summary already name it, so it renders the
 * list alone (the game titles are h3 under the section's h2), with text in rem so the browser text size scales it
 * (§3.11). Each title and blurb is `landing.games.items.<kind>` in the UI language.
 */
export function MiniGamesGallery({
  locale = DEFAULT_LOCALE,
  games = siteGames,
}: {
  locale?: UiLocale;
  games?: readonly LandingMinigame[];
}): JSX.Element {
  const t = getMessages(locale).landing.games;
  return (
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
                fontSize: rem(typography.size.caption),
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
              fontSize: rem(typography.size.title),
              margin: 0,
              color: colors.text.primary,
              lineHeight: typography.leading.tight,
            }}
          >
            {t.items[game.kind].title}
          </h3>
          <p
            style={{
              fontSize: rem(typography.size.bodySm),
              color: colors.text.secondary,
              margin: 0,
              lineHeight: typography.leading.normal,
            }}
          >
            {t.items[game.kind].blurb}
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
                fontSize: rem(typography.size.caption),
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
}
