import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Link } from '@react-navigation/native';
import { NO_PRESS_DELAY, usePressGuard } from '@hangul-route/design-system';
import type { GestureResponderEvent } from 'react-native';
import { Platform, Pressable } from 'react-native';
import type { MouseEvent, ReactElement } from 'react';

/** The navigator's own button style for a web tab link (bottom-tabs 6 `BottomTabItem`). */
const LINK_STYLE = { display: 'flex' } as const;

/** A left click with no modifier key: the only click the tab handles itself (a modified click opens the link as usual). */
function plainClick(e: { metaKey?: boolean; altKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number | null }): boolean {
  return !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) && (e.button == null || e.button === 0);
}

/**
 * One learner tab (AMENDMENTS-TOUCH 6.9, row KT-9): the navigator's own tab button, with the press guard of 4.4 and no
 * press delay. A bounce on a tab switches once, a tap during the app-level tap lock is dropped, and a switch sets that
 * lock, so a bounce cannot press what the new tab puts under the finger. On the web the tab stays the navigator's link
 * (an `<a>` with its `href`): a plain click always prevents the browser's own navigation, guarded or not, so a dropped
 * bounce never reloads the page; a modified click (a new tab) is left to the browser, as before.
 *
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17c (audit A11Y-3): the navigator wraps its tabs in a `tablist`, and its web link
 * took the link role, so axe reported a `tablist` with `link` children (aria-required-children). The web tab keeps its
 * `<a href>` and takes the navigator's own `tab` role, as on Android, with `aria-selected` spelt out (react-native-web
 * does not read `accessibilityState`), so the `tablist` owns tabs and the selected one is announced.
 */
export function GuardedTabButton({ children, style, onPress, to, accessibilityRole, ...rest }: BottomTabBarButtonProps): ReactElement {
  const guard = usePressGuard();
  const guarded = guard(onPress);
  if (Platform.OS === 'web' && to) {
    return (
      <Link
        {...rest}
        to={to}
        accessibilityRole="tab"
        aria-selected={rest.accessibilityState?.selected === true}
        style={[LINK_STYLE, style]}
        onPress={(e: GestureResponderEvent | MouseEvent<HTMLAnchorElement>) => {
          const click = e as unknown as Parameters<typeof plainClick>[0] & { preventDefault: () => void };
          if (!plainClick(click)) return;
          click.preventDefault();
          guarded(e as GestureResponderEvent);
        }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Pressable {...rest} {...NO_PRESS_DELAY} accessibilityRole={accessibilityRole} onPress={guarded} style={style}>
      {children}
    </Pressable>
  );
}
