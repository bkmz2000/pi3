import {
  projectToZip,
  zipToProject,
  downloadProjectZip,
  importProjectFromFile,
  StoredProject,
} from '../../src/utils/zip';

// jsdom's Blob/File lack arrayBuffer() and text(); swap them for Node's
// built-in implementations from the 'buffer' module (Node 18+ exposes a
// spec-compliant Blob/File with both methods). File extends Blob there too.
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeBuffer = require('buffer') as typeof import('buffer');
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    (globalThis as unknown as { Blob: typeof Blob }).Blob =
      nodeBuffer.Blob as unknown as typeof Blob;
    if (typeof (nodeBuffer as unknown as { File?: typeof File }).File !== 'undefined') {
      (globalThis as unknown as { File: typeof File }).File =
        (nodeBuffer as unknown as { File: typeof File }).File;
    }
  }
}

function makeProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p1',
    name: 'My Game',
    files: [
      { name: 'main.py', content: 'print("hi")' },
      { name: 'lib/util.py', content: '# helper' },
    ],
    assets: {},
    updatedAt: '2026-05-25T10:00:00.000Z',
    currentFile: 'main.py',
    ...overrides,
  };
}

describe('zip — projectToZip + zipToProject round-trip', () => {
  it('preserves files, manifest fields, and currentFile', async () => {
    const project = makeProject();
    const bytes = await projectToZip(project);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const round = await zipToProject(bytes);
    expect(round.id).toBe('p1');
    expect(round.name).toBe('My Game');
    expect(round.updatedAt).toBe('2026-05-25T10:00:00.000Z');
    expect(round.currentFile).toBe('main.py');
    expect(round.files).toHaveLength(2);
    const main = round.files.find((f) => f.name === 'main.py')!;
    expect(main.content).toBe('print("hi")');
    const util = round.files.find((f) => f.name === 'lib/util.py')!;
    expect(util.content).toBe('# helper');
  });

  it('round-trips string assets, Uint8Array assets, and data URL assets', async () => {
    const dataUrl = 'data:image/png;base64,' + btoa('PNGFAKE');
    const project = makeProject({
      assets: {
        'config.txt': 'hello world',
        'raw.bin': new Uint8Array([1, 2, 3, 4]),
        'sprite.png': dataUrl,
      },
    });
    const bytes = await projectToZip(project);
    const round = await zipToProject(bytes);

    expect(Object.keys(round.assets).sort()).toEqual(
      ['config.txt', 'raw.bin', 'sprite.png'].sort(),
    );

    // Each restored asset is a Blob; check bytes + MIME.
    const configBlob = round.assets['config.txt'] as Blob;
    expect(configBlob.type).toBe('text/plain');
    expect(new TextDecoder().decode(new Uint8Array(await configBlob.arrayBuffer())))
      .toBe('hello world');

    const rawBlob = round.assets['raw.bin'] as Blob;
    expect(rawBlob.type).toBe('application/octet-stream');
    expect(Array.from(new Uint8Array(await rawBlob.arrayBuffer())))
      .toEqual([1, 2, 3, 4]);

    const pngBlob = round.assets['sprite.png'] as Blob;
    expect(pngBlob.type).toBe('image/png');
    expect(new TextDecoder().decode(new Uint8Array(await pngBlob.arrayBuffer())))
      .toBe('PNGFAKE');
  });

  it('zipToProject falls back to defaults when manifest is missing', async () => {
    // Build a zip with no manifest by round-tripping then stripping it.
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('files/only.py', '# nothing');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const round = await zipToProject(bytes, { id: 'fallback-id', name: 'Fallback Name' });
    expect(round.id).toBe('fallback-id');
    expect(round.name).toBe('Fallback Name');
    expect(round.currentFile).toBe('only.py');
    // updatedAt becomes "now" — just check it parses.
    expect(Date.parse(round.updatedAt)).not.toBeNaN();
  });

  it('zipToProject generates a synthetic id when neither manifest nor default supplies one', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('files/x.py', 'x = 1');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const round = await zipToProject(bytes);
    expect(round.id).toMatch(/^proj_/);
    expect(round.name).toBe('Untitled Project');
  });

  it('zipToProject ignores a manifest currentFile that no longer exists', async () => {
    const project = makeProject({
      files: [{ name: 'main.py', content: 'x' }],
      currentFile: 'deleted.py',
    });
    const bytes = await projectToZip(project);
    const round = await zipToProject(bytes);
    expect(round.currentFile).toBe('main.py');
  });

  it('zipToProject tolerates a corrupt manifest', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('project.json', '{not valid json');
    zip.file('files/a.py', 'a = 1');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const round = await zipToProject(bytes, { id: 'i', name: 'n' });
    expect(round.id).toBe('i');
    expect(round.files).toHaveLength(1);
  });

  it('zipToProject accepts ArrayBuffer input', async () => {
    const project = makeProject();
    const u8 = await projectToZip(project);
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const round = await zipToProject(ab);
    expect(round.name).toBe('My Game');
  });
});

