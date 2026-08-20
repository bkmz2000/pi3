/**
 * htmlExport: generates a self-contained HTML file that runs a project
 * standalone (Pyodide from CDN + embedded graphics modules). Pure string
 * assembly — no DOM. Verifies entry-file selection, multi-file assembly
 * order, asset map embedding, and HTML escaping.
 */
import { generateHtmlExport } from '../../src/utils/htmlExport';
import type { StoredProject } from '../../src/utils/zip';

function mkProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p1',
    name: 'My Game',
    files: [{ name: 'main.py', content: 'print("hi")' }],
    assets: {},
    tilemaps: {},
    sounds: {},
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('generateHtmlExport', () => {
  it('embeds the entry file last with a marker comment', async () => {
    const html = await generateHtmlExport(mkProject({
      files: [
        { name: 'helper.py', content: 'def double(x): return x*2' },
        { name: 'main.py', content: 'print("hi")' },
      ],
      currentFile: 'main.py',
    }));
    // helper.py assembled before the entry
    const helperIdx = html.indexOf('--- helper.py ---');
    const entryIdx = html.indexOf('--- main.py (entry) ---');
    expect(helperIdx).toBeGreaterThan(-1);
    expect(entryIdx).toBeGreaterThan(helperIdx);
    expect(html).toContain('def double(x): return x*2');
    expect(html).toContain('print("hi")');
  });

  it('falls back to the first python file when currentFile is missing', async () => {
    const html = await generateHtmlExport(mkProject({
      files: [{ name: 'game.py', content: 'print(1)' }],
      currentFile: 'nonexistent.py',
    }));
    expect(html).toContain('--- game.py (entry) ---');
  });

  it('defaults to main.py when there are no python files', async () => {
    const html = await generateHtmlExport(mkProject({ files: [] }));
    expect(html).toContain('--- main.py (entry) ---');
  });

  it('embeds data: string assets into the ASSET_URLS map', async () => {
    const html = await generateHtmlExport(mkProject({
      assets: { 'sprite.png': 'data:image/png;base64,AAAA' },
    }));
    expect(html).toContain('"sprite.png": "data:image/png;base64,AAAA"');
  });

  it('base64-encodes Uint8Array assets with the right mime', async () => {
    const html = await generateHtmlExport(mkProject({
      assets: { 'icon.png': new Uint8Array([137, 80, 78, 71]) },
    }));
    // btoa(String.fromCharCode(...[137,80,78,71])) = btoa("PNG") = iVBORw==
    expect(html).toContain('"icon.png": "data:image/png;base64,iVBORw=="');
  });

  it('base64-encodes Blob assets asynchronously', async () => {
    // jsdom ships Blob without arrayBuffer(); polyfill it for this test so
    // the async base64 branch is exercised.
    const origArrayBuffer = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function (this: Blob) {
      const reader = new FileReader();
      const done = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsArrayBuffer(this);
      return done;
    };
    try {
      const html = await generateHtmlExport(mkProject({
        assets: { 'data.bin': new Blob([new Uint8Array([1, 2, 3])]) },
      }));
      // btoa(String.fromCharCode(1,2,3)) = AQID
      expect(html).toContain('"data.bin": "data:application/octet-stream;base64,AQID"');
    } finally {
      Blob.prototype.arrayBuffer = origArrayBuffer;
    }
  });

  it('escapes HTML in the project title', async () => {
    const html = await generateHtmlExport(mkProject({ name: '<script>alert(1)</script>' }));
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>');
  });

  it('produces a complete HTML document with pyodide CDN', async () => {
    const html = await generateHtmlExport(mkProject());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js');
    expect(html).toContain('id="canvas"');
    expect(html).toContain('id="console"');
  });
});