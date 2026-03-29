export const PACK_ASSETS = import.meta.glob(
  "../assets/sprites/**/*.{png,jpg,gif,webp,svg}",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;

export const PACK_ASSET_LIST: { name: string; url: string }[] = Object.entries(
  PACK_ASSETS,
).map(([path, url]) => ({
  name: path
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, ""),
  url,
}));
