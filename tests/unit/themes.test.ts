/**
 * Tests for the graphics theme system on the TS side: the THEMES_DATA mirror,
 * the swatch hex helper used by the sprite editor, and the project-metadata
 * persistence in IdeState.
 *
 * These cover the spec scenarios from graphics-color-themes:
 *   - "Switching theme swaps swatches non-destructively"
 *   - "Theme selection survives reload"
 *   - "Importing a project with a missing theme name"
 */

import { GRAPHICS_THEMES, DEFAULT_THEME, resolveTheme, themedSwatchHex } from '../../src/state/themes';
import { toEditorProject } from '../../src/state/projectNormalization';
import type { Project as ApiProject } from '../../src/state/api';

describe('GRAPHICS_THEMES mirror', () => {
  it('declares the four expected themes', () => {
    expect(Object.keys(GRAPHICS_THEMES).sort()).toEqual(
      ['default', 'dungeon', 'moonlit', 'summer'],
    );
  });

  it('every theme covers the same palette color names', () => {
    const baseNames = Object.keys(GRAPHICS_THEMES.default.palette).sort();
    for (const theme of Object.values(GRAPHICS_THEMES)) {
      expect(Object.keys(theme.palette).sort()).toEqual(baseNames);
    }
  });

  it('each theme exposes ambient and light_shade triples', () => {
    for (const theme of Object.values(GRAPHICS_THEMES)) {
      expect(theme.ambient).toHaveLength(3);
      expect(theme.light_shade).toHaveLength(3);
    }
  });

  it('Themes.dungeon.green differs from Themes.summer.green', () => {
    expect(GRAPHICS_THEMES.dungeon.palette.green).not.toEqual(
      GRAPHICS_THEMES.summer.palette.green,
    );
  });
});

describe('resolveTheme fallback', () => {
  it('returns the named theme when present', () => {
    expect(resolveTheme('dungeon')).toBe(GRAPHICS_THEMES.dungeon);
  });

  it('falls back to default and warns on unknown name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const t = resolveTheme('atlantis');
    expect(t).toBe(GRAPHICS_THEMES[DEFAULT_THEME]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('atlantis'));
    warn.mockRestore();
  });

  it('returns the default theme for undefined', () => {
    expect(resolveTheme(undefined)).toBe(GRAPHICS_THEMES[DEFAULT_THEME]);
  });
});

describe('themedSwatchHex', () => {
  it('returns themed hex for swatch names matching the palette', () => {
    // dungeon.green is (60,140,60) per THEMES_DATA mirror
    expect(themedSwatchHex('dungeon', 'green', '#008000')).toBe('#3c8c3c');
  });

  it('passes non-themed swatch names through unchanged', () => {
    // "indigo" isn't in any theme's palette
    expect(themedSwatchHex('dungeon', 'indigo', '#4b0082')).toBe('#4b0082');
  });

  it('default theme matches Colors RGB (no surprise tinting)', () => {
    // default.red == (220,60,60) — dc3c3c
    expect(themedSwatchHex('default', 'red', '#ff0000')).toBe('#dc3c3c');
  });
});

describe('toEditorProject — theme survives normalization', () => {
  const baseApi = (overrides: Partial<ApiProject> = {}): ApiProject => ({
    id: 'proj-x',
    name: 'X',
    description: null,
    is_public: 0,
    user_id: 'u',
    role: 'owner',
    files: {},
    assets: {},
    tilemaps: {},
    animations: {},
    current_file: 'main.py',
    created_at: 0,
    updated_at: 0,
    ...overrides,
  });

  it('preserves the saved theme name through the API→editor adapter', () => {
    const api = baseApi({ theme: 'dungeon' });
    expect(toEditorProject(api).theme).toBe('dungeon');
  });

  it('leaves theme undefined when API project omits it (legacy save)', () => {
    expect(toEditorProject(baseApi()).theme).toBeUndefined();
  });
});
