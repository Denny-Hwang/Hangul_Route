import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, Caption, Heading, Spacer, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import { useMemo, type ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { albumLegendCards, heritageCardsAll } from '../../content/heritage-cards';
import { ALBUM_STAGES, ALBUM_THEMES } from '../../content/album-order';
import { UPPER_CELL_CARDS } from '../../content/upper-cell-cards';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { albumViews } from '../../logic/awards/albums';
import { localizeCard } from '../../logic/content-locale';

// The drawings, by the file's own path (Metro resolves it without `exports`; see logic/__tests__/metro-subpaths.test.ts).
export { UpperCellCardArt, hasUpperCellArt } from '@hangul-route/design-system/src/components/HeritageCardArt/UpperCellArt';
export { withUpperBack } from '../../content/upper-card-backs';

/**
 * The upper-cell cards' chunk (F-CURR-002 §7.2 and §10, row CM-23; marker below): the card drawings, the card backs and
 * the Library's category albums, loaded by `./upper-cards-entry.tsx`.
 *
 * Each album row shows its theme, how many of its cards the learner holds (or New), and those cards, each opening its
 * card page. It only fills: no empty slots, no count of what is left, no percentage (D3, §7.7). A finished album says
 * so, and once its legendary card is held (row CM-23 part 3) that card leads the row's faces.
 */
export const UPPER_CARDS_CHUNK = 'screen-chunk:upper-cards';

const THUMB = 56;

export function AlbumsSection({ owned, onOpenCard }: { owned: ReadonlySet<string>; onOpenCard: (card: HeritageCard) => void }): ReactElement {
  const messages = useMessages();
  const m = messages.learner.library.albums;
  const locale = useLocale();
  const albums = useMemo(() => albumViews(UPPER_CELL_CARDS, heritageCardsAll, owned, ALBUM_THEMES, ALBUM_STAGES), [owned]);
  return (
    <View testID="library-albums">
      <Spacer size="xl" />
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary" size="sm">
        {m.line}
      </Body>
      <Spacer size="sm" />
      <View style={{ gap: spacing.xs }}>
        {albums.map((album) => {
          const name = m.names[album.theme];
          const status = album.complete ? m.complete : album.held.length === 0 ? m.fresh : m.count(album.held.length);
          const legend = albumLegendCards.find((c) => c.theme === album.theme && owned.has(c.id));
          const faces = legend ? [legend, ...album.held] : album.held;
          return (
            <View
              key={album.theme}
              testID={`library-album-${album.theme}`}
              accessible={faces.length === 0}
              accessibilityLabel={faces.length === 0 ? m.a11y(name, status) : undefined}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radii.md,
                borderWidth: borderWidth.thin,
                borderColor: colors.border.subtle,
                backgroundColor: colors.surface.paper,
              }}
            >
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: spacing.xl * 4 }} accessible={faces.length > 0} accessibilityLabel={faces.length > 0 ? m.a11y(name, status) : undefined}>
                <Body weight="semibold">{name}</Body>
                <Caption tone="muted" testID={`library-album-${album.theme}-status`}>
                  {status}
                </Caption>
              </View>
              {faces.length > 0 ? (
                // Up to six faces (a legendary card and five album cards): the row wraps inside the album at 320.
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, maxWidth: '100%' }}>
                  {faces.map((source) => {
                    const card = localizeCard(source, locale);
                    return (
                      <Pressable
                        key={card.id}
                        testID={`library-album-card-${card.id}`}
                        onPress={() => onOpenCard(source)}
                        accessibilityRole="button"
                        accessibilityLabel={card.titleEn}
                        style={({ pressed }) => ({
                          borderRadius: radii.sm,
                          borderWidth: borderWidth.thick,
                          borderColor: colors.rarity[card.rarity],
                          backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
                          overflow: 'hidden',
                        })}
                      >
                        <CardArt card={card} size={THUMB} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
