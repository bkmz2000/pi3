import JSZip from "jszip";

// Local subset of IdeState types to avoid circular imports.
export type TilemapLayer = {
  name: string;
  tileSize: number;
  cells: Record<number, Record<number, string>>;
};
export type TilemapArea = {
  cells: Array<[number, number]>;
};
export type TilemapData = {
  layers: TilemapLayer[];
  areas?: Record<string, TilemapArea>;
};
export type SheetAnimationStrip = {
  x: number;
  y: number;
  frameW: number;
  frameH: number;
  frameCount: number;
  fps?: number;
};
export type SheetSpriteEntry = {
  animations: Record<string, SheetAnimationStrip>;
};
export type SheetSprites = Record<string, SheetSpriteEntry>;
export type SheetData = {
  pixels: string;
  width: number;
  height: number;
  sprites: SheetSprites;
};

export type StoredProject = {
  id: string;
  name: string;
  files: { name: string; content: string }[];
  assets: Record<string, Blob | Uint8Array | string>;
  tilemaps: Record<string, TilemapData>;
  sounds: Record<string, string>;
  sheet?: SheetData;
  updatedAt: string;
  currentFile?: string;
};

type ProjectManifest = {
  id: string;
  name: string;
  updatedAt: string;
  currentFile?: string;
  files: string[];
  assets: string[];
  tilemaps: string[];
  sounds: string[];
  sheet: boolean;
};

const FILES_DIR = "files/";
const ASSETS_DIR = "assets/";
const TILEMAPS_DIR = "tilemaps/";
const SOUNDS_DIR = "sounds/";
const SHEET_FILE = "sheet.json";
const MANIFEST = "project.json";

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

function dataURLToBlob(dataUrl: string): Blob {
  const [meta, content] = dataUrl.split(",", 2);
  const isBase64 = /;base64$/i.test(meta);
  const mime = meta.match(/data:(.*?)(;|$)/)?.[1] || "application/octet-stream";
  const bin = isBase64 ? atob(content) : decodeURIComponent(content);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function guessMimeByExt(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "json": return "application/json";
    case "mp3": case "mpeg": return "audio/mpeg";
    case "ogg": return "audio/ogg";
    case "wav": return "audio/wav";
    case "txt": case "md": return "text/plain";
    default: return "application/octet-stream";
  }
}

async function assetToBytes(asset: Blob | Uint8Array | string): Promise<Uint8Array> {
  if (asset instanceof Uint8Array) return asset;
  if (asset instanceof Blob) {
    const ab = await asset.arrayBuffer();
    return new Uint8Array(ab);
  }
  if (asset.startsWith?.("data:")) {
    const blob = dataURLToBlob(asset);
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }
  return textToBytes(asset);
}

export async function projectToZip(project: StoredProject): Promise<Uint8Array> {
  const zip = new JSZip();

  const manifest: ProjectManifest = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    currentFile: project.currentFile,
    files: project.files.map((f) => f.name),
    assets: Object.keys(project.assets || {}),
    tilemaps: Object.keys(project.tilemaps || {}),
    sounds: Object.keys(project.sounds || {}),
    sheet: !!project.sheet,
  };
  zip.file(MANIFEST, JSON.stringify(manifest, null, 2));

  for (const f of project.files) {
    const normalized = (FILES_DIR + f.name).replace(/^[\\/]+/, "").replace(/\\/g, "/");
    zip.file(normalized, textToBytes(f.content ?? ""), { binary: true, createFolders: true });
  }

  for (const [name, blobLike] of Object.entries(project.assets || {})) {
    const normalized = (ASSETS_DIR + name).replace(/^[\\/]+/, "").replace(/\\/g, "/");
    zip.file(normalized, await assetToBytes(blobLike), { binary: true, createFolders: true });
  }

  // Tilemaps
  for (const [name, data] of Object.entries(project.tilemaps || {})) {
    const normalized = TILEMAPS_DIR + name + ".json";
    zip.file(normalized, JSON.stringify(data), { createFolders: true });
  }

  // Sounds (URL/data-URL strings)
  for (const [name, url] of Object.entries(project.sounds || {})) {
    const normalized = SOUNDS_DIR + name;
    if (url.startsWith("data:")) {
      const blob = dataURLToBlob(url);
      zip.file(normalized, await blob.arrayBuffer(), { binary: true, createFolders: true });
    } else {
      // URL string — store as text reference (sounds don't round-trip perfectly without fetch)
      zip.file(normalized + ".url.txt", textToBytes(url), { createFolders: true });
    }
  }

  // Sheet
  if (project.sheet) {
    zip.file(SHEET_FILE, JSON.stringify(project.sheet));
  }

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return bytes;
}

