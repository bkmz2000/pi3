/**
 * Tests for ConsoleView: a standalone presentational console surface.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import ConsoleView from "../../src/components/ConsoleView";

describe("ConsoleView", () => {
  it("renders the label in the header", () => {
    render(<ConsoleView label="Generator error" content="" />);
    expect(screen.getByText(/generator error/i)).toBeTruthy();
  });

  it("renders content in a pre element", () => {
    render(<ConsoleView label="Error" content="Traceback (most recent call last):\n  line 5" />);
    const pre = document.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toContain("Traceback");
    expect(pre!.textContent).toContain("line 5");
  });

  it("applies maxHeight to the pre element", () => {
    render(<ConsoleView label="Error" content="x" maxHeight={200} />);
    const pre = document.querySelector("pre");
    expect(pre).toBeTruthy();
    expect((pre as HTMLElement).style.maxHeight).toBe("200px");
  });

  it("shows status pill when status is provided", () => {
    render(<ConsoleView label="Log" content="" status="error" />);
    expect(screen.getByText("error")).toBeTruthy();
  });

  it("shows running pill", () => {
    render(<ConsoleView label="Log" content="" status="running" />);
    expect(screen.getByText("running")).toBeTruthy();
  });

  it("shows idle pill", () => {
    render(<ConsoleView label="Log" content="" status="idle" />);
    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("renders no status pill when status is null", () => {
    render(<ConsoleView label="Log" content="" status={null} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("error");
    expect(body).not.toContain("running");
    expect(body).not.toContain("idle");
  });

  it("renders no status pill when status is omitted", () => {
    render(<ConsoleView label="Log" content="" />);
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("running");
    expect(body).not.toContain("idle");
  });

  it("renders the actions slot when provided", () => {
    render(
      <ConsoleView
        label="Log"
        content=""
        actions={<button>Clear</button>}
      />
    );
    expect(screen.getByText("Clear")).toBeTruthy();
  });

  it("does not render actions slot when not provided", () => {
    const { container } = render(<ConsoleView label="Log" content="" />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });
});