describe('zip — downloadProjectZip', () => {
  it('triggers an anchor click and revokes the blob URL', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => {
      const u = `blob:fake-${created.length}`;
      created.push(u);
      return u;
    });
    URL.revokeObjectURL = jest.fn((u: string) => {
      revoked.push(u);
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      await downloadProjectZip(makeProject({ name: 'A B/C' }));
      expect(clickSpy).toHaveBeenCalled();
      expect(created).toHaveLength(1);
      expect(revoked).toEqual(created);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('uses a sanitized default filename derived from project name', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    let downloadedAs = '';
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedAs = this.download;
      });
    try {
      await downloadProjectZip(makeProject({ name: 'Hello World!! v2' }));
      // safeFilename collapses non-[\w.-]+ to single underscores.
      expect(downloadedAs).toBe('Hello_World_v2.zip');
    } finally {
      clickSpy.mockRestore();
    }
  });
});

describe('zip — tilemaps / sheet / sounds / notes', () => {
  it('round-trips tilemaps through the zip', async () => {
    const project = makeProject({
      tilemaps: {
        'level1': { width: 4, height: 3, cells: [1, 2, 3] } as unknown as import('../../src/utils/zip').TilemapData,
      },
    });
    const bytes = await projectToZip(project);
    const round = await zipToProject(bytes);
    expect(round.tilemaps?.level1).toBeDefined();
    expect((round.tilemaps!.level1 as unknown as { width: number }).width).toBe(4);
  });

  it('round-trips a sheet blob', async () => {
    const project = makeProject({
      sheet: { palette: ['#000', '#fff'], sprites: [] } as unknown as import('../../src/utils/zip').SheetData,
    });
    const bytes = await projectToZip(project);
    const round = await zipToProject(bytes);
    expect(round.sheet).toBeDefined();
    expect((round.sheet as unknown as { palette: string[] }).palette).toEqual(['#000', '#fff']);
  });

  it('writes notes.txt for URL-based sounds and fires onWarning on import', async () => {
    const project = makeProject({
      sounds: { 'stream.mp3': 'https://example.com/audio/stream.mp3' },
    });
    const bytes = await projectToZip(project);

    // notes.txt must be present in the archive
    const JSZip = (await import('jszip')).default;
    const inspect = await JSZip.loadAsync(bytes);
    expect(inspect.file('notes.txt')).not.toBeNull();

    const warnings: string[] = [];
    const round = await zipToProject(bytes, undefined, (msg) => warnings.push(msg));
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/stream\.mp3/);
    // Non-data-URL sound is NOT restored (documented lossy behavior).
    expect(round.sounds?.['stream.mp3']).toBeUndefined();
  });

  it('does not write notes.txt when there are no URL sounds', async () => {
    const project = makeProject({ sounds: {} });
    const bytes = await projectToZip(project);
    const JSZip = (await import('jszip')).default;
    const inspect = await JSZip.loadAsync(bytes);
    expect(inspect.file('notes.txt')).toBeNull();
  });

  it('does not call onWarning when notes.txt is absent', async () => {
    const project = makeProject();
    const bytes = await projectToZip(project);
    const warnings: string[] = [];
    await zipToProject(bytes, undefined, (m) => warnings.push(m));
    expect(warnings).toEqual([]);
  });
});

describe('zip — importProjectFromFile', () => {
  it('reads a File and returns the parsed project, defaulting name from filename', async () => {
    const project = makeProject({ name: 'OnDisk' });
    const bytes = await projectToZip(project);
    // Build a File whose name has a .zip extension that should be stripped from the default.
    const file = new File([bytes as BlobPart], 'OnDisk.zip', { type: 'application/zip' });
    const round = await importProjectFromFile(file);
    // Manifest name wins over the default; just check the round-trip succeeded.
    expect(round.name).toBe('OnDisk');
    expect(round.files.length).toBeGreaterThan(0);
  });
});
