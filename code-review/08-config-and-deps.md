# Configuration & Dependencies

## 1. Package overrides suggest unresolved conflicts

```json
"overrides": {
  "@codemirror/highlight": "^1.2.3",
  "@codemirror/lang-python": "^6.2.1",
  "@codemirror/state": "^6.5.4",
  "@codemirror/view": "^6.39.16"
}
```

`overrides` in package.json force specific versions of transitive dependencies. This means some dependency in the tree requests different versions that are incompatible. Worth auditing whether these are still needed after a `npm update`.

## 2. No `.env.example` or environment docs

The code references `import.meta.env.VITE_API_URL` but there's no `.env.example` file. New contributors won't know what to set. The default is `''` (same-origin), which works for development but should be documented.

## 3. Pyodide version pinned to `v0.26.4` in worker

The worker hardcodes `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` but `package.json` lists `"pyodide": "^0.29.3"`. These are different versions — the worker ignores the npm package and loads from CDN.

## 4. Dev server lacks COOP/COEP headers

The `vite.config.ts` only adds `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` in the `preview` config. Running `npm run dev` doesn't include these headers, so `SharedArrayBuffer` (used for interrupt buffer) won't be available. The worker silently degrades (`console.warn`), but this means the interrupt feature doesn't work in development mode.

## 5. Docker E2E CI runs on port 5173 for server port 3001

The CI workflow maps docker port `5173:3001` but the test URL is `http://localhost:5173`. This works because the server serves both API and static files, but the port naming is confusing — 5173 is Vite's default dev port, not the Express server's.
