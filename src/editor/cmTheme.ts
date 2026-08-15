import { githubLightInit, githubDarkInit } from "@uiw/codemirror-theme-github";
import type { Extension } from "@codemirror/state";
import type { Theme } from "../state/useTheme";

// Neither the light nor dark preset from @uiw/codemirror-theme-github wires
// its gutter/active-line colors to the app palette by default — Studio's
// stock white gutter happens to suit a cream theme, but the same category of
// stock defaults reads as a mismatched gray/purple column against Midnight's
// teal. Override both from theme tokens so the effect is intentional in both.
export function getCmTheme(theme: Theme): Extension {
  const settings = {
    gutterBackground: theme.editorBg,
    gutterForeground: theme.editorLN,
    gutterActiveForeground: theme.editorLNActive,
    lineHighlight: theme.editorLineActive,
  };
  return theme.name === "Midnight"
    ? githubDarkInit({ settings })
    : githubLightInit({ settings });
}
