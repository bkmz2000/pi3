/**
 * Regression guard: PYODIDE_CDN must contain the same version as the
 * installed pyodide npm package. If someone bumps package.json without
 * touching pyodideVersion.ts (or vice versa), this test turns red.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Read the installed package version so the check matches the active package manager.
const packagePath = resolve(__dirname, "../../node_modules/pyodide/package.json");
const installedPackage = JSON.parse(readFileSync(packagePath, "utf-8")) as {
  version: string;
};
const resolvedVersion = installedPackage.version;

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
