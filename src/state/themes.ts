// Graphics theme palettes — mirror of THEMES_DATA in
// src/assets/python/graphics/__init__.py. Keep both in sync.
// The sprite-editor swatch picker and the project-metadata theme persist
// from this list.

export type ThemeRgb = [number, number, number];

export type GraphicsTheme = {
  name: string;
  palette: Record<string, ThemeRgb>;
  ambient: ThemeRgb;
  light_shade: ThemeRgb;
};

export const GRAPHICS_THEMES: Record<string, GraphicsTheme> = {
  default: {
    name: "default",
    palette: {
      red:    [220,  60,  60],
      green:  [ 50, 200,  80],
      blue:   [ 60, 120, 255],
      yellow: [255, 220,  40],
      orange: [255, 140,  40],
      purple: [180,  80, 220],
      pink:   [255, 130, 180],
      cyan:   [ 40, 210, 220],
      white:  [255, 255, 255],
      black:  [  0,   0,   0],
      gray:   [150, 150, 150],
      brown:  [160,  90,  40],
    },
    ambient: [255, 255, 255],
    light_shade: [255, 255, 255],
  },
  summer: {
    name: "summer",
    palette: {
      red:    [255,  95,  60],
      green:  [120, 220,  80],
      blue:   [ 90, 170, 255],
      yellow: [255, 230,  80],
      orange: [255, 165,  60],
      purple: [200, 120, 230],
      pink:   [255, 165, 200],
      cyan:   [ 80, 230, 230],
      white:  [255, 250, 230],
      black:  [ 40,  30,  20],
      gray:   [180, 170, 140],
      brown:  [180, 110,  60],
    },
    ambient: [220, 210, 180],
    light_shade: [255, 230, 180],
  },
  dungeon: {
    name: "dungeon",
    palette: {
      red:    [180,  40,  40],
      green:  [ 60, 140,  60],
      blue:   [ 40,  80, 160],
      yellow: [200, 170,  40],
      orange: [200, 100,  40],
      purple: [120,  60, 160],
      pink:   [180,  90, 130],
      cyan:   [ 40, 160, 170],
      white:  [200, 200, 210],
      black:  [ 10,  10,  15],
      gray:   [ 90,  90, 100],
      brown:  [110,  70,  40],
    },
    ambient: [35, 30, 50],
    light_shade: [255, 180, 110],
  },
  moonlit: {
    name: "moonlit",
    palette: {
      red:    [200,  80,  90],
      green:  [100, 180, 140],
      blue:   [110, 150, 220],
      yellow: [230, 220, 160],
      orange: [220, 160, 100],
      purple: [180, 140, 220],
      pink:   [220, 170, 200],
      cyan:   [140, 200, 220],
      white:  [220, 230, 255],
      black:  [ 10,  15,  30],
      gray:   [120, 130, 160],
      brown:  [120,  90,  80],
    },
    ambient: [60, 70, 110],
    light_shade: [190, 210, 255],
  },
};

export const DEFAULT_THEME = "default";

export function resolveTheme(name: string | undefined): GraphicsTheme {
  if (!name) return GRAPHICS_THEMES[DEFAULT_THEME];
  const t = GRAPHICS_THEMES[name];
  if (t) return t;
  console.warn(`Unknown graphics theme "${name}"; falling back to "${DEFAULT_THEME}".`);
  return GRAPHICS_THEMES[DEFAULT_THEME];
}

function rgbToHex([r, g, b]: ThemeRgb): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Returns a hex color for a swatch name, themed if the name is in the theme's
// palette. Names not in the palette pass through unchanged so the sprite
// editor's full 24-color palette still works.
export function themedSwatchHex(themeName: string | undefined, swatchName: string, originalHex: string): string {
  const t = resolveTheme(themeName);
  const rgb = t.palette[swatchName];
  return rgb ? rgbToHex(rgb) : originalHex;
}
