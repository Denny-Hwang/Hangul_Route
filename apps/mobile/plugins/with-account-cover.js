// F-AUTH-004 section 7.4 (row NS-2; CS-N12, assumption U7): the iOS cover over the grown-up account screens.
//
// iOS takes a snapshot of the app for the app switcher when it leaves the foreground. While an account screen is in
// front (row NS-4 sets the flag below when one is focused and clears it when none is), this plugin's code puts an
// opaque view in the splash colour over the whole window when the app resigns active, and takes it away when the app
// is active again, so the snapshot never shows an account. Android needs no plugin: expo-screen-capture sets
// FLAG_SECURE there. A JavaScript cover on `AppState` changes stays as a second layer (row NS-4), and device check D5
// proves both platforms.
//
// - The flag is the `NSUserDefaults` boolean `hr.accountCover` (`ACCOUNT_COVER_KEY`, the key React Native's
//   `Settings.set` writes on iOS). It is cleared at every launch, so a flag left on by a run that ended on an
//   account screen covers nothing later.
// - Row NS-4: before covering, the window ends editing without animation, so the keyboard (a window of its own, which
//   the cover does not reach) is gone from the snapshot; the account screens also dismiss it from JavaScript.
// - The code lives in `AppDelegate.mm` (Expo SDK 52's Objective-C++ app delegate) as notification observers added in
//   `didFinishLaunchingWithOptions`, so no app delegate method is overridden. The cover is hidden from VoiceOver.
// - Idempotent: the generated block is marked and replaced on every `expo prebuild`. A Swift app delegate (a later
//   Expo SDK) fails the prebuild with a message, so the protection is never silently missing.
//
// The owner runs `npx expo prebuild --platform ios` (or `--clean`) and `pod install` before the next Xcode build.

const { withAppDelegate } = require('expo/config-plugins');

const ACCOUNT_COVER_KEY = 'hr.accountCover';
const BEGIN = '// @generated begin hr-account-cover (plugins/with-account-cover.js)';
const END = '// @generated end hr-account-cover';
const CALL_BEGIN = '  // @generated begin hr-account-cover-install';
const CALL_END = '  // @generated end hr-account-cover-install';
const LAUNCH = /(-\s*\(BOOL\)\s*application:\s*\(UIApplication\s*\*\)\s*application\s+didFinishLaunchingWithOptions:[^{]*\{)/;

/** `#RRGGBB` as UIColor components, or null. */
function rgbOf(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(typeof hex === 'string' ? hex.trim() : '');
  if (match === null) return null;
  return match.slice(1, 4).map((part) => (parseInt(part, 16) / 255).toFixed(4));
}

function colorExpression(hex) {
  const rgb = rgbOf(hex);
  if (rgb === null) return '[UIColor systemBackgroundColor]';
  return `[UIColor colorWithRed:${rgb[0]} green:${rgb[1]} blue:${rgb[2]} alpha:1.0]`;
}

function coverClass(hex) {
  return [
    BEGIN,
    '// F-AUTH-004 section 7.4 (CS-N12): an opaque cover over the window while an account screen is in front and the app',
    '// is not active, so the app switcher snapshot never shows an account. Set by the JavaScript side (row NS-4).',
    `static NSString *const HRAccountCoverKey = @"${ACCOUNT_COVER_KEY}";`,
    'static NSInteger const HRAccountCoverTag = 0x48524143;',
    '',
    '@interface HRAccountCover : NSObject',
    '+ (void)install;',
    '@end',
    '',
    '@implementation HRAccountCover',
    '',
    '+ (UIWindow *)window',
    '{',
    '  id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;',
    '  return [delegate respondsToSelector:@selector(window)] ? delegate.window : nil;',
    '}',
    '',
    '+ (void)show',
    '{',
    '  if (![[NSUserDefaults standardUserDefaults] boolForKey:HRAccountCoverKey]) return;',
    '  UIWindow *window = [self window];',
    '  if (window == nil || [window viewWithTag:HRAccountCoverTag] != nil) return;',
    '  // Row NS-4: the keyboard is a window of its own, which this cover does not reach, and its suggestion bar may hold',
    '  // what was typed (an email, a code): it goes first, at once, before the snapshot is taken.',
    '  [UIView performWithoutAnimation:^{',
    '    [window endEditing:YES];',
    '  }];',
    '  UIView *cover = [[UIView alloc] initWithFrame:window.bounds];',
    '  cover.tag = HRAccountCoverTag;',
    '  cover.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;',
    `  cover.backgroundColor = ${colorExpression(hex)};`,
    '  cover.isAccessibilityElement = NO;',
    '  cover.accessibilityElementsHidden = YES;',
    '  [window addSubview:cover];',
    '}',
    '',
    '+ (void)hide',
    '{',
    '  [[[self window] viewWithTag:HRAccountCoverTag] removeFromSuperview];',
    '}',
    '',
    '+ (void)install',
    '{',
    '  [[NSUserDefaults standardUserDefaults] removeObjectForKey:HRAccountCoverKey];',
    '  NSNotificationCenter *center = [NSNotificationCenter defaultCenter];',
    '  [center addObserverForName:UIApplicationWillResignActiveNotification object:nil queue:[NSOperationQueue mainQueue] usingBlock:^(NSNotification *note) {',
    '    [HRAccountCover show];',
    '  }];',
    '  [center addObserverForName:UIApplicationDidBecomeActiveNotification object:nil queue:[NSOperationQueue mainQueue] usingBlock:^(NSNotification *note) {',
    '    [HRAccountCover hide];',
    '  }];',
    '}',
    '',
    '@end',
    END,
    '',
    '',
  ].join('\n');
}

function strip(contents) {
  const block = new RegExp(`${escape(BEGIN)}[\\s\\S]*?${escape(END)}\\n{0,2}`, 'g');
  const call = new RegExp(`${escape(CALL_BEGIN)}[\\s\\S]*?${escape(CALL_END)}\\n?`, 'g');
  return contents.replace(block, '').replace(call, '');
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Adds (or replaces) the cover in an Objective-C app delegate's source. Throws when the source has no place for it. */
function addAccountCover(contents, hex) {
  const clean = strip(contents);
  const implementation = clean.indexOf('@implementation AppDelegate');
  if (implementation < 0) throw new Error('with-account-cover: AppDelegate.mm has no "@implementation AppDelegate"');
  if (!LAUNCH.test(clean)) throw new Error('with-account-cover: AppDelegate.mm has no didFinishLaunchingWithOptions');
  const withClass = `${clean.slice(0, implementation)}${coverClass(hex)}${clean.slice(implementation)}`;
  return withClass.replace(LAUNCH, `$1\n${CALL_BEGIN}\n  [HRAccountCover install];\n${CALL_END}`);
}

function withAccountCover(config) {
  return withAppDelegate(config, (next) => {
    const { language, contents } = next.modResults;
    if (language !== 'objc' && language !== 'objcpp') {
      throw new Error(`with-account-cover: the app delegate is ${language}; the account cover (F-AUTH-004 section 7.4) needs an Objective-C version for it`);
    }
    next.modResults.contents = addAccountCover(contents, next.splash?.backgroundColor ?? next.ios?.splash?.backgroundColor);
    return next;
  });
}

module.exports = withAccountCover;
module.exports.addAccountCover = addAccountCover;
module.exports.ACCOUNT_COVER_KEY = ACCOUNT_COVER_KEY;
