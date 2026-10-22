import { HoyaSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { siteGames } from '../../data/minigame-catalog';
import { SITE_CLAIMS, showsClaim, type SiteClaims } from '../../data/site-claims';
import { stage1CardsIn } from '../../data/stage1-cards';
import { learnerStart } from '../../lib/site-links';
import { cardShadow, rem } from '../../lib/site-style';
import { HeritageCardsPreview } from './HeritageCardsPreview';
import { MiniGamesGallery } from './MiniGamesGallery';
import { SiteShell } from './SiteShell';
import { Body, Bullets, Closing, Fold, Folds, PageHead, PrimaryAction, Section, Steps } from './site-parts';

/**
 * The teaser row: the first six Stage 1 cards by unlock order (what a new learner earns first; S-D decision). Each
 * tile is the Korean word, its romanization and its gloss in the UI language (`card.gloss`: English `card.en`, never
 * `card.title`, which for some cards is the romanization again, CLAUDE.md §1; es and ko from the content overlays).
 * A gloss that only repeats the word (`null`) is left out, as on the app's card face.
 */
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
 * work, collect Korean culture, the questions), five with the `learningRoute` claim on. "What you learn first" ends
 * with what comes after the alphabet; the level-check question (last) shows only with the `levelCheck` claim on.
 * The mini-games and the full card grid sit behind native folds (L3), closed by default. No age words, no price, no
 * speaking line.
 */
export function LearnersPage({ locale = DEFAULT_LOCALE, claims = SITE_CLAIMS }: LearnersPageProps): JSX.Element {
  const t = getMessages(locale).landing;
  const L = t.persona.learners;
  const start = learnerStart(locale);
  // On the server: the content overlays never reach a client bundle (landing-client-bundle.test.ts).
  const cards = stage1CardsIn(locale, OVERLAYS);
  // The level-check question follows "Do I need to know any Korean?", only while its claim is on.
  const faq = [L.faq.signIn, L.faq.code, L.faq.offline, L.faq.adult, L.faq.korean, ...(showsClaim(claims, 'levelCheck', locale) ? [L.faq.level] : [])];
  return (
    <SiteShell locale={locale} page="/learners" current="learners">
      <PageHead title={L.title} lead={L.lead}>
        <PrimaryAction href={start}>{t.nav.start}</PrimaryAction>
      </PageHead>

      <Section id="learners-learn" title={L.learn.title}>
        <Body>{L.learn.body}</Body>
        <Bullets items={[L.learn.bullets.read, L.learn.bullets.listen, L.learn.bullets.write]} />
        <div style={{ marginTop: spacing.lg }}>
          <Body>
            <strong style={{ display: 'block' }}>{L.after.title}</strong>
            {L.after.body}
          </Body>
        </div>
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
        <ul role="list" className="hr-site-tiles" style={{ listStyle: 'none', margin: `${spacing.md}px 0`, padding: 0, display: 'grid' }}>
          {cards.slice(0, TEASER_CARDS).map((card) => (
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
              {card.gloss === null ? null : (
                <span style={{ fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold, lineHeight: typography.leading.tight }}>
                  {card.gloss}
                </span>
              )}
            </li>
          ))}
        </ul>
        <Fold summary={L.cards.seeAll(cards.length)}>
          <HeritageCardsPreview locale={locale} cards={cards} />
        </Fold>
      </Section>

      {showsClaim(claims, 'learningRoute', locale) ? (
        <Section id="learners-route" title={L.route.title}>
          <Body>{L.route.body}</Body>
        </Section>
      ) : null}

      <Section id="learners-faq" title={t.persona.faqTitle} hiddenTitle>
        <Folds>
          {faq.map(({ q, a }) => (
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
