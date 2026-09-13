// Sweetie 16 core plus kid-friendly names — must stay in sync with
// COLOR_NAMES in graphics/_color.py. PAL_NAMES contains one label per visible
// swatch; COLOR_ALIASES adds familiar spellings without duplicating swatches.
export const PAL_NAMES: Record<string, string> = {
  "#1a1c2c": "black",  "#5d275d": "wine",   "#b13e53": "red",   "#ef7d57": "orange",
  "#ffcd75": "yellow", "#a7f070": "lime",   "#38b764": "green", "#257179": "teal",
  "#29366f": "navy",   "#3b5dc9": "blue",   "#41a6f6": "sky",   "#73eff7": "cyan",
  "#f4f4f4": "white",  "#94b0c2": "silver", "#566c86": "gray",  "#333c57": "slate",
  "#a6533e": "brown",  "#8a4dc7": "purple", "#e66fa7": "pink",
};

export const COLOR_ALIASES: Record<string, string> = {
  grey: "#566c86",
  light_blue: "#41a6f6",
  dark_blue: "#29366f",
};

export const PALETTE_HEX = Object.keys(PAL_NAMES);
export const PALETTE_TITLES = PALETTE_HEX.map((hex) => {
  const names = [PAL_NAMES[hex], ...Object.entries(COLOR_ALIASES)
    .filter(([, aliasHex]) => aliasHex === hex)
    .map(([name]) => name)];
  return `${hex} — ${names.join(" / ")}`;
});

export const ALL_COLOR_NAMES = [
  ...Object.values(PAL_NAMES),
  ...Object.keys(COLOR_ALIASES),
];
