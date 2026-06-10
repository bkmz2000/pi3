/**
 * Compile-time verification that all friendlyError messageKey values exist in i18n files.
 *
 * Parses _errors.py to extract ALL_MESSAGE_KEYS, then asserts each key exists
 * in en.json and ru.json. Also asserts parity between en and ru key sets.
 */

import en from "../../src/i18n/en.json";
import ru from "../../src/i18n/ru.json";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function readErrorsSource(): string {
  const path = resolve(__dirname, "../../src/assets/python/graphics/_errors.py");
  if (!existsSync(path)) throw new Error(`_errors.py not found: ${path}`);
  return readFileSync(path, "utf8");
}

function extractAllMessageKeys(source: string): string[] {
  // Match the ALL_MESSAGE_KEYS list in _errors.py
  const match = source.match(/ALL_MESSAGE_KEYS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error("Could not find ALL_MESSAGE_KEYS in _errors.py");
  const body = match[1];
  const keyRegex = /"([^"]+)"/g;
  const keys: string[] = [];
  let m;
  while ((m = keyRegex.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort();
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((o: unknown, k: string) => {
    if (o && typeof o === "object") return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

// All linter Label keys (not in ALL_MESSAGE_KEYS but must exist in i18n)
const LABEL_KEYS = [
  "linter.E999Label",
  "linter.E101Label",
  "linter.E111Label",
  "linter.E303Label",
  "linter.E501Label",
  "linter.E225Label",
  "linter.E225CallLabel",
  "linter.F401Label",
  "linter.F821Label",
];

// All errorCategory keys (must exist in i18n)
const ERROR_CATEGORY_KEYS = [
  "errorCategory.naming",
  "errorCategory.types",
  "errorCategory.grammar",
  "errorCategory.missing",
  "errorCategory.logic",
];

// Extra UI keys in friendlyError scope
const UI_KEYS = [
  "friendlyError.showRaw",
  "friendlyError.hideRaw",
  "friendlyError.rawTraceback",
  "friendlyError.blocksRunning",
];

// Console keys used by the runner
const CONSOLE_KEYS = [
  "console.foundErrorsBatch",
];

describe("FriendlyError i18n verification", () => {
  let allKeys: string[];

  beforeAll(() => {
    const source = readErrorsSource();
    allKeys = extractAllMessageKeys(source);
  });

  it("extracts friendlyError keys from _errors.py ALL_MESSAGE_KEYS", () => {
    expect(allKeys.length).toBeGreaterThan(0);
    // Spot-check a few known keys
    expect(allKeys).toContain("friendlyError.naming.undefined");
    expect(allKeys).toContain("friendlyError.types.badOperator");
    expect(allKeys).toContain("friendlyError.grammar.missingColon");
  });

  describe("friendlyError keys", () => {
    it("every friendlyError key exists in en.json", () => {
      const missing: string[] = [];
      for (const key of allKeys) {
        const value = getNested(en, key);
        if (!value || typeof value !== "string") {
          missing.push(key);
        }
      }
      if (missing.length > 0) {
        throw new Error(
          `Missing friendlyError translations in en.json:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
            `Add them to src/i18n/en.json under the "friendlyError" section.`
        );
      }
    });

    it("every friendlyError key exists in ru.json", () => {
      const missing: string[] = [];
      for (const key of allKeys) {
        const value = getNested(ru, key);
        if (!value || typeof value !== "string") {
          missing.push(key);
        }
      }
      if (missing.length > 0) {
        throw new Error(
          `Missing friendlyError translations in ru.json:\n${missing.map((k) => `  - ${k}`).join("\n")}\n` +
            `Add them to src/i18n/ru.json under the "friendlyError" section.`
        );
      }
    });
  });

  describe("label keys", () => {
    for (const key of LABEL_KEYS) {
      it(`label key ${key} exists in en.json`, () => {
        expect(getNested(en, key)).toEqual(expect.any(String));
      });
      it(`label key ${key} exists in ru.json`, () => {
        expect(getNested(ru, key)).toEqual(expect.any(String));
      });
    }
  });

  describe("errorCategory keys", () => {
    for (const key of ERROR_CATEGORY_KEYS) {
      it(`errorCategory key ${key} exists in en.json`, () => {
        expect(getNested(en, key)).toEqual(expect.any(String));
      });
      it(`errorCategory key ${key} exists in ru.json`, () => {
        expect(getNested(ru, key)).toEqual(expect.any(String));
      });
    }
  });

  describe("UI keys", () => {
    for (const key of UI_KEYS) {
      it(`UI key ${key} exists in en.json`, () => {
        expect(getNested(en, key)).toEqual(expect.any(String));
      });
      it(`UI key ${key} exists in ru.json`, () => {
        expect(getNested(ru, key)).toEqual(expect.any(String));
      });
    }
  });

  describe("console keys", () => {
    for (const key of CONSOLE_KEYS) {
      it(`console key ${key} exists in en.json`, () => {
        expect(getNested(en, key)).toEqual(expect.any(String));
      });
      it(`console key ${key} exists in ru.json`, () => {
        expect(getNested(ru, key)).toEqual(expect.any(String));
      });
    }
  });

  describe("en/ru parity", () => {
    it("friendlyError section has the same keys in en.json and ru.json", () => {
      const enKeys = new Set(Object.keys(en.friendlyError as Record<string, unknown>));
      const ruKeys = new Set(Object.keys(ru.friendlyError as Record<string, unknown>));
      const enOnly = [...enKeys].filter((k) => !ruKeys.has(k));
      const ruOnly = [...ruKeys].filter((k) => !enKeys.has(k));
      if (enOnly.length > 0 || ruOnly.length > 0) {
        throw new Error(
          `en.json / ru.json friendlyError key mismatch:\n` +
          `  en-only: ${enOnly.join(", ") || "none"}\n` +
          `  ru-only: ${ruOnly.join(", ") || "none"}`
        );
      }
    });
  });
});
