# Specific Bugs & Code Smells

## 1. `canvasActive` resets before worker acknowledges interrupt

`RunnerProvider.tsx` `stop()` (line 111) immediately sets `canvasActive: false`. The worker may still be rendering a frame. The canvas disappears before the interrupt takes effect, causing a visible flash.

## 2. Worker event listener leak in `lint()`

`RunnerProvider.tsx` lines 372-384: Each call to `lint()` adds a `message` event listener to the worker. If `lint()` is called rapidly (e.g., keystroke-by-keystroke linting), listeners accumulate. There's no cleanup if the component unmounts while a lint is in-flight.

## 3. `_appendOutput` exposed publicly

The `useRunner()` hook (line 400) returns `_appendOutput` which is called directly by `useRunButton.ts`. This is a store-internal method prefixed with `_` but exposed as a public API. The `console.checking` and `console.syntaxError` messages are appended manually rather than through the worker stream.

## 4. `db_version` table rows accumulate

`server/db/index.ts` migration runner inserts a new row per migration version:
```ts
db.prepare('INSERT INTO db_version (version) VALUES (?)').run(fileVersion);
```

Each migration adds a row. Over time this table grows linearly. Should `REPLACE` or update the single row instead.

## 5. `ChangeFile` on load — duplicate Store state reads

The `changeFile` action reads `s.currentProjectId`, `s.project`, etc., but also creates a local `Set` copy for `dirtyFiles`. The `toggleAsset` action spreads `...s` which includes fields that shouldn't change, which could overwrite concurrent updates.

## 6. Service worker has no `install`/`activate` handlers

The `sw.js` at `/public/sw.js` isn't in the repo (not shown), but the registration in `App.tsx` doesn't handle updates, waiting, or activation. If the SW caches anything, the default behavior (wait for all tabs to close) will prevent users from seeing updates.

## 7. No CSP headers

The server doesn't set Content-Security-Policy headers. The app loads external scripts from CDN (jsdelivr for Pyodide) and Google Fonts. An XSS vulnerability in any of these CDNs or in user code execution would be unmitigated.

## 8. Variable shadowing in `SpriteEditor.tsx` line 674

```ts
case "text": {
  const t = s as TextData;  // shadows the `t` from useTranslation()
  ...
}
```

Inside the `renderShape` switch, the `text` case declares `const t` which shadows the `useTranslation()` `t` at the top of the component. This happens to work because translation isn't needed in that branch, but it's fragile.

## 9. `showHitboxes` checkbox uses `defaultChecked` instead of `checked`

`SideMenu.tsx` line 524:
```tsx
<input type="checkbox" className="accent-cyan-500" defaultChecked />
```

Using `defaultChecked` without `onChange` means this is an uncontrolled input controlled by an initial prop. Changes to this checkbox persist in DOM but don't affect the `showHitboxes` state. The checkbox on line 530 does use `checked` + `onChange` correctly.

## 10. Missing `href` on preconnect

`index.html` line 15:
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
```

This is correct and working.
