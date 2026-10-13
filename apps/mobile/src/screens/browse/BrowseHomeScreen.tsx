import type { StageKey } from '@hangul-route/content-schema';
import { Body, Heading, Icon, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { closeAction } from '../../logic/browse/boot';
import { browseSections, type BrowseSection } from '../../logic/browse/catalogue';
import { homeLines, initialSection, pointerUrl } from '../../logic/browse/home-view';
import type { BrowseStackParamList } from '../../navigation/browse';
import { canGoBack, goBack, leaveTo, revealTestId } from '../../platform/browse-env';
import { useBrowseSettings } from './BrowseSettings';
import { HeaderBack, HeaderRow, focusRing, type FocusState } from './browse-ui';
import { useBrowseSession } from './browse-session';
import { JourneySection, LibrarySection, RouteSection, SectionControl, type OpenTargets } from './HomeSections';
import { LessonDisplaySheet } from './LessonDisplaySheet';

/**
 * All lessons home (F-BROWSE-001 sections 4.1, 4.4 and 4.5; wireframe
 * `browse/home.md`; mock `design/screens/browse/home.md`): the header row
 * ([ Close ] in the one fixed top-left position, [ Lesson display ]), the
 * title with the Offline chip, the how-to line, the scope line (switch on
 * only), a deep link's note, the pointer line (account passes that are not
 * kept, online), the one-row section control (Route · Journey · Library in
 * the learner's order), the section, and the keep switch.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'BrowseHome'>;

/** How many frames the stage reveal waits for the Journey grid to be drawn. */
const REVEAL_TRIES = 20;
const REVEAL_FRAME_MS = 50;
/** The keep switch track (drawing only; the whole row is the control): 48 x 24 with a 16 thumb. */
const TRACK_W = spacing.xxxl;
const TRACK_H = spacing.xl;
const THUMB = spacing.lg;

export function BrowseHomeScreen({ route, navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse;
  const { pass, lastPersona, online, gatingEnabled } = useBrowseSession();
  const params = route.params ?? {};
  const sections = useMemo(() => browseSections(flags.myRouteEnabled), []);
  const [section, setSection] = useState<BrowseSection>(() => initialSection(sections, params.section));
  const [pendingStage, setPendingStage] = useState<StageKey | null>(params.stage ?? null);
  const [noteShown, setNoteShown] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(false);
  const paneMode = useLayoutClass().panes === 2;

  // A later link (or See on the Journey) lands here with new params: show what it asks for.
  useEffect(() => {
    if (params.section) setSection(initialSection(sections, params.section));
    if (params.stage) setPendingStage(params.stage);
    if (params.note) setNoteShown(true);
  }, [params.section, params.stage, params.note, sections]);

  // "Stage row → the Journey at that stage": once the grid is drawn, its row is scrolled to the top.
  useEffect(() => {
    if (pendingStage === null || section !== 'journey') return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (revealTestId(`journey-stage-${pendingStage}`) || tries >= REVEAL_TRIES) {
        clearInterval(timer);
        setPendingStage(null);
      }
    }, REVEAL_FRAME_MS);
    return () => clearInterval(timer);
  }, [pendingStage, section]);

  if (!pass) return <Screen tone="canvas">{null}</Screen>;
  const lines = homeLines({ pass, gatingEnabled, online });

  const onClose = (): void => {
    const action = closeAction({ canGoBack: canGoBack(), from: pass.from, lastPersona });
    if (action.kind === 'back') goBack(action.fallbackUrl);
    else leaveTo(action.url);
  };

  const open: OpenTargets = {
    openEpisode: (episodeId) => navigation.navigate('BrowseEpisode', { episodeId }),
    openItem: (item) => navigation.navigate('BrowseItem', item),
    openCard: (cardId) => navigation.navigate('CardDetail', { cardId }),
    showStage: (stage) => {
      setSection('journey');
      setPendingStage(stage);
    },
  };

  const note = params.note && noteShown ? (params.note === 'letter-across-stage1' ? m.home.note.letterAcrossStage1 : m.home.note.notInVersion) : null;

  return (
    <Screen tone="canvas" scrollable width={paneMode && section === 'journey' ? 'full' : 'reading'} testID="browse-home">
      <HeaderRow back={<HeaderBack label={m.home.close.cta} showLabel onPress={onClose} testID="browse-close" />} onDisplay={() => setDisplayOpen(true)} />
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <Heading level="title">{m.home.title}</Heading>
        {online ? null : (
          <View testID="browse-offline" style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radii.pill, backgroundColor: colors.surface.sunken }}>
            <Text style={{ fontSize: typography.size.caption, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{m.home.offline}</Text>
          </View>
        )}
      </View>
      <Spacer size="sm" />
      <Body tone="secondary">{m.home.howTo}</Body>

      {lines.scope ? (
        <>
          <Spacer size="md" />
          <View testID="browse-scope-line" style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
            <Body>{lines.scope === 'sampler' ? m.home.scope.sampler : m.home.scope.fallback}</Body>
          </View>
        </>
      ) : null}

      {note ? (
        <>
          <Spacer size="md" />
          <View testID="browse-note" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.feedback.infoLight, borderRadius: radii.md, paddingLeft: spacing.lg }}>
            <View style={{ flex: 1, paddingVertical: spacing.md }}>
              <Body>{note}</Body>
            </View>
            <Pressable
              onPress={() => setNoteShown(false)}
              accessibilityRole="button"
              accessibilityLabel={m.home.note.dismiss}
              style={({ focused }: FocusState) => ({ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, ...focusRing(focused) })}
            >
              <Icon name="close" size={spacing.xl} color={colors.text.primary} />
            </Pressable>
          </View>
        </>
      ) : null}

      {lines.pointer ? (
        <>
          <Spacer size="sm" />
          <Pressable
            onPress={() => leaveTo(pointerUrl(lastPersona))}
            accessibilityRole="link"
            testID="browse-pointer"
            style={({ focused }: FocusState) => ({ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, ...focusRing(focused) })}
          >
            <Text style={{ flex: 1, fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: colors.brand.primary, textDecorationLine: 'underline' }}>{m.home.pointer}</Text>
            <Icon name="arrow-right" size={spacing.xl} color={colors.brand.primary} />
          </Pressable>
        </>
      ) : null}

      <Spacer size="lg" />
      <SectionControl sections={sections} value={section} onChange={setSection} />
      <Spacer size="xl" />
      {section === 'route' ? <RouteSection open={open} /> : null}
      {section === 'journey' ? <JourneySection open={open} withStageLine={!sections.includes('route')} /> : null}
      {section === 'library' ? <LibrarySection open={open} /> : null}

      {lines.keep ? <KeepRow /> : null}
      <Spacer size="xl" />
      <LessonDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} />
    </Screen>
  );
}

