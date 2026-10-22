import { colors, radii, spacing } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { showsCapture } from '../../data/site-captures';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { createAccount, learnerStart, signIn } from '../../lib/site-links';
import { sitePath } from '../../lib/site-path';
import { SITE_SIZES } from '../../lib/site-style';
import { SiteCapture } from './SiteCapture';
import { SiteShell } from './SiteShell';
import {
  AppTextLink,
  Body,
  Bullets,
  Closing,
  ClosingActions,
  Fold,
  Folds,
  Lines,
  PageHead,
  PlansBlock,
  PrimaryAction,
  SecondaryAction,
  Section,
  TextLink,
  TwoColumns,
} from './site-parts';

export interface ParentsPageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * `/parents`, the page for parents, grandparents and every caregiver (F-SITE-002 §3.5, appendix B.3, amended by
 * AMENDMENTS-SITE-NEWUSER §3.5; wireframes design/wireframes/site/parents.md and newuser-grown-up-pages.md; mocks
 * design/screens/site/persona-page.md and design/screens/site/newuser/mock/<locale>/parents.html). [SN] Create first:
 * the primary action is Create a free family space (the create view of /signin through `site-links`, never the
 * teacher router), the secondary Start learning (OD-SN-5), and "Already have an account? Sign in" under them; the
 * closing block the same. On wide screens What they learn and Safe by design sit left, Follow along and Plans right.
 * Follow along adds one line per live claim (the browse line also needs paid plans on sale, `showsClaim`) and, under
 * the `parentReports` claim, the weekly report capture in a small phone frame. No price, no ranking, no age range.
 */
export function ParentsPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: ParentsPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const P = t.persona.parents;
  const create = createAccount('parent', locale);
  const haveAccount = <AppTextLink href={signIn('parent', locale)}>{t.persona.haveAccount}</AppTextLink>;
  const follow = [
    P.follow.body,
    ...(showsClaim(claims, 'parentReports', locale) ? [P.follow.reports] : []),
    ...(showsClaim(claims, 'learningRoute', locale) ? [P.follow.route] : []),
    ...(showsClaim(claims, 'feedbackNotes', locale) ? [P.follow.notes] : []),
    ...(showsClaim(claims, 'browseAsLearner', locale) ? [P.follow.browse] : []),
    ...(showsClaim(claims, 'lectureMode', locale) ? [P.follow.lecture] : []),
  ];
  const whatSee = showsClaim(claims, 'parentReports', locale) ? P.faq.whatSee.reports : P.faq.whatSee.a;
  return (
    <SiteShell locale={locale} page="/parents" current="parents">
      <PageHead title={P.title} lead={P.lead} after={haveAccount}>
        <PrimaryAction href={create}>{P.create}</PrimaryAction>
        <SecondaryAction href={learnerStart(locale)}>{t.nav.start}</SecondaryAction>
      </PageHead>

      <TwoColumns
        left={
          <>
            <Section id="parents-learn" title={P.learn.title}>
              <Body>{P.learn.body}</Body>
              <TextLink href={sitePath(locale, '/learners')}>{P.learn.link}</TextLink>
            </Section>
            <Section id="parents-safe" title={P.safe.title}>
              <Bullets items={[P.safe.bullets.ads, P.safe.bullets.backup, P.safe.bullets.gate, P.safe.bullets.siblings]} />
            </Section>
          </>
        }
        right={
          <>
            <Section id="parents-follow" title={P.follow.title}>
              <Lines items={follow} />
              {/* [SN] §3.5: the report capture only under its claim; with it off nothing is left in its place. */}
              {showsCapture(claims, 'report', locale) ? (
                <figure style={{ margin: `${spacing.lg}px 0 0` }}>
                  <div
                    style={{
                      width: `min(${SITE_SIZES.phoneFrameSmall}, 100%)`,
                      backgroundColor: colors.text.primary,
                      padding: spacing.xs,
                      borderRadius: radii.xl,
                    }}
                  >
                    <SiteCapture locale={locale} name="report" alt={t.captures.report} style={{ borderRadius: radii.xl - spacing.xs }} />
                  </div>
                </figure>
              ) : null}
            </Section>
            <PlansBlock id="parents-plans" locale={locale} claims={claims} />
          </>
        }
      />

      <Section id="parents-faq" title={t.persona.faqTitle} hiddenTitle>
        <Folds>
          {[P.faq.account, P.faq.learnAlong, { q: P.faq.whatSee.q, a: whatSee }].map(({ q, a }) => (
            <Fold key={q} summary={q}>
              <p style={{ margin: 0 }}>{a}</p>
            </Fold>
          ))}
        </Folds>
      </Section>

      <Closing id="parents-closing" line={t.persona.closing.parents}>
        <ClosingActions>
          <PrimaryAction href={create}>{P.create}</PrimaryAction>
          {haveAccount}
        </ClosingActions>
      </Closing>
    </SiteShell>
  );
}
