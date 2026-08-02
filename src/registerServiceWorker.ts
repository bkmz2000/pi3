// Service worker registration. Kept in its own module, imported only from
// main.tsx: it reads `import.meta.env.PROD`, which ts-jest cannot transform,
// so it must stay out of any module a unit test might pull in.
//
// The env read must be spelled `import.meta.env.X` exactly — see
// src/state/deploymentProfile.ts for why an optional-chained form silently
// reads undefined.
//
// Dev is deliberately excluded: a registered SW caches dev assets and fights
// with HMR. Registration is deferred to `load` so it never competes with the
// initial page load (Pyodide is already heavy enough).
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non-fatal: the app works fine without offline support or the install
      // prompt. Never block startup on this.
      console.warn("Service worker registration failed:", err);
    });
  });
}
