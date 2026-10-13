import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { siteGames } from '../../data/minigame-catalog';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { stage1Cards } from '../../data/stage1-cards';
import { learnerStart } from '../../lib/site-links';
import { cardShadow, rem } from '../../lib/site-style';
import { HeritageCardsPreview } from './HeritageCardsPreview';
import { MiniGamesGallery } from './MiniGamesGallery';
import { SiteShell } from './SiteShell';
import { Body, Bullets, Closing, Fold, Folds, PageHead, PrimaryAction, Section, Steps } from './site-parts';

/** The teaser row: the first six Stage 1 cards by unlock order (what a new learner earns first; S-D decision). */
const TEASER_CARDS = 6;

export interface LearnersPageProps {
  locale?: UiLocale;
  /** Which feature lines show (F-SITE-002 §3.9); tests render every state. */
  claims?: Readonly<SiteClaims>;
}

/**
 * `/learners`, the page for anyone learning, any age (F-SITE-002 §3.4, appendix B.2; wireframe
 * design/wireframes/site/learners.md; mock design/screens/site/persona-page.md). One primary action, Start learning,
 * at the top and in the closing block. Four sections with every claim off (what you learn first, how most quests
 * work, collect Korean culture, the questions), five with the `learningRoute` claim on. The mini-games and the full
 * card grid sit behind native folds (L3), closed by default. No age words, no price, no speaking line.
 */
export function LearnersPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: LearnersPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const L = t.persona.learners;
  const start = learnerStart(locale);
  return (
    <SiteShell locale={locale} page="/learners" current="learners">
      <PageHead title={L.title} lead={L.lead}>
        <PrimaryAction href={start}>{t.nav.start}</PrimaryAction>
      </PageHead>

      <Section id="learners-learn" title={L.learn.title}>
        <Body>{L.learn.body}</Body>
        <Bullets items={[L.learn.bullets.read, L.learn.bullets.listen, L.learn.bullets.write]} />
      </Section>

      <Section id="learners-quest" title={L.quest.title}>
        <Steps wide items={[L.quest.bullets.discover, L.quest.bullets.play, L.quest.bullets.check]} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${spacing.xxxl}px minmax(0, 1fr)`,
            columnGap: spacing.md,
            alignItems: 'center',
            margin: `${spacing.lg}px 0`,
          }}
        >
          <span aria-hidden="true" style={{ display: 'flex', width: spacing.xxxl, height: spacing.xxxl }}>
            <HoyaSvg pose="waving" size="100%" />
          </span>
          <p style={{ margin: 0, lineHeight: typography.leading.normal }}>{L.quest.hoya}</p>
        </div>
        <Fold summary={L.quest.gamesFold}>
          <MiniGamesGallery locale={locale} games={siteGames} />
        </Fold>
      </Section>

      <Section id="learners-cards" title={L.cards.title}>
        <Body>{L.cards.body}</Body>
        <ul className="hr-site-tiles" style={{ listStyle: 'none', margin: `${spacing.md}px 0`, padding: 0, display: 'grid' }}>
          {stage1Cards.slice(0, TEASER_CARDS).map((card) => (
            <li
              className="hr-site-tile"
              key={card.id}
              style={{
                display: 'grid',
                justifyItems: 'center',
                alignContent: 'start',
                rowGap: spacing.xxs,
                textAlign: 'center',
                backgroundColor: colors.surface.paper,
                border: `${borderWidth.base}px solid ${colors.border.subtle}`,
                borderRadius: radii.lg,
                boxShadow: cardShadow(),
              }}
            >
              <span
                lang="ko"
                style={{
                  fontSize: rem(typography.size.prompt),
                  fontWeight: typography.weight.bold,
                  lineHeight: typography.leading.tight,
                  overflowWrap: 'normal',
                  wordBreak: 'keep-all',
                }}
              >
                {card.ko}
              </span>
              <span style={{ fontSize: rem(typography.size.caption), color: colors.text.muted }}>{card.romanization}</span>
              <span style={{ fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold, lineHeight: typography.leading.tight }}>
                {card.title}
              </span>
            </li>
          ))}
        </ul>
        <Fold summary={L.cards.seeAll(stage1Cards.length)}>
          <HeritageCardsPreview locale={locale} />
        </Fold>
      </Section>

      {showsClaim(claims, 'learningRoute') ? (
        <Section id="learners-route" title={L.route.title}>
          <Body>{L.route.body}</Body>
        </Section>
      ) : null}

      <Section id="learners-faq" title={t.persona.faqTitle} hiddenTitle>
        <Folds>
          {[L.faq.signIn, L.faq.code, L.faq.offline, L.faq.adult, L.faq.korean].map(({ q, a }) => (
            <Fold key={q} summary={q}>
              <p style={{ margin: 0 }}>{a}</p>
            </Fold>
          ))}
        </Folds>
      </Section>

      <Closing id="learners-closing" line={t.persona.closing.learners}>
        <PrimaryAction href={start}>{t.nav.start}</PrimaryAction>
      </Closing>
    </SiteShell>
  );
}
