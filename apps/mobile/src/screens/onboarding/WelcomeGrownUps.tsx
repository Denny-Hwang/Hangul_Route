import { Body, Button, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import type { AdultPersona } from '@hangul-route/content-schema';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';
import { welcomeRow, type PersonaChoice } from '../../logic/shell/entry-points';
import { openPersonaSignIn } from '../../platform/persona-signin';
import { focusForScreenReader } from '../../platform/screen-reader';
import { readLastPersona } from '../../platform/shell-store';

/**
 * The grown-ups' row on Welcome (F-APP-001 A-7, section 3.6; wireframe
 * `design/wireframes/onboarding/welcome-personas.md`, mock `design/screens/app-shell/learner-entry.md`
 * and `mock/welcome.html`, decision D10). Web only, behind `flags.grownUpHomeEnabled`: the caller
 * renders it under "I already have progress", so "Let's start" keeps its size and place.
 *
 * - Panel A: "Here to support a learner?" and two ghost buttons, Parent or caregiver and Teacher
 *   (to `/signin?persona=…`, same tab), side by side when both fit, stacked otherwise.
 * - Panel B: when the shell store remembers a persona, one ghost button Continue as family or
 *   Continue as teacher (to `/signin`) and a Someone else link that swaps in Panel A's row.
 * - Panel C: offline, the buttons keep their labels, disabled, with "Needs the internet" under them
 *   as their description; they re-enable on `online`.
 *
 * The row renders once the shell store has answered (either way), so a returning grown-up sees
 * Panel B straight away rather than Panel A swapping into it. Someone else moves focus to Parent or
 * caregiver, since the control that had it is gone.
 */
export function WelcomeGrownUps(): React.ReactElement {
  const m = useMessages().learner.welcome.grownUps;
  const online = useOnline();
  const [lastPersona, setLastPersona] = useState<AdultPersona | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [someoneElse, setSomeoneElse] = useState(false);
  const leaving = useRef(false);
  const parentRef = useRef<View>(null);

  useEffect(() => {
    let live = true;
    void readLastPersona()
      .then((persona) => {
        if (live) setLastPersona(persona);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const row = welcomeRow(lastPersona, someoneElse);
  const disabled = !online;
  const hint = disabled ? m.needsInternet : undefined;

  useEffect(() => {
    if (someoneElse) focusForScreenReader(parentRef.current);
  }, [someoneElse]);

  const choose = (choice: PersonaChoice): void => {
    // A ref, set before the hand-off starts, so two taps in one render open sign-in once.
    if (leaving.current || !online) return;
    leaving.current = true;
    void openPersonaSignIn(choice)
      .catch(() => undefined)
      .finally(() => {
        leaving.current = false;
      });
  };

  if (!loaded) return <View testID="welcome-grown-ups-pending" />;

  return (
    <View
      testID="welcome-grown-ups"
      style={{
        alignSelf: 'stretch',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
        paddingTop: spacing.md,
        borderTopWidth: borderWidth.thin,
        borderTopColor: colors.border.subtle,
      }}
    >
      {row.kind === 'choose' ? (
        <>
          <Body tone="secondary" align="center">
            {m.lead}
          </Body>
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
            <View style={{ flexGrow: 1 }}>
              <Button
                label={m.parent}
                tone="ghost"
                size="md"
                fullWidth
                disabled={disabled}
                accessibilityHint={hint}
                onPress={() => choose({ persona: 'parent', from: 'welcome' })}
                testID="welcome-grown-ups-parent"
                pressableRef={parentRef}
              />
            </View>
            <View style={{ flexGrow: 1 }}>
              <Button
                label={m.teacher}
                tone="ghost"
                size="md"
                fullWidth
                disabled={disabled}
                accessibilityHint={hint}
                onPress={() => choose({ persona: 'teacher', from: 'welcome' })}
                testID="welcome-grown-ups-teacher"
              />
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Centred under the divider (mock welcome.html Panel B); `Button` itself aligns to the start. */}
          <View style={{ alignItems: 'center' }}>
            <Button
              label={row.persona === 'parent' ? m.continueParent : m.continueTeacher}
              tone="ghost"
              size="md"
              disabled={disabled}
              accessibilityHint={hint}
              onPress={() => choose({ persona: row.persona, from: 'welcome-continue' })}
              testID="welcome-grown-ups-continue"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.someoneElse}
            onPress={() => setSomeoneElse(true)}
            testID="welcome-grown-ups-someone-else"
            style={{ minHeight: touchTarget.min, minWidth: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.sm }}
          >
            <Body weight="semibold" align="center" style={{ color: colors.brand.primaryDark, textDecorationLine: 'underline' }}>
              {m.someoneElse}
            </Body>
          </Pressable>
        </>
      )}
      {disabled ? (
        <Body tone="secondary" size="sm" align="center" testID="welcome-grown-ups-offline">
          {m.needsInternet}
        </Body>
      ) : null}
    </View>
  );
}
