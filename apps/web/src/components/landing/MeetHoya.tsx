import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';

/** Hoya's "almost there" — taught Korean with its romanization, shown beside the UI-language gloss. */
const ALMOST_THERE = { ko: '거의 다 했어!', romanization: 'geoui da haesseo' } as const;

export function MeetHoya({ locale = DEFAULT_LOCALE }: { locale?: UiLocale }): JSX.Element {
  const t = getMessages(locale).landing.hoya;
  return (
    <section
      aria-labelledby="hoya-heading"
      className="hr-landing-split"
      style={{
        marginTop: spacing.jumbo,
        backgroundColor: colors.surface.sunken,
        borderRadius: radii.xxl,
        padding: spacing.xxl,
        display: 'grid',
        gap: spacing.xxl,
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        className="hr-landing-split-art"
        style={{
          aspectRatio: '1 / 1',
          backgroundColor: colors.hoya.belly,
          borderRadius: radii.xxl,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `3px solid ${colors.hoya.fur}`,
        }}
      >
        <div
          style={{
            width: '78%',
            aspectRatio: '1 / 1',
            backgroundColor: colors.brand.primaryLight,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Hoya with his amber "almost there" (design/launch/01-hoya-three-poses.md, idle + bubble), on the
              peach brand tint (the hero's backdrop): gold fur reads against it, and it shows against the cream box. */}
          <div style={{ width: '80%', aspectRatio: '1 / 1', display: 'flex' }}>
            <HoyaSvg pose="idle" size="100%" />
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: -spacing.md,
              right: -spacing.md,
              backgroundColor: colors.surface.paper,
              color: colors.text.primary,
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.pill,
              fontSize: typography.size.bodySm,
              fontWeight: typography.weight.semibold,
              boxShadow: '0 2px 8px rgba(42, 31, 20, 0.08)',
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            {t.bubble(ALMOST_THERE.ko, ALMOST_THERE.romanization)}
          </span>
        </div>
      </div>

      <div>
        <span
          style={{
            display: 'inline-block',
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: colors.brand.primary,
            color: colors.text.onPrimary,
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
          id="hoya-heading"
          style={{
            fontSize: typography.size.display,
            margin: `${spacing.sm}px 0 ${spacing.md}px`,
            lineHeight: typography.leading.tight,
          }}
        >
          {t.title}
        </h2>
        <p
          style={{
            color: colors.text.secondary,
            fontSize: typography.size.bodyLg,
            margin: 0,
            lineHeight: typography.leading.relaxed,
          }}
        >
          {t.body}
        </p>
        <ul
          style={{
            marginTop: spacing.lg,
            marginBottom: 0,
            paddingLeft: spacing.lg,
            color: colors.text.secondary,
            fontSize: typography.size.body,
            lineHeight: typography.leading.relaxed,
          }}
        >
          <li>
            <strong style={{ color: colors.text.primary }}>{t.points.wrong.title}</strong> {t.points.wrong.body(ALMOST_THERE.ko)}
          </li>
          <li>
            <strong style={{ color: colors.text.primary }}>{t.points.right.title}</strong> {t.points.right.body}
          </li>
          <li>
            <strong style={{ color: colors.text.primary }}>{t.points.streak.title}</strong> {t.points.streak.body}
          </li>
        </ul>
      </div>
    </section>
  );
}
