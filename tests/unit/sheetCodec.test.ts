import { describe, it, expect } from "@jest/globals";
import { encodeSheet, decodeSheet, DEFAULT_CHUNK_SIZE, SheetWire } from "../../src/state/sheetCodec";
import type { SheetData } from "../../src/state/IdeState";

function makeSheet(width: number, height: number, paint?: (px: Uint8ClampedArray) => void): SheetData {
  const buf = new Uint8ClampedArray(width * height * 4);
  paint?.(buf);
  // node-side base64 of a Uint8ClampedArray
  const pixels = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("base64");
  return { pixels, width, height, sprites: {} };
}

function readPixels(s: SheetData): Uint8Array {
  return Uint8Array.from(Buffer.from(s.pixels, "base64"));
}

describe("sheetCodec", () => {
  it("round-trips an empty sheet to zero chunks and back", () => {
    const sheet = makeSheet(64, 64);
    const wire = encodeSheet(sheet);
    expect(wire.chunks).toEqual([]);
    expect(wire.width).toBe(64);
    expect(wire.height).toBe(64);
    expect(wire.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
    const back = decodeSheet(wire)!;
    expect(readPixels(back)).toEqual(readPixels(sheet));
  });

  it("only emits chunks that contain non-zero bytes", () => {
    // 128x128 sheet with one pixel set at (40, 40) — should produce exactly one chunk
    // (the chunk at chunk-coord (32,32)).
    const sheet = makeSheet(128, 128, (buf) => {
      const i = (40 * 128 + 40) * 4;
      buf[i] = 255; buf[i + 1] = 100; buf[i + 2] = 50; buf[i + 3] = 255;
    });
    const wire = encodeSheet(sheet);
    expect(wire.chunks.length).toBe(1);
    expect(wire.chunks[0].x).toBe(32);
    expect(wire.chunks[0].y).toBe(32);
    const back = decodeSheet(wire)!;
    const px = readPixels(back);
    const i = (40 * 128 + 40) * 4;
    expect(Array.from(px.subarray(i, i + 4))).toEqual([255, 100, 50, 255]);
  });

  it("round-trips a full sheet (worst case) byte-for-byte", () => {
    const sheet = makeSheet(96, 96, (buf) => {
      for (let i = 0; i < buf.length; i++) buf[i] = (i * 31) & 0xff;
    });
    const wire = encodeSheet(sheet);
    expect(wire.chunks.length).toBe(9); // 3x3 grid at chunkSize 32
    const back = decodeSheet(wire)!;
    expect(readPixels(back)).toEqual(readPixels(sheet));
  });

  it("handles dimensions not divisible by chunk size (partial edge chunks)", () => {
    // 50x50 with chunkSize 32 -> chunks at (0,0), (32,0), (0,32), (32,32)
    // each edge chunk is 18 wide / 18 tall.
    const sheet = makeSheet(50, 50, (buf) => {
      // touch the far corner
      const i = (49 * 50 + 49) * 4;
      buf[i + 3] = 255;
    });
    const wire = encodeSheet(sheet);
    // only the bottom-right chunk is non-zero
    expect(wire.chunks).toHaveLength(1);
    expect(wire.chunks[0]).toMatchObject({ x: 32, y: 32 });
    const back = decodeSheet(wire)!;
    expect(back.width).toBe(50);
    expect(back.height).toBe(50);
    const px = readPixels(back);
    expect(px[(49 * 50 + 49) * 4 + 3]).toBe(255);
    // and pixel (0,0) is still zero
    expect(px[0]).toBe(0);
  });

  it("decodes legacy { pixels } shape unchanged", () => {
    const sheet = makeSheet(32, 32, (buf) => { buf[0] = 1; buf[3] = 255; });
    const decoded = decodeSheet(sheet as SheetData)!;
    expect(decoded.pixels).toBe(sheet.pixels);
    expect(decoded.width).toBe(32);
    expect(decoded.height).toBe(32);
  });

  it("returns undefined for undefined input", () => {
    expect(decodeSheet(undefined)).toBeUndefined();
  });

  it("achieves dramatic shrink on a typical sparse 512x512 sheet", () => {
    // 512x512 mostly empty, with three 32x32 sprite blocks
    const sheet = makeSheet(512, 512, (buf) => {
      const paintBlock = (x: number, y: number) => {
        for (let row = 0; row < 32; row++) {
          for (let col = 0; col < 32; col++) {
            const i = ((y + row) * 512 + (x + col)) * 4;
            buf[i] = 100; buf[i + 1] = 150; buf[i + 2] = 200; buf[i + 3] = 255;
          }
        }
      };
      paintBlock(0, 0);
      paintBlock(64, 64);
      paintBlock(256, 256);
    });
    const legacyBytes = JSON.stringify(sheet).length;
    const wire: SheetWire = encodeSheet(sheet);
    const wireBytes = JSON.stringify(wire).length;
    expect(wire.chunks).toHaveLength(3);
    // Expect at least 30x shrink from sparse encoding
    expect(wireBytes * 30).toBeLessThan(legacyBytes);
  });
});
