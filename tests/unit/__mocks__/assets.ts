export type Category = string;
export type Perspective = "side" | "top-down" | "any";
export type SpriteMeta = { category: Category; perspective: Perspective };
export const SPRITE_META: Record<string, SpriteMeta> = {};
export const PACK_ASSETS: Record<string, string> = {};
export const PACK_ASSET_LIST: { name: string; url: string }[] = [];
export function packAssetsByMeta() { return []; }
export type LibraryPack = { name: string; sprites: { name: string; url: string }[] };
export const LIBRARY_PACKS: LibraryPack[] = [];
export const LIBRARY_KEY_PREFIX = "lib_";
export function libraryKey(pack: string, name: string) { return `${pack}/${name}`; }
export function libraryUrlMap(): Record<string, string> { return {}; }
export const BUILTIN_SOUNDS: { name: string; url: string }[] = [];
export const PACK_SOUND_LIST = BUILTIN_SOUNDS;
export function librarySoundUrlMap(): Record<string, string> { return {}; }
