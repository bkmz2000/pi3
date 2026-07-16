import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

const SW_SRC = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

// Minimal fake Cache/CacheStorage + Request/Response to run sw.js in a vm.
// Only the surface the freeze code actually uses.
function makeFakeCaches() {
  const stores: Record<string, Map<string, string>> = {};
  const cacheFor = (name: string) => {
    const store = stores[name] ?? (stores[name] = new Map());
    return {
      async put(req: { url: string }, res: { text(): Promise<string> }) {
        store.set(req.url, await res.text());
      },
      async match(req: { url: string }) {
        if (!store.has(req.url)) return undefined;
        const body = store.get(req.url)!;
        return { async text() { return body; } };
      },
      async add() { /* no-op */ },
    };
  };
  return {
    async open(name: string) { return cacheFor(name); },
    async match() { return undefined; },
    async keys() { return Object.keys(stores); },
    async delete(name: string) { delete stores[name]; return true; },
    _stores: stores,
  };
}

interface SwHarness {
  self: {
    listeners: Record<string, ((e: unknown) => void)[]>;
    addEventListener: (t: string, fn: (e: unknown) => void) => void;
    skipWaiting: jest.Mock;
    clients: { claim: jest.Mock };
  };
  caches: ReturnType<typeof makeFakeCaches>;
  fire(type: string, data: unknown): Promise<void>;
}

function loadSw(): SwHarness {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const self = {
    listeners,
    addEventListener(type: string, fn: (e: unknown) => void) {
      (listeners[type] ??= []).push(fn);
    },
    skipWaiting: jest.fn(async () => undefined),
    clients: { claim: jest.fn(async () => undefined) },
  };
  const caches = makeFakeCaches();
  class FakeRequest { url: string; constructor(url: string) { this.url = url; } }
  class FakeResponse {
    private body: string;
    constructor(body: string) { this.body = body; }
    async text() { return this.body; }
    clone() { return new FakeResponse(this.body); }
  }
  const ctx: Record<string, unknown> = {
    self, caches,
    Request: FakeRequest, Response: FakeResponse,
    URL,
    console: { log() {}, error() {} },
    fetch: jest.fn(),
    Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx);

  async function fire(type: string, data: unknown) {
    const waits: Promise<unknown>[] = [];
    const event = {
      data,
      waitUntil(p: Promise<unknown>) { waits.push(p); },
    };
    for (const fn of listeners[type] ?? []) fn(event);
    await Promise.all(waits);
  }

  return { self, caches, fire } as SwHarness;
}

describe('service worker freeze flag', () => {
  it('set_freeze on → does NOT call skipWaiting, flag persists in meta cache', async () => {
    const h = loadSw();
    await h.fire('message', { type: 'set_freeze', on: true });
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    expect(h.self.clients.claim).not.toHaveBeenCalled();
    // flag stored in meta cache (webide-meta-v1) under __freeze_flag__
    expect(h.caches._stores['webide-meta-v1'].get('/__freeze_flag__')).toBe('1');
  });

  it('set_freeze off → calls skipWaiting + clients.claim + clears flag', async () => {
    const h = loadSw();
    await h.fire('message', { type: 'set_freeze', on: true });
    h.self.skipWaiting.mockClear();
    h.self.clients.claim.mockClear();

    await h.fire('message', { type: 'set_freeze', on: false });
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1);
    expect(h.self.clients.claim).toHaveBeenCalledTimes(1);
    expect(h.caches._stores['webide-meta-v1'].get('/__freeze_flag__')).toBe('0');
  });

  it('install handler does NOT skipWaiting while frozen (bundle stays in waiting)', async () => {
    const h = loadSw();
    await h.fire('message', { type: 'set_freeze', on: true });
    h.self.skipWaiting.mockClear();

    await h.fire('install', {});
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('install handler DOES skipWaiting when not frozen', async () => {
    const h = loadSw();
    await h.fire('install', {});
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('activate handler preserves the meta cache across upgrades', async () => {
    const h = loadSw();
    // Set freeze so meta cache exists with content.
    await h.fire('message', { type: 'set_freeze', on: true });
    // Simulate a stale old-version cache that activate should evict.
    await h.caches.open('webide-v3-old');

    await h.fire('activate', {});
    const remaining = Object.keys(h.caches._stores);
    expect(remaining).toContain('webide-meta-v1');
    expect(remaining).not.toContain('webide-v3-old');
    // Freeze flag survives the upgrade.
    expect(h.caches._stores['webide-meta-v1'].get('/__freeze_flag__')).toBe('1');
  });

  it('ignores messages with unknown type or non-object data', async () => {
    const h = loadSw();
    await h.fire('message', null);
    await h.fire('message', { type: 'other' });
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    expect(h.caches._stores['webide-meta-v1']?.get('/__freeze_flag__')).toBeUndefined();
  });
});
