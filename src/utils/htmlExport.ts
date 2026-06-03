/**
 * Generates a self-contained HTML file that runs the project standalone.
 * Embeds Python source, references Pyodide from CDN, and includes a
 * minimal graphics renderer so the exported file works when opened
 * directly in a browser.
 */

import type { StoredProject } from "./zip";

// Graphics __init__.py source — embedded so the standalone HTML doesn't
// need to fetch it separately.  Inlined at build time via Vite ?raw.
import graphicsInitSrc from "../assets/python/pi3/__init__.py?raw";
import actorsInitSrc from "../assets/python/pi3/actors/__init__.py?raw";
import animationSrc from "../assets/python/pi3/animation.py?raw";
import linterSrc from "../assets/python/linter.py?raw";

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pythonCodeLiteral(code: string): string {
  return "`" + code.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\${/g, "\\${") + "`";
}

export async function generateHtmlExport(project: StoredProject): Promise<string> {
  // Gather all Python files
  const pythonFiles = project.files.filter((f) => f.name.endsWith(".py"));
  const entryFile = project.currentFile && pythonFiles.some((f) => f.name === project.currentFile)
    ? project.currentFile
    : pythonFiles[0]?.name ?? "main.py";

  // Build the Python source code assembly: all files concatenated, entry last
  // so it can reference symbols from earlier files.
  const otherFiles = pythonFiles.filter((f) => f.name !== entryFile);
  let pythonAssembly = "";
  for (const f of otherFiles) {
    pythonAssembly += `# --- ${f.name} ---\n${f.content}\n\n`;
  }
  // Entry file last so it runs
  const entrySource = pythonFiles.find((f) => f.name === entryFile)?.content ?? "";
  pythonAssembly += `# --- ${entryFile} (entry) ---\n${entrySource}\n`;

  // Build asset data URL map for JS
  const assetMapEntries: string[] = [];
  for (const [name, data] of Object.entries(project.assets || {})) {
    if (typeof data === "string" && data.startsWith("data:")) {
      assetMapEntries.push(`  "${name}": "${data}"`);
    }
    // Blob/Uint8Array assets are handled via base64 below
  }

  // Pre-build base64 for Blob/Uint8Array assets
  const blobAssets: Record<string, string> = {};
  for (const [name, data] of Object.entries(project.assets || {})) {
    if (data instanceof Blob) {
      const buf = await data.arrayBuffer();
      const u8 = new Uint8Array(buf);
      const mime = name.endsWith(".svg") ? "image/svg+xml"
        : name.endsWith(".png") ? "image/png"
        : "application/octet-stream";
      const base64 = btoa(String.fromCharCode(...u8));
      blobAssets[name] = `data:${mime};base64,${base64}`;
    } else if (data instanceof Uint8Array) {
      const mime = name.endsWith(".svg") ? "image/svg+xml"
        : name.endsWith(".png") ? "image/png"
        : "application/octet-stream";
      const base64 = btoa(String.fromCharCode(...data));
      blobAssets[name] = `data:${mime};base64,${base64}`;
    }
  }
  for (const [name, url] of Object.entries(blobAssets)) {
    assetMapEntries.push(`  "${name}": "${url}"`);
  }

  const title = escapeHtml(project.name || "pi3 Project");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
    background: #0f172a;
    color: #e2e8f0;
    padding: 20px;
    min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #38bdf8; }
  #canvas-wrap { margin-bottom: 16px; text-align: center; }
  canvas {
    border: 1px solid #334155;
    border-radius: 6px;
    image-rendering: pixelated;
    background: #000;
  }
  #console {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 12px;
    min-height: 60px;
    max-height: 300px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .err { color: #f87171; }
  .status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .status-running { background: #22c55e; color: #000; }
  .status-done { background: #334155; color: #94a3b8; }
  .status-error { background: #ef4444; color: #fff; }
</style>
</head>
<body>
<div class="container">
  <h1>${title}</h1>
  <div id="canvas-wrap">
    <div class="status status-running" id="status">LOADING</div>
    <br>
    <canvas id="canvas" width="400" height="400"></canvas>
  </div>
  <div id="console"></div>
</div>

<script src="${PYODIDE_CDN}"></script>
<script>
(function() {
  const canvas = document.getElementById("canvas");
  const consoleEl = document.getElementById("console");
  const statusEl = document.getElementById("status");

  function log(text, isErr) {
    const line = document.createElement("div");
    line.textContent = text;
    if (isErr) line.className = "err";
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "status " + (cls || "status-running");
  }

  // ---- asset URLs ----
  const ASSET_URLS = {
${assetMapEntries.join(",\n")}
  };

  // ---- minimal draw-command renderer ----
  const ctx = canvas.getContext("2d");
  if (!ctx) { log("Canvas 2D context not available", true); return; }

  let _fillColor = [255,255,255];
  let _strokeColor = [0,0,0];
  let _strokeWidth = 1;
  let _hasFill = true;
  let _hasStroke = true;
  let _textSize = 16;
  let _textAlign = ["left","top"];
  let _transformStack = [];
  const _bitmapCache = {};

  function _resize(w, h) {
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
  }

  function _hex(c) {
    return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
  }

  function _loadAsset(name) {
    if (_bitmapCache[name]) return _bitmapCache[name];
    const url = ASSET_URLS[name] || ASSET_URLS[name + ".png"] || ASSET_URLS[name + ".svg"];
    if (!url) return null;
    const img = new Image();
    img.src = url;
    _bitmapCache[name] = img;
    return img;
  }

  function _drawCmd(cmd) {
    const [kind, args] = cmd;
    try {
      switch (kind) {
        case "fill": {
          _fillColor = args;
          _hasFill = true;
          ctx.fillStyle = _hex(_fillColor);
          break;
        }
        case "no_fill": {
          _hasFill = false;
          break;
        }
        case "stroke": {
          _strokeColor = args;
          _hasStroke = true;
          ctx.strokeStyle = _hex(_strokeColor);
          break;
        }
        case "no_stroke": {
          _hasStroke = false;
          break;
        }
        case "stroke_width": {
          _strokeWidth = args[0];
          ctx.lineWidth = _strokeWidth;
          break;
        }
        case "background": {
          if (args.length === 3) {
            ctx.fillStyle = _hex(args);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (args.length === 1) {
            ctx.fillStyle = _hex(args);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          break;
        }
        case "circle": {
          const [x, y, r] = args;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          if (_hasFill) ctx.fill();
          if (_hasStroke) ctx.stroke();
          break;
        }
        case "rect": {
          const [x, y, w, h] = args;
          if (_hasFill) ctx.fillRect(x, y, w, h);
          if (_hasStroke) ctx.strokeRect(x, y, w, h);
          break;
        }
        case "ellipse": {
          const [x, y, w, h] = args;
          ctx.beginPath();
          ctx.ellipse(x, y, w / 2, (h || w) / 2, 0, 0, Math.PI * 2);
          if (_hasFill) ctx.fill();
          if (_hasStroke) ctx.stroke();
          break;
        }
        case "line": {
          const [x1, y1, x2, y2] = args;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          break;
        }
        case "point": {
          const [x, y] = args;
          ctx.fillStyle = _hex(_strokeColor);
          ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
          break;
        }
        case "text": {
          const [s, x, y] = args;
          ctx.font = _textSize + "px monospace";
          ctx.textAlign = _textAlign[0];
          ctx.textBaseline = _textAlign[1];
          if (_hasFill) ctx.fillText(s, x, y);
          if (_hasStroke) ctx.strokeText(s, x, y);
          break;
        }
        case "text_size": {
          _textSize = args[0] || 16;
          break;
        }
        case "text_align": {
          _textAlign = [args[0] || "left", args[1] || "top"];
          break;
        }
        case "push": {
          ctx.save();
          _transformStack.push([_fillColor, _strokeColor, _strokeWidth, _hasFill, _hasStroke, _textSize, _textAlign]);
          break;
        }
        case "pop": {
          ctx.restore();
          if (_transformStack.length) {
            const s = _transformStack.pop();
            [_fillColor, _strokeColor, _strokeWidth, _hasFill, _hasStroke, _textSize, _textAlign] = s;
          }
          break;
        }
        case "translate": {
          ctx.translate(args[0], args[1]);
          break;
        }
        case "rotate": {
          ctx.rotate(args[0] * Math.PI / 180);
          break;
        }
        case "scale": {
          ctx.scale(args[0], args[1] !== undefined ? args[1] : args[0]);
          break;
        }
        case "image_centered":
        case "image": {
          const [name, x, y, w, h] = args;
          const img = _loadAsset(name);
          if (!img || !img.complete) break;
          const iw = w || img.naturalWidth || img.width;
          const ih = h || img.naturalHeight || img.height;
          const dx = kind === "image_centered" ? x - iw / 2 : x;
          const dy = kind === "image_centered" ? y - ih / 2 : y;
          ctx.drawImage(img, dx, dy, iw, ih);
          break;
        }
        case "sprite": {
          const [pixelsBuf, sw, sh, ox, oy] = args;
          try {
            const imgData = ctx.createImageData(sw, sh);
            imgData.data.set(new Uint8ClampedArray(pixelsBuf));
            const offscreen = new OffscreenCanvas(sw, sh);
            const offCtx = offscreen.getContext("2d");
            offCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(offscreen, ox, oy);
          } catch(e) { /* skip broken sprite */ }
          break;
        }
        case "resize": {
          _resize(args[0], args[1]);
          break;
        }
      }
    } catch(e) {
      // Silently skip broken draw commands
    }
  }

  // ---- run boot sequence ----
  async function boot() {
    try {
      setStatus("LOADING PYODIDE", "status-running");
      log("Loading Python runtime...");

      // loadPyodide is injected by the CDN script
      const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
      });

      setStatus("SETTING UP", "status-running");
      log("Setting up graphics engine...");

      // Install Python modules into Pyodide's virtual FS
      pyodide.FS.mkdirTree("/pi3/actors");

      // Write our pi3 modules
      const graphicsSrc = ${pythonCodeLiteral(graphicsInitSrc)};
      const actorsSrc = ${pythonCodeLiteral(actorsInitSrc)};
      const animSrc = ${pythonCodeLiteral(animationSrc)};
      const lintSrc = ${pythonCodeLiteral(linterSrc)};

      pyodide.FS.writeFile("/pi3/__init__.py", graphicsSrc);
      pyodide.FS.writeFile("/pi3/actors/__init__.py", actorsSrc);
      pyodide.FS.writeFile("/pi3/animation.py", animSrc);
      pyodide.FS.writeFile("/linter.py", lintSrc);

      // Register 'graphics' as alias for back-compat with older user projects.
      // Submodules need explicit aliases too so isinstance() works.
      pyodide.runPython([
        "import sys, pi3, pi3.actors, pi3.animation",
        "sys.modules['graphics'] = pi3",
        "sys.modules['graphics.actors'] = pi3.actors",
        "sys.modules['graphics.animation'] = pi3.animation",
      ].join("\\n"));

      // ---- Wire stdout/stderr ----
      pyodide.setStdout({ batched: (text) => log(text, false) });
      pyodide.setStderr({ batched: (text) => log(text, true) });

      // ---- Hook draw commands ----
      // Monkey-patch graphics._draw_commands to redirect to our renderer
      pyodide.globals.set("_ide_flush_draw_commands", (commands) => {
        const arr = commands.toJs ? commands.toJs() : Array.from(commands);
        for (const cmd of arr) {
          _drawCmd(cmd);
        }
      });

      // Override the internal flush so it calls our JS function
      await pyodide.runPythonAsync(\`
import graphics as _g
import builtins
import asyncio

# Patch the draw flush to use our JS callback
_original_flush = _g._flush_draw_commands
def _patched_flush():
    import js
    if _g._draw_commands:
        js._ide_flush_draw_commands(_g._draw_commands)
        _g._draw_commands.clear()
_g._flush_draw_commands = _patched_flush

# Patch input() for async support
_pending_input = None
async def _async_input(prompt=""):
    global _pending_input
    import asyncio
    loop = asyncio.get_event_loop()
    fut = loop.create_future()
    _pending_input = fut
    return await fut

def _resolve_input(value):
    global _pending_input
    if _pending_input and not _pending_input.done():
        _pending_input.set_result(value)

builtins.input = lambda prompt="": _async_input(prompt)
\`);

      setStatus("RUNNING", "status-running");
      log("Running project...");

      // Run the user's Python code
      const userCode = ${pythonCodeLiteral(pythonAssembly)};
      await pyodide.runPythonAsync(userCode);

      setStatus("DONE", "status-done");
      log("\\nProgram finished.");

    } catch (err) {
      setStatus("ERROR", "status-error");
      log("Error: " + (err.message || err), true);
      console.error(err);
    }
  }

  boot().catch(err => {
    log("Fatal: " + (err.message || err), true);
    setStatus("CRASH", "status-error");
  });
})();
</script>
</body>
</html>`;
}
