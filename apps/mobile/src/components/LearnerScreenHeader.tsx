import { ScreenHeader, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import React, { useContext, useEffect, useState } from 'react';
import { useMessages } from '../i18n/use-messages';
import { missingWayBack, screenHeaderDecision } from '../logic/navigation/screen-header';
import { isScreenHeaderException, screenHeaderVariant } from '../navigation/screen-header-variants';
import { DeviceDisplaySheet } from './DeviceDisplaySheet';

/**
 * The learner app's and All lessons' header slot (AMENDMENTS-DISPLAY-NAV section 7.1, row DN-4):
 * `App` and `BrowseApp` provide it as `ScreenHeaderSlotContext`, so every design-system `Screen`
 * drawn inside a route draws it first. It reads the route it is drawn in: the way back from
 * `SCREEN_HEADER_VARIANTS` (Back, Close, or none on a root and the exception list), drawn only when
 * the navigator can go back, and `navigation.goBack()` as its action, so the visible Back runs the
 * screen's `beforeRemove` guard exactly as the browser and phone back do (the history bridge). The
 * screen adds its title, a middle part, one trailing control, or hides the Display control while a
 * clock runs. The Display (Aa) control opens the device's Display sheet. Outside a route (a boot
 * screen, the crash screen) it draws nothing. A screen whose layout needs the header elsewhere than
 * above everything (the level check's item side by side) passes `drawnByScreen` and renders this
 * component with `inLayout` where it belongs.
 */
export function LearnerScreenHeader({
  options,
  inLayout = false,
  reportLocale = true,
}: ScreenHeaderSlotProps & {
  inLayout?: boolean;
  /** Whether a language chosen on the header's Display sheet is reported as `locale.changed`; All lessons passes false (`BrowseScreenHeader`). */
  reportLocale?: boolean;
}): React.ReactElement | null {
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext);
  const messages = useMessages();
  const [displayOpen, setDisplayOpen] = useState(false);
  // Whether there is somewhere to go back to changes with the stack under the screen.
  const [, setStackSeen] = useState(0);
  useEffect(() => navigation?.addListener('state', () => setStackSeen((n) => n + 1)), [navigation]);
  // A screen that should have a way back but cannot go back is a root or in the exception list, or a bug (section 7.1).
  const lost =
    route !== undefined &&
    navigation !== undefined &&
    !(options?.drawnByScreen === true && !inLayout) &&
    missingWayBack({
      variant: screenHeaderVariant(route.name),
      exception: isScreenHeaderException(route.name),
      hasOwnLeading: options?.leading !== undefined,
      canGoBack: navigation.canGoBack(),
    });
  const routeName = route?.name;
  useEffect(() => {
    if (lost && routeName !== undefined) warnInDevelopment(`[ScreenHeader] ${routeName} cannot go back and is neither a root nor in SCREEN_HEADER_EXCEPTIONS, so it draws no way back (AMENDMENTS-DISPLAY-NAV section 7.1).`);
  }, [lost, routeName]);

  if (route === undefined || navigation === undefined) return null;
  // A screen that draws its header inside its own layout renders this component itself (`inLayout`); its `Screen` draws none.
  if (options?.drawnByScreen === true && !inLayout) return null;
  const own = options?.leading;
  const decision = screenHeaderDecision({
    variant: screenHeaderVariant(route.name),
    exception: isScreenHeaderException(route.name),
    declared: options !== undefined,
    canGoBack: navigation.canGoBack(),
    override: own === undefined ? undefined : { kind: own.kind, hasAction: own.onPress !== undefined },
  });
  if (!decision.draw) return null;

  const buttons = messages.common.buttons;
  const display = messages.common.display;
  const leadingLabel = own?.label ?? (decision.leading === 'close' ? buttons.close : buttons.back);
  return (
    <>
      <ScreenHeader
        leading={decision.leading}
        leadingLabel={leadingLabel}
        onLeading={own?.onPress ?? (() => navigation.goBack())}
        title={options?.title}
        titleSize={options?.titleSize}
        titleLang={options?.titleLang}
        titleInline={options?.titleInline}
        middle={options?.middle}
        trailing={options?.trailing}
        onHeight={options?.onHeight}
        displayLabel={display.button}
        displayA11y={display.a11y}
        displayHidden={options?.displayHidden}
        onDisplay={() => setDisplayOpen(true)}
      />
      <DeviceDisplaySheet visible={displayOpen} onClose={() => setDisplayOpen(false)} reportLocale={reportLocale} />
    </>
  );
}

/**
 * All lessons' header slot (`BrowseApp`): the same header, whose Display sheet stores the device's language and tells the
 * other tabs but reports nothing. All lessons sends only `browse.*` events and none for a display choice
 * (AMENDMENTS-DISPLAY-NAV section 11), as its own header row's sheet did before the route drew the header.
 */
export function BrowseScreenHeader(props: ScreenHeaderSlotProps): React.ReactElement | null {
  return <LearnerScreenHeader {...props} reportLocale={false} />;
}

/** A development build's warning (Metro's `__DEV__`; a non-production `NODE_ENV` in tests); silent in a release build. */
function warnInDevelopment(message: string): void {
  const dev = (globalThis as { __DEV__?: unknown }).__DEV__;
  const on = typeof dev === 'boolean' ? dev : process.env.NODE_ENV !== 'production';
  if (on) console.warn(message);
}
