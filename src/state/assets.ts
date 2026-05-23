export type Category =
  | "Characters"
  | "Enemies"
  | "Vehicles"
  | "Tiles"
  | "Items"
  | "Hazards"
  | "Effects"
  | "Buildings";

export type Perspective = "side" | "top-down" | "any";

export type SpriteMeta = { category: Category; perspective: Perspective };

export const SPRITE_META: Record<string, SpriteMeta> = {
  // Characters
  hero:        { category: "Characters", perspective: "side" },
  hero_top:    { category: "Characters", perspective: "top-down" },
  player:      { category: "Characters", perspective: "side" },
  warrior:     { category: "Characters", perspective: "side" },
  miner:       { category: "Characters", perspective: "side" },
  fighter:     { category: "Characters", perspective: "side" },
  soldier:     { category: "Characters", perspective: "top-down" },
  cat:         { category: "Characters", perspective: "side" },
  robot:       { category: "Characters", perspective: "side" },
  ghost:       { category: "Characters", perspective: "any" },
  snake:       { category: "Characters", perspective: "side" },
  pac:         { category: "Characters", perspective: "any" },

  // Enemies
  bat:          { category: "Enemies", perspective: "side" },
  slime:        { category: "Enemies", perspective: "side" },
  skeleton:     { category: "Enemies", perspective: "side" },
  creature:     { category: "Enemies", perspective: "side" },
  snake_enemy:  { category: "Enemies", perspective: "side" },
  spider:       { category: "Enemies", perspective: "side" },
  alien:        { category: "Enemies", perspective: "side" },
  animal:       { category: "Enemies", perspective: "top-down" },
  boss_eye:     { category: "Enemies", perspective: "side" },
  bomber:       { category: "Enemies", perspective: "side" },
  fighter_enemy:{ category: "Enemies", perspective: "side" },
  swarm:        { category: "Enemies", perspective: "any" },
  ship_boss:    { category: "Enemies", perspective: "top-down" },
  ship_heavy:   { category: "Enemies", perspective: "top-down" },
  ship_scout:   { category: "Enemies", perspective: "top-down" },

  // Vehicles
  spaceship: { category: "Vehicles", perspective: "side" },
  rocket:    { category: "Vehicles", perspective: "side" },

  // Tiles
  tile_box:         { category: "Tiles", perspective: "side" },
  tile_coin_box:    { category: "Tiles", perspective: "side" },
  tile_dirt:        { category: "Tiles", perspective: "side" },
  tile_door_closed: { category: "Tiles", perspective: "side" },
  tile_door_open:   { category: "Tiles", perspective: "side" },
  tile_grass:       { category: "Tiles", perspective: "side" },
  tile_ladder:      { category: "Tiles", perspective: "side" },
  tile_lava:        { category: "Tiles", perspective: "side" },
  tile_sand:        { category: "Tiles", perspective: "side" },
  tile_snow:        { category: "Tiles", perspective: "side" },
  tile_stone:       { category: "Tiles", perspective: "side" },
  tile_torch:       { category: "Tiles", perspective: "side" },
  tile_water:       { category: "Tiles", perspective: "side" },
  tile_floor:       { category: "Tiles", perspective: "top-down" },
  tile_wall:        { category: "Tiles", perspective: "top-down" },
  tile_cave_dirt:   { category: "Tiles", perspective: "side" },
  tile_cave_floor:  { category: "Tiles", perspective: "side" },
  tile_cave_wall:   { category: "Tiles", perspective: "side" },
  bridge:           { category: "Tiles", perspective: "top-down" },
  rope:             { category: "Tiles", perspective: "side" },

  // Items
  coin:       { category: "Items", perspective: "any" },
  gem:        { category: "Items", perspective: "any" },
  cherry:     { category: "Items", perspective: "any" },
  star:       { category: "Items", perspective: "any" },
  mushroom:   { category: "Items", perspective: "side" },
  heart:      { category: "Items", perspective: "any" },
  block:      { category: "Items", perspective: "any" },
  bomb:       { category: "Items", perspective: "any" },
  potion:     { category: "Items", perspective: "side" },
  chest:      { category: "Items", perspective: "side" },
  idol:       { category: "Items", perspective: "side" },
  pot:        { category: "Items", perspective: "side" },
  sword:      { category: "Items", perspective: "side" },
  barrel:     { category: "Items", perspective: "any" },
  ore:        { category: "Items", perspective: "top-down" },
  flag:       { category: "Items", perspective: "side" },
  powerup:    { category: "Items", perspective: "any" },
  shield:     { category: "Items", perspective: "side" },
  stalactite: { category: "Items", perspective: "side" },

  // Hazards
  spike: { category: "Hazards", perspective: "side" },
  tree:  { category: "Hazards", perspective: "top-down" },

  // Effects
  explosion: { category: "Effects", perspective: "any" },
  particles: { category: "Effects", perspective: "any" },
  laser:     { category: "Effects", perspective: "side" },
  bullet:    { category: "Effects", perspective: "any" },
  asteroid:  { category: "Effects", perspective: "any" },
  missile:   { category: "Effects", perspective: "side" },
  orb:       { category: "Effects", perspective: "any" },
  wide_beam: { category: "Effects", perspective: "side" },

  // Buildings
  building_farm:      { category: "Buildings", perspective: "top-down" },
  building_barracks:  { category: "Buildings", perspective: "top-down" },
  building_workshop:  { category: "Buildings", perspective: "top-down" },
  building_mine:      { category: "Buildings", perspective: "top-down" },
  building_stockpile: { category: "Buildings", perspective: "top-down" },
};

