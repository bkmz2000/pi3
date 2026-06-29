import { baseProfile, graphicsProfile, competeProfile, LINT_GUTTER_EXT, type ProfileOpts } from "../../src/editor/profiles";

// Minimal ProfileOpts sufficient for structural tests — no DOM required.
const opts: ProfileOpts = {
  theme: {} as ProfileOpts["theme"],
  lang: "en",
  fontSize: 14,
  cmTheme: [],
};

describe("editor profiles", () => {
  it("competeProfile includes the lint-gutter extension", () => {
    const exts = competeProfile(opts);
    expect(exts).toContain(LINT_GUTTER_EXT);
  });

  it("graphicsProfile includes the lint-gutter extension", () => {
    const exts = graphicsProfile(opts);
    expect(exts).toContain(LINT_GUTTER_EXT);
  });

  it("competeProfile has the same length as baseProfile (no graphics-specific extensions added)", () => {
    const base = baseProfile(opts);
    const compete = competeProfile(opts);
    expect(compete.length).toBe(base.length);
  });

  it("graphicsProfile has more extensions than competeProfile", () => {
    const compete = competeProfile(opts);
    const graphics = graphicsProfile(opts);
    // autocompletion + 3 graphicsExtensions + Prec.high(keymap) + commentExtension
    expect(graphics.length).toBe(compete.length + 6);
  });
});
