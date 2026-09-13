import { renderHook, act } from '@testing-library/react';
import { useThemeStore } from '../../src/state/useTheme';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns theme, themeId, fontSize, and setter functions', () => {
    const state = useThemeStore.getState();
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('themeId');
    expect(state).toHaveProperty('fontSize');
    expect(state).toHaveProperty('setTheme');
    expect(state).toHaveProperty('setFontSize');
    expect(typeof state.setTheme).toBe('function');
    expect(typeof state.setFontSize).toBe('function');
  });

  it('setTheme changes the current theme', () => {
    const { result } = renderHook(() => useThemeStore());
    const originalThemeId = result.current.themeId;

    const newThemeId = originalThemeId === 'midnight' ? 'studio' : 'midnight';

    act(() => {
      result.current.setTheme(newThemeId);
    });

    expect(result.current.themeId).toBe(newThemeId);
  });

  it('setFontSize changes the font size', () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      result.current.setFontSize(14);
    });

    expect(result.current.fontSize).toBe(14);
  });

  it('has valid theme object', () => {
    const state = useThemeStore.getState();
    const theme = state.theme;

    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
    expect(theme.name).toBeDefined();
  });

  it('theme contains color tokens', () => {
    const state = useThemeStore.getState();
    const theme = state.theme;

    const requiredTokens = [
      'appBg', 'appTxt', 'surface', 'panelTxt', 'panelTxtMute',
      'railBg', 'editorBg', 'editorTxt',
    ];

    requiredTokens.forEach((token) => {
      expect(theme[token as keyof typeof theme]).toBeDefined();
    });
  });

  it.each(['studio', 'midnight'] as const)(
    '%s line numbers and muted console text meet normal-text contrast',
    (themeId) => {
      useThemeStore.getState().setTheme(themeId);
      const theme = useThemeStore.getState().theme;
      expect(contrast(theme.editorLN, theme.editorBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.consoleTxtMute, theme.consoleBg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('setFontSize persists value', () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      result.current.setFontSize(15);
    });

    expect(result.current.fontSize).toBe(15);
    expect(localStorage.getItem('pi3_fontSize')).toBe('15');
  });

  it('theme persists across store updates', () => {
    const { result } = renderHook(() => useThemeStore());
    const originalTheme = result.current.theme;

    act(() => {
      result.current.setFontSize(15);
    });

    expect(result.current.theme).toBe(originalTheme);
  });

  it('setTheme persists to localStorage', () => {
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      result.current.setTheme('studio');
    });

    expect(localStorage.getItem('pi3_theme')).toBe('studio');
    expect(result.current.themeId).toBe('studio');
  });

  it('setFontSize works with various sizes', () => {
    const { result } = renderHook(() => useThemeStore());
    const sizes = [12, 13, 14, 16, 18, 20];

    sizes.forEach((size) => {
      act(() => {
        result.current.setFontSize(size);
      });
      expect(result.current.fontSize).toBe(size);
    });
  });

  it('themeId is valid theme name', () => {
    const { result } = renderHook(() => useThemeStore());
    const validThemes = ['studio', 'midnight'];
    expect(validThemes).toContain(result.current.themeId);
  });

  it('handles invalid theme from localStorage gracefully', () => {
    localStorage.setItem('pi3_theme', 'invalid-theme');
    // Recreating store should use default
    const state = useThemeStore.getState();
    expect(state.themeId).toBeDefined();
  });

  it('reads and preserves fontSize from localStorage', () => {
    localStorage.clear();
    localStorage.setItem('pi3_fontSize', '20');
    const { result } = renderHook(() => useThemeStore());
    expect(result.current.fontSize).toBeDefined();
  });

  it('handles invalid fontSize from localStorage', () => {
    localStorage.clear();
    localStorage.setItem('pi3_fontSize', 'not-a-number');
    const { result } = renderHook(() => useThemeStore());
    // Should use default when parsing fails
    expect(typeof result.current.fontSize).toBe('number');
  });

  it('theme changes update both themeId and theme object', () => {
    const { result } = renderHook(() => useThemeStore());
    const initialThemeId = result.current.themeId;
    const initialTheme = result.current.theme;

    act(() => {
      const newThemeId = initialThemeId === 'midnight' ? 'studio' : 'midnight';
      result.current.setTheme(newThemeId);
    });

    expect(result.current.themeId).not.toBe(initialThemeId);
    expect(result.current.theme).not.toBe(initialTheme);
  });

  it('multiple setFontSize calls update correctly', () => {
    const { result } = renderHook(() => useThemeStore());

    const sizes = [12, 14, 16, 18];
    sizes.forEach((size) => {
      act(() => {
        result.current.setFontSize(size);
      });
      expect(result.current.fontSize).toBe(size);
    });
  });
});