export const PACK_ASSETS = import.meta.glob(
  "../assets/sprites/*.svg",
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

export function packAssetsByMeta(
  category?: Category,
  perspective?: Perspective,
): { name: string; url: string }[] {
  return PACK_ASSET_LIST.filter(({ name }) => {
    const meta = SPRITE_META[name];
    if (!meta) return false;
    if (category && meta.category !== category) return false;
    if (
      perspective &&
      perspective !== "any" &&
      meta.perspective !== perspective &&
      meta.perspective !== "any"
    )
      return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// === LIBRARY PACKS ===
// Asset packs exposed to Python as `assets.<packName>.<assetName>`. Always
// available, no per-project copy required. The runtime prefixes each loaded
// bitmap with `lib_<packName>_` so the worker can rebuild the namespace.

export type LibraryPack = {
  name: string;
  assets: { name: string; url: string }[];
};

export const LIBRARY_PACKS: LibraryPack[] = [
  {
    name: "platformer",
    assets: PACK_ASSET_LIST.filter(({ name }) => {
      const meta = SPRITE_META[name];
      if (!meta) return false;
      return meta.perspective === "side" || meta.perspective === "any";
    }).sort((a, b) => a.name.localeCompare(b.name)),
  },
];

export const LIBRARY_KEY_PREFIX = "lib_";

export function libraryKey(pack: string, name: string): string {
  return `${LIBRARY_KEY_PREFIX}${pack}_${name}`;
}

export function libraryUrlMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pack of LIBRARY_PACKS) {
    for (const { name, url } of pack.assets) {
      out[libraryKey(pack.name, name)] = url;
    }
  }
  return out;
}

// === SOUND LIBRARY PACK ===
// Built-in sounds exposed to Python as `assets.sounds.<name>`.
// Drop royalty-free clips anywhere under ../assets/sounds/ —
// they are picked up by basename (subdirectories are searched recursively).

const PACK_SOUND_FILES = import.meta.glob(
  "../assets/sounds/**/*.{mp3,ogg,wav}",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;

export const PACK_SOUND_LIST: { name: string; url: string }[] = Object.entries(
  PACK_SOUND_FILES,
).map(([path, url]) => ({
  name: path.split("/").pop()!.replace(/\.[^.]+$/, ""),
  url,
})).sort((a, b) => a.name.localeCompare(b.name));

export function librarySoundUrlMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, url } of PACK_SOUND_LIST) out[name] = url;
  return out;
}
