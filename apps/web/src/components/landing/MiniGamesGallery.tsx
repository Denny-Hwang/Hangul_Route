import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { minigameCatalog, type MinigameFamily } from '../../data/minigame-catalog';

const familyLabel: Record<MinigameFamily, string> = {
  recognition: 'Recognition',
  production: 'Production',
  application: 'Application',
  review: 'Review',
};

const familyTint: Record<MinigameFamily, string> = {
  recognition: colors.theme.letters,
  production: colors.theme.crafts,
  application: colors.theme.rites,
  review: colors.theme.nature,
};

export function MiniGamesGallery(): JSX.Element {
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
          9 mini-games
        </span>
        <h2
          id="games-heading"
          style={{
            fontSize: typography.size.display,
            margin: `${spacing.sm}px 0 ${spacing.sm}px`,
            lineHeight: typography.leading.tight,
          }}
        >
          None of them feel like school.
        </h2>
        <p
          style={{
            color: colors.text.secondary,
            fontSize: typography.size.bodyLg,
            maxWidth: 720,
            margin: 0,
          }}
        >
          Four families of practice — recognition, production, application,
          review — wrapped in 90-second loops. Hoya never says &ldquo;wrong.&rdquo;
        </p>
      </header>

      <div
        role="list"
        aria-label="Stage 1 mini-games"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: spacing.md,
        }}
      >
        {minigameCatalog.map((game) => (
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
              <span
                aria-hidden="true"
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                }}
              >
                {game.emoji}
              </span>
              <span
                style={{
                  fontSize: typography.size.caption,
                  color: familyTint[game.family],
                  fontWeight: typography.weight.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {familyLabel[game.family]}
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
                Beta — opt in
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
