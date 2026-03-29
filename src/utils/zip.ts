import JSZip from "jszip";

export type StoredProject = {
  id: string;
  name: string;
  files: { name: string; content: string }[];
  assets: Record<string, Blob | Uint8Array | string>;
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
};

const FILES_DIR = "files/";
const ASSETS_DIR = "assets/";
const MANIFEST = "project.json";

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
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

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

function guessMimeByExt(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "json":
      return "application/json";
    case "txt":
    case "md":
      return "text/plain";
    default:
      return "application/octet-stream";
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

  const files: { name: string; content: string }[] = [];
  const fileEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(FILES_DIR)
  );
  for (const e of fileEntries) {
    const name = e.name.replace(/\\/g, "/").slice(FILES_DIR.length);
    const content = await e.async("string");
    files.push({ name, content });
  }

  const assets: Record<string, Blob> = {};
  const assetEntries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.replace(/\\/g, "/").startsWith(ASSETS_DIR)
  );
  for (const e of assetEntries) {
    const name = e.name.replace(/\\/g, "/").slice(ASSETS_DIR.length);
    const buf = await e.async("uint8array");
    const type = guessMimeByExt(name);
    // FIX: Convert Uint8Array to ArrayBuffer slice so it's a valid BlobPart across TS lib variants.
    assets[name] = new Blob([toArrayBuffer(buf)], { type });
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
  };
}

export async function downloadProjectZip(project: StoredProject, filename?: string) {
  const bytes = await projectToZip(project);
  // FIX: Convert Uint8Array to ArrayBuffer slice for Blob
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