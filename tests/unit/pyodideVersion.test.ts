/**
 * Regression guard: PYODIDE_CDN must contain the same version as the
 * installed pyodide npm package. If someone bumps package.json without
 * touching pyodideVersion.ts (or vice versa), this test turns red.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Read the resolved version from package-lock.json
const lockPath = resolve(__dirname, "../../package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf-8")) as {
  packages: Record<string, { version: string }>;
};
const resolvedVersion =
  lock.packages["node_modules/pyodide"]?.version ??
  lock.packages[""]?.dependencies?.pyodide;

describe("pyodideVersion", () => {
  it("PYODIDE_CDN contains the same version as the installed pyodide package", async () => {
    const { PYODIDE_CDN, PYODIDE_VERSION } = await import(
      "../../src/runner/pyodideVersion"
    );
    expect(resolvedVersion).toBeDefined();
    expect(PYODIDE_VERSION).toBe(resolvedVersion);
    expect(PYODIDE_CDN).toContain(resolvedVersion as string);
    expect(PYODIDE_CDN).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v/);
  });
});
