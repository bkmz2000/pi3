import { act, render, screen } from "@testing-library/react";
import LoadingScreen from "../../src/components/LoadingScreen";
import { useThemeStore } from "../../src/state/useTheme";

describe("LoadingScreen", () => {
  afterEach(() => {
    act(() => useThemeStore.getState().setTheme("midnight"));
  });

  it.each(["studio", "midnight"] as const)("uses the %s theme instead of a hard-coded black screen", (themeId) => {
    act(() => useThemeStore.getState().setTheme(themeId));
    const theme = useThemeStore.getState().theme;

    render(<LoadingScreen />);

    expect(screen.getByRole("status")).toHaveStyle({
      background: theme.appBg,
      color: theme.appTxt,
      fontFamily: theme.fontUI,
    });
    const spinner = screen.getByTestId("loading-spinner");
    expect(spinner).toHaveStyle({ border: `4px solid ${theme.primaryBg}` });
    expect(spinner.style.borderTopColor).toBe("transparent");
  });
});
