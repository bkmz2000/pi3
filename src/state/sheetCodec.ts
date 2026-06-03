// Sheet serialization codec.
//
// In memory we keep the sheet as a single base64'd flat RGBA buffer because
// every consumer (editor, worker, project explorer, exporter) treats pixels
// as a contiguous `Uint8ClampedArray`. On the wire we slice it into fixed
// chunks and drop any chunk whose bytes are all zero. A typical 512x512
// sheet has 8-20 occupied 32x32 chunks out of 256 total — an order of
// magnitude smaller before any transport compression on top.
//
// Decoder accepts the legacy `{ pixels }` shape too so saved rows from
// before this change keep loading until they get re-saved into the new
// format naturally.

import type { SheetData, SheetSprites } from "./IdeState";

export const DEFAULT_CHUNK_SIZE = 32;

export interface SheetChunk {
  x: number;
  y: number;
  data: string;
}

export interface SheetWire {
  width: number;
  height: number;
  chunkSize: number;
  chunks: SheetChunk[];
  sprites: SheetSprites;
}

// Legacy on-wire shape, identical to in-memory SheetData.
interface SheetLegacy {
  pixels: string;
  width: number;
  height: number;
  sprites: SheetSprites;
}

function isWireShape(s: unknown): s is SheetWire {
  return !!s && typeof s === "object" && Array.isArray((s as { chunks?: unknown }).chunks);
}

function decodeBase64(b64: string): Uint8Array {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function encodeBase64(buf: Uint8Array): string {
  // Chunked to avoid call-stack limits on big buffers (~1MB+).
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, Math.min(i + CHUNK, buf.length)));
  }
  return btoa(s);
}

function isAllZero(buf: Uint8Array): boolean {
  for (let i = 0; i < buf.length; i++) if (buf[i] !== 0) return false;
  return true;
}

export function encodeSheet(sheet: SheetData, chunkSize: number = DEFAULT_CHUNK_SIZE): SheetWire {
  const { width, height, sprites } = sheet;
  const pixels = decodeBase64(sheet.pixels);
  const chunks: SheetChunk[] = [];
  for (let cy = 0; cy < height; cy += chunkSize) {
    const ch = Math.min(chunkSize, height - cy);
    for (let cx = 0; cx < width; cx += chunkSize) {
      const cw = Math.min(chunkSize, width - cx);
      const chunkBuf = new Uint8Array(cw * ch * 4);
      for (let row = 0; row < ch; row++) {
        const srcOffset = ((cy + row) * width + cx) * 4;
        chunkBuf.set(pixels.subarray(srcOffset, srcOffset + cw * 4), row * cw * 4);
      }
      if (!isAllZero(chunkBuf)) {
        chunks.push({ x: cx, y: cy, data: encodeBase64(chunkBuf) });
      }
    }
  }
  return { width, height, chunkSize, chunks, sprites };
}

export function decodeSheet(input: SheetWire | SheetLegacy | SheetData | undefined): SheetData | undefined {
  if (!input) return undefined;
  if (!isWireShape(input)) {
    // Legacy single-buffer shape — pass through. Same field set as SheetData.
    const legacy = input as SheetLegacy;
    return {
      pixels: legacy.pixels,
      width: legacy.width,
      height: legacy.height,
      sprites: legacy.sprites,
    };
  }
  const { width, height, chunkSize, chunks, sprites } = input;
  const buf = new Uint8Array(width * height * 4);
  for (const chunk of chunks) {
    const cw = Math.min(chunkSize, width - chunk.x);
    const ch = Math.min(chunkSize, height - chunk.y);
    const chunkBuf = decodeBase64(chunk.data);
    for (let row = 0; row < ch; row++) {
      const dstOffset = ((chunk.y + row) * width + chunk.x) * 4;
      buf.set(chunkBuf.subarray(row * cw * 4, (row + 1) * cw * 4), dstOffset);
    }
  }
  return { pixels: encodeBase64(buf), width, height, sprites };
}