/** The keep switch (section 4.3, OD-4): the whole row is one `switch`, at least 64 tall; the track is drawing only. */
function KeepRow(): React.ReactElement {
  const m = useMessages().caregiver.browse.keep;
  const { kept, setKept } = useBrowseSettings();
  const on = kept === true;
  return (
    <View style={{ marginTop: spacing.xxl, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle, paddingTop: spacing.md }}>
      <Pressable
        role="switch"
        aria-checked={on}
        accessibilityState={{ checked: on }}
        onPress={() => setKept(!on)}
        testID="browse-keep"
        style={({ focused }: FocusState) => ({
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xs,
          borderRadius: radii.md,
          ...focusRing(focused),
        })}
      >
        <View style={{ flex: 1 }}>
          <Body>{m.label}</Body>
        </View>
        <View
          aria-hidden
          style={{
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: radii.pill,
            backgroundColor: on ? colors.brand.secondary : colors.border.strong,
            justifyContent: 'center',
            paddingHorizontal: (TRACK_H - THUMB) / 2,
            alignItems: on ? 'flex-end' : 'flex-start',
          }}
        >
          <View style={{ width: THUMB, height: THUMB, borderRadius: radii.circle, backgroundColor: colors.surface.paper }} />
        </View>
      </Pressable>
    </View>
  );
}
