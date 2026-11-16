import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * AMENDMENTS-AUDIT-2026-11 AU-17e (audit A11Y-4, WCAG 1.4.11): the boundary of a text field is `border.shape` (4.55:1 on
 * paper, 3.84:1 on sunken), never `border.subtle` (1.32:1) and never the amber nudge (1.86:1). A field that needs
 * another look keeps the border and thickens it (F-AUTH-004 D5). Scanned in the source, so a new field cannot bring
 * the faint border back.
 */
const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

/** Each `<TextInput ... />` element of a file, as written (never the `TextInput` type in a generic). */
function textInputs(source: string): string[] {
  return [...source.matchAll(/<TextInput\s+[A-Za-z{]/g)].map((m) => {
    const end = source.indexOf('/>', m.index);
    return source.slice(m.index, end === -1 ? undefined : end + 2);
  });
}

const files = sources(srcDir)
  .map((path) => ({ name: relative(srcDir, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .filter((file) => textInputs(file.source).length > 0);

describe('text field boundaries (AU-17e)', () => {
  it('finds the text fields of the app', () => {
    expect(files.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        'screens/onboarding/CreateProfileScreen.tsx',
        'screens/profile/EditProfileScreen.tsx',
        'screens/sync/JoinNameField.tsx',
        'screens/sync/JoinSpaceScreen.tsx',
        'screens/sync/RestoreScreen.tsx',
        'screens/parent/PinResetScreen.tsx',
        'screens/transfer/MoveClassScreen.tsx',
      ]),
    );
  });

  it.each(files.map((f) => [f.name, f.source] as const))('%s: no text field is outlined in border.subtle or in the amber nudge', (_name, source) => {
    const fields = textInputs(source);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field).not.toMatch(/colors\.border\.subtle/);
      expect(field).not.toMatch(/border\w*Color:[^,\n]*colors\.feedback\.nudge/);
      // A field that names its border colour inline names border.shape; one styled by a helper is checked below.
      for (const [, value] of field.matchAll(/borderColor:\s*([^,\n]+)/g)) expect(value).toBe('colors.border.shape');
    }
  });

  it('CreateProfile: the shared field style is border.shape, thicker when the field needs another look, never amber', () => {
    const source = files.find((f) => f.name === 'screens/onboarding/CreateProfileScreen.tsx')!.source;
    const style = source.slice(source.indexOf('const fieldStyle'), source.indexOf('as const', source.indexOf('const fieldStyle')));
    expect(style).toContain('borderColor: colors.border.shape');
    expect(style).toContain('borderWidth: invalid ? borderWidth.thick : borderWidth.base');
    for (const field of textInputs(source)) expect(field).toMatch(/style=\{fieldStyle\(textScale\.size\.bodyLg(, !emailOk)?\)\}/);
  });
});
