/**
 * Compile-time verification that all linter messageKey values exist in i18n files.
 *
 * Parses linter.py to extract every messageKey string literal (e.g., "linter.E225"),
 * then asserts each exists in en.json and ru.json.
 */

import en from "../../src/i18n/en.json";
import ru from "../../src/i18n/ru.json";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function readLinterSource(): string {
  const linterPath = resolve(__dirname, "../../src/assets/python/linter.py");
  const hintsPath = resolve(__dirname, "../../src/assets/python/syntax_hints.py");
  if (!existsSync(linterPath)) throw new Error(`Linter source not found: ${linterPath}`);
  if (!existsSync(hintsPath)) throw new Error(`syntax_hints source not found: ${hintsPath}`);
  return readFileSync(linterPath, "utf8") + "\n" + readFileSync(hintsPath, "utf8");
}

function extractMessageKeys(source: string): string[] {
  // Match patterns like: "linter.E225", "linter.W001", "linter.W_MethodNotCalled", etc.
  const regex = /"linter\.([A-Z][A-Za-z0-9_]*)"/g;
  const keys = new Set<string>();
  let match;
  while ((match = regex.exec(source)) !== null) {
    keys.add(`linter.${match[1]}`);
  }
  return [...keys].sort();
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((o: unknown, k: string) => {
    if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

describe("Linter i18n verification", () => {
  let linterKeys: string[];

  beforeAll(() => {
    const source = readLinterSource();
    linterKeys = extractMessageKeys(source);
  });

  it("extracts message keys from linter.py", () => {
    expect(linterKeys.length).toBeGreaterThan(0);
  });

  it("every linter messageKey exists in en.json", () => {
    const missing: string[] = [];
    for (const key of linterKeys) {
      const value = getNested(en, key);
      if (!value || typeof value !== "string") {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing linter translations in en.json:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
          `Add them to src/i18n/en.json under the "linter" section.`
      );
    }
  });

  it("every linter messageKey exists in ru.json", () => {
    const missing: string[] = [];
    for (const key of linterKeys) {
      const value = getNested(ru, key);
      if (!value || typeof value !== "string") {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing linter translations in ru.json:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
          `Add them to src/i18n/ru.json under the "linter" section.`
      );
    }
  });

  it("linter messageKey count matches between en.json linter section and linter.py", () => {
    // Get all keys under the "linter" section of en.json
    const enLinterKeys = Object.keys(en.linter as Record<string, string>).map((k) => `linter.${k}`);
    
    // Find keys in i18n that are NOT produced by linter.py (ghost keys)
    const deadKeys = enLinterKeys.filter((k) => !linterKeys.includes(k));
    
    // Find keys in linter.py that are NOT in i18n (missing keys)
    const missingKeys = linterKeys.filter((k) => !enLinterKeys.includes(k));
    
    if (deadKeys.length > 0) {
      console.warn(
        `Ghost linter keys in en.json (not produced by linter.py):\n${deadKeys.map((k) => `  - ${k}`).join("\n")}\n` +
          `Consider removing them from en.json and ru.json.`
      );
    }
    
    if (missingKeys.length > 0) {
      throw new Error(
        `Linter keys in linter.py missing from en.json:\n${missingKeys.map((k) => `  - ${k}`).join("\n")}\n` +
          `Add translations for them.`
      );
    }
    
    expect(missingKeys.length).toBe(0);
  });
});