export async function zipToProject(
  zipInput: ArrayBuffer | Uint8Array,
  defaults?: { id?: string; name?: string }
): Promise<StoredProject> {
  const zip = await JSZip.loadAsync(zipInput instanceof Uint8Array ? zipInput : new Uint8Array(zipInput));

  let manifest: ProjectManifest | null = null;
  const manifestFile = zip.file(MANIFEST);
  if (manifestFile) {
    try {
      const text = await manifestFile.async("string");
      manifest = JSON.parse(text) as ProjectManifest;
    } catch {
      manifest = null;
    }
  }

  // Files
  const files: { name: string; content: string }[] = [];
  const fileEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(FILES_DIR)
  );
  for (const e of fileEntries) {
    const name = e.name.replace(/\\/g, "/").slice(FILES_DIR.length);
    const content = await e.async("string");
    files.push({ name, content });
  }

  // Assets
  const assets: Record<string, Blob> = {};
  const assetEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(ASSETS_DIR)
  );
  for (const e of assetEntries) {
    const name = e.name.replace(/\\/g, "/").slice(ASSETS_DIR.length);
    const buf = await e.async("uint8array");
    const type = guessMimeByExt(name);
    assets[name] = new Blob([toArrayBuffer(buf)], { type });
  }

  // Tilemaps
  const tilemaps: Record<string, TilemapData> = {};
  const tilemapEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(TILEMAPS_DIR) && e.name.endsWith(".json")
  );
  for (const e of tilemapEntries) {
    const name = e.name.replace(/\\/g, "/").slice(TILEMAPS_DIR.length).replace(/\.json$/, "");
    try {
      const text = await e.async("string");
      tilemaps[name] = JSON.parse(text) as TilemapData;
    } catch { /* skip corrupt tilemap */ }
  }

  // Sounds
  const sounds: Record<string, string> = {};
  const soundEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(SOUNDS_DIR) && !e.name.endsWith(".url.txt")
  );
  for (const e of soundEntries) {
    const name = e.name.replace(/\\/g, "/").slice(SOUNDS_DIR.length);
    const buf = await e.async("uint8array");
    const type = guessMimeByExt(name);
    const blob = new Blob([toArrayBuffer(buf)], { type });
    sounds[name] = URL.createObjectURL(blob);
  }

  // Sheet
  let sheet: SheetData | undefined;
  const sheetFile = zip.file(SHEET_FILE);
  if (sheetFile) {
    try {
      const text = await sheetFile.async("string");
      sheet = JSON.parse(text) as SheetData;
    } catch { /* skip corrupt sheet */ }
  }

  const id =
    manifest?.id ??
    defaults?.id ??
    `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const name = manifest?.name ?? defaults?.name ?? "Untitled Project";
  const updatedAt = manifest?.updatedAt ?? new Date().toISOString();
  const currentFile =
    manifest?.currentFile && files.some((f) => f.name === manifest!.currentFile)
      ? manifest.currentFile
      : files[0]?.name ?? "";

  return {
    id,
    name,
    updatedAt,
    currentFile,
    files,
    assets,
    tilemaps,
    sounds,
    sheet,
  };
}

export async function downloadProjectZip(project: StoredProject, filename?: string) {
  const bytes = await projectToZip(project);
  const blob = new Blob([toArrayBuffer(bytes)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${safeFilename(project.name)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importProjectFromFile(file: File, defaults?: { id?: string; name?: string }) {
  const ab = await file.arrayBuffer();
  return await zipToProject(ab, defaults ?? { name: file.name.replace(/\.zip$/i, "") });
}

function safeFilename(name: string) {
  return name.replace(/[^\w.-]+/g, "_");
}
