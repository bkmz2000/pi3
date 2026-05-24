import { useMemo } from 'react';
import avatar from 'animal-avatar-generator';
import { useThemeStore } from '../../state/useTheme';

interface HandleAvatarProps {
  /** Stable identity seed — pass the handle, falling back to display name. */
  seed: string;
  size?: number;
  /** Override default themed palette. */
  avatarColors?: string[];
  backgroundColors?: string[];
  /** Right-half darkening overlay. Defaults to off for a flatter sticker look. */
  blackout?: boolean;
  round?: boolean;
}

/**
 * Stable handle-derived animal avatar. The same seed always renders the same
 * SVG, so the avatar acts as a visual fingerprint of the user across the app.
 */
export function HandleAvatar({
  seed,
  size = 32,
  avatarColors,
  backgroundColors,
  blackout = false,
  round = true,
}: HandleAvatarProps) {
  const theme = useThemeStore((s) => s.theme);

  // Library's playful pastels for the creature; app-themed darker discs so the
  // avatars sit against the UI without looking like a third-party widget.
  const palette = avatarColors ?? ['#d7b89c', '#b18272', '#ec8a90', '#a1Ac88', '#99c9bd', '#50c8c6', '#e7c382'];
  const bgPalette = backgroundColors ?? [theme.chip, theme.surfacePanel, theme.panelHeader];
  const paletteKey = palette.join('|');
  const bgPaletteKey = bgPalette.join('|');

  const svg = useMemo(
    () => avatar(seed || '?', { size, avatarColors: palette, backgroundColors: bgPalette, blackout, round }),
    // Re-render when theme tokens change (theme switch) so palette updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, size, blackout, round, paletteKey, bgPaletteKey],
  );

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
