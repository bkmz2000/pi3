// JS-side draw-command dispatcher. Kept free of import.meta / worker-only APIs
// so it can be imported by jest without pulling in the Pyodide loader.

function lookupAsset(assets: Record<string, ImageBitmap>, name: string): ImageBitmap | undefined {
  return assets[name] ?? assets[name + ".png"] ?? assets[name + ".svg"];
}

function drawSay(
  ctx: OffscreenCanvasRenderingContext2D,
  s: string,
  ax: number,
  ay: number,
  hAlign: string,
  vAlign: string,
  padding: number,
) {
  let metrics: TextMetrics;
  try {
    metrics = ctx.measureText(s);
  } catch {
    metrics = { width: s.length * 9 } as TextMetrics;
  }
  const textW = metrics.width;

  let fontSize = 16;
  try {
    const fontPart = ctx.font.trim().split("px")[0].trim().split(/\s+/).pop()!;
    fontSize = parseFloat(fontPart) || 16;
  } catch {
    /* use default */
  }

  const textH = fontSize;
  const bubbleW = textW + 2 * padding;
  const bubbleH = textH + 2 * padding;
  const tail = Math.min(10, padding + 2);
  const cornerR = 6;

  let bx: number;
  if (hAlign === "left") bx = ax;
  else if (hAlign === "right") bx = ax - bubbleW;
  else bx = ax - bubbleW / 2;

  let by: number;
  let tailPts: [number, number][];
  if (vAlign === "bottom") {
    by = ay - bubbleH - tail;
    const mid = bx + bubbleW / 2;
    tailPts = [[mid, ay], [mid - tail / 2, by + bubbleH], [mid + tail / 2, by + bubbleH]];
  } else if (vAlign === "top") {
    by = ay + tail;
    const mid = bx + bubbleW / 2;
    tailPts = [[mid, ay], [mid - tail / 2, by], [mid + tail / 2, by]];
  } else {
    by = ay - bubbleH / 2;
    if (hAlign === "left") {
      bx = ax + tail;
      tailPts = [[ax, ay], [bx, ay - tail / 2], [bx, ay + tail / 2]];
    } else {
      bx = ax - bubbleW - tail;
      tailPts = [[ax, ay], [ax - tail, ay - tail / 2], [ax - tail, ay + tail / 2]];
    }
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.strokeStyle = "rgba(0,0,0,0)";

  ctx.beginPath();
  ctx.moveTo(tailPts[0][0], tailPts[0][1]);
  ctx.lineTo(tailPts[1][0], tailPts[1][1]);
  ctx.lineTo(tailPts[2][0], tailPts[2][1]);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  const ctxExt = ctx as OffscreenCanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
  if (ctxExt.roundRect) {
    ctxExt.roundRect(bx, by, bubbleW, bubbleH, cornerR);
  } else {
    ctx.rect(bx, by, bubbleW, bubbleH);
  }
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s, bx + padding, by + bubbleH / 2);
  ctx.restore();
}

// --- Lightmap overlay state ---

let lightmap: OffscreenCanvas | null = null;

function getLightmap(canvasW: number, canvasH: number): OffscreenCanvas {
  if (!lightmap || lightmap.width !== canvasW || lightmap.height !== canvasH) {
    lightmap = new OffscreenCanvas(canvasW, canvasH);
  }
  return lightmap;
}

export function executeDrawCommands(
  ctx: OffscreenCanvasRenderingContext2D,
  commands: unknown[],
  assets: Record<string, ImageBitmap>,
  canvasW: number,
  canvasH: number,
) {
  ctx.imageSmoothingEnabled = false;
  for (const entry of commands) {
    const [cmd, args] = entry as [string, unknown[]];
    switch (cmd) {
      case "background": {
        const [r, g, b] = args as [number, number, number];
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.restore();
        break;
      }
      case "background_image": {
        const [name] = args as [string];
        const bm = assets[name];
        if (!bm) break;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bm, 0, 0, canvasW, canvasH);
        ctx.restore();
        break;
      }
      case "circle": {
        const [x, y, r] = args as [number, number, number];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "ellipse": {
        const [x, y, w, h] = args as [number, number, number, number];
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "rect": {
        const [x, y, w, h] = args as [number, number, number, number];
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "line": {
        const [x1, y1, x2, y2] = args as [number, number, number, number];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      }
      case "point": {
        const [x, y] = args as [number, number];
        ctx.beginPath();
        ctx.arc(x, y, Math.max(ctx.lineWidth / 2, 1), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "text": {
        const [s, x, y] = args as [string, number, number];
        ctx.fillText(String(s), x, y);
        break;
      }
      case "text_size": {
        const [n] = args as [number];
        ctx.font = `${n}px sans-serif`;
        break;
      }
      case "text_align": {
        const [h, v] = args as [CanvasTextAlign, CanvasTextBaseline | null];
        ctx.textAlign = h;
        if (v) ctx.textBaseline = v;
        break;
      }
      case "fill": {
        const [r, g, b] = args as [number, number, number];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        break;
      }
      case "no_fill": {
        ctx.fillStyle = "rgba(0,0,0,0)";
        break;
      }
      case "stroke": {
        const [r, g, b] = args as [number, number, number];
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        break;
      }
      case "no_stroke": {
        ctx.strokeStyle = "rgba(0,0,0,0)";
        break;
      }
      case "stroke_width": {
        const [w] = args as [number];
        ctx.lineWidth = w;
        break;
      }
      case "push": {
        ctx.save();
        break;
      }
      case "pop": {
        ctx.restore();
        break;
      }
      case "translate": {
        const [x, y] = args as [number, number];
        ctx.translate(x, y);
        break;
      }
      case "rotate": {
        const [deg] = args as [number];
        ctx.rotate((deg * Math.PI) / 180);
        break;
      }
      case "scale": {
        const [sx, sy] = args as [number, number];
        ctx.scale(sx, sy);
        break;
      }
      case "image": {
        const [name, x, y, w, h] = args as [string, number, number, number | null, number | null];
        const bm = lookupAsset(assets, name);
        if (!bm) break;
        if (w != null) ctx.drawImage(bm, x, y, w, h ?? w);
        else ctx.drawImage(bm, x, y);
        break;
      }
      case "image_centered": {
        const [name, x, y, w, h] = args as [string, number, number, number | null, number | null];
        const bm = lookupAsset(assets, name);
        if (!bm) break;
        const dw = w ?? bm.width;
        const dh = h ?? bm.height;
        ctx.drawImage(bm, x - dw / 2, y - dh / 2, dw, dh);
        break;
      }
      case "sprite": {
        // Python-side Sprite: raw RGBA bytes drawn through a temp OffscreenCanvas
        // so the active transform (Camera, push/pop, scale, rotate) still applies.
        const [pixels, sw, sh, x, y, w, h] = args as [
          Uint8Array | Uint8ClampedArray,
          number,
          number,
          number,
          number,
          number | null,
          number | null,
        ];
        if (!pixels || sw <= 0 || sh <= 0) break;
        if (pixels.byteLength !== sw * sh * 4) break;
        // Copy into a fresh ArrayBuffer-backed Uint8ClampedArray so the
        // typing matches ImageData (which rejects SharedArrayBuffer views) and
        // the renderer owns the memory after Python frees it.
        const clamped = new Uint8ClampedArray(sw * sh * 4);
        clamped.set(pixels);
        const imageData = new ImageData(clamped, sw, sh);
        const off = new OffscreenCanvas(sw, sh);
        off.getContext("2d")!.putImageData(imageData, 0, 0);
        if (w != null) ctx.drawImage(off, x, y, w, h ?? w);
        else ctx.drawImage(off, x, y);
        break;
      }
      case "tilemap_layer": {
        const [cellsFlat, tileSize, ox, oy] = args as [Array<[number, number, string, number?]>, number, number, number];
        // Cull against the current transform's visible world rect (handles Camera translate/scale).
        const t = ctx.getTransform();
        const sx0 = t.a !== 0 ? -t.e / t.a : 0;
        const sy0 = t.d !== 0 ? -t.f / t.d : 0;
        const viewLeft = sx0 - ox;
        const viewTop = sy0 - oy;
        const viewRight = viewLeft + (t.a !== 0 ? canvasW / t.a : canvasW);
        const viewBottom = viewTop + (t.d !== 0 ? canvasH / t.d : canvasH);
        for (const cell of cellsFlat) {
          const col = cell[0];
          const row = cell[1];
          const name = cell[2];
          const rotation = cell[3] ?? 0;
          const wx = col * tileSize;
          const wy = row * tileSize;
          if (wx + tileSize <= viewLeft || wx >= viewRight || wy + tileSize <= viewTop || wy >= viewBottom) continue;
          const bm = lookupAsset(assets, name);
          if (!bm) continue;
          if (rotation) {
            const cx = ox + wx + tileSize / 2;
            const cy = oy + wy + tileSize / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(bm, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
            ctx.restore();
          } else {
            ctx.drawImage(bm, ox + wx, oy + wy, tileSize, tileSize);
          }
        }
        break;
      }
      case "say": {
        const [s, ax, ay, hAlign, vAlign, padding] = args as [string, number, number, string, string, number];
        drawSay(ctx, s, ax, ay, hAlign, vAlign, padding);
        break;
      }
      case "light_begin": {
        const [r, g, b] = args as [number, number, number];
        const lm = getLightmap(canvasW, canvasH);
        const lctx = lm.getContext("2d");
        if (!lctx) break;
        lctx.save();
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.globalCompositeOperation = "source-over";
        lctx.fillStyle = `rgb(${r},${g},${b})`;
        lctx.fillRect(0, 0, canvasW, canvasH);
        lctx.restore();
        break;
      }
      case "light_poly": {
        const [poly, sx, sy, radius, shadeRgb, intensity] = args as [
          number[], number, number, number, [number, number, number], number,
        ];
        if (!lightmap) break;
        const lctx = lightmap.getContext("2d");
        if (!lctx) break;
        lctx.save();
        // Mirror the main ctx's transform so polygon coords (world space) line up.
        const t = ctx.getTransform();
        lctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
        lctx.globalCompositeOperation = "lighter";
        lctx.beginPath();
        if (poly.length >= 2) {
          lctx.moveTo(poly[0], poly[1]);
          for (let i = 2; i < poly.length; i += 2) {
            lctx.lineTo(poly[i], poly[i + 1]);
          }
          lctx.closePath();
          lctx.clip();
        }
        const [sr, sg, sb] = shadeRgb;
        const ir = Math.max(0, Math.min(255, Math.round(sr * intensity)));
        const ig = Math.max(0, Math.min(255, Math.round(sg * intensity)));
        const ib = Math.max(0, Math.min(255, Math.round(sb * intensity)));
        const grad = lctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(1, radius));
        grad.addColorStop(0, `rgba(${ir},${ig},${ib},1)`);
        grad.addColorStop(1, `rgba(${ir},${ig},${ib},0)`);
        lctx.fillStyle = grad;
        lctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        lctx.restore();
        break;
      }
      case "light_end": {
        if (!lightmap) break;
        // Newer "hsl" mode (default) uses soft-light compositing — perceptually
        // closer to HSL lightness modulation per pixel without the cost of
        // getImageData/putImageData every frame. "overlay" keeps the legacy
        // multiply blend for projects that depend on the older look.
        const mode = (args as [string?])[0] ?? "hsl";
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = mode === "overlay" ? "multiply" : "soft-light";
        ctx.drawImage(lightmap, 0, 0);
        ctx.restore();
        break;
      }
    }
  }
}
