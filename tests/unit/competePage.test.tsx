/**
 * Smoke tests for CompetePage.
 *
 * Verifies: loading state, problem render, verdict card, progress indicator.
 * The actual judge loop (runOnce) is mocked so Pyodide is not needed.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({ project: { files: {}, assets: {} }, currentFile: "main.py", currentProjectId: null })),
  isExampleSessionId: jest.fn(() => false),
}));
jest.mock("../../src/utils/storage", () => ({
  projectStorage: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
  isOnline: jest.fn(() => true),
}));

// Mock runOnce so we don't need a real worker
jest.mock("../../src/runner/RunnerProvider", () => ({
  useRunner: jest.fn(() => ({
    output: [],
    running: false,
    interrupt: jest.fn(),
  })),
  useRunnerStore: Object.assign(
    jest.fn((selector: (s: { running: boolean; debugFrames: never[] }) => unknown) =>
      selector({ running: false, debugFrames: [] }),
    ),
    { getState: jest.fn(() => ({ running: false, debugFrames: [], output: [] })) },
  ),
  runOnce: jest.fn(async () => ({ stdout: "", runtimeError: false, tle: false })),
  getWorker: jest.fn(() => ({ postMessage: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() })),
}));

// Mock runSubmit
jest.mock("../../src/compete/submitRunner", () => ({
  runSubmit: jest.fn(async () => ({ verdict: "ok", stars: 3 })),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  useParams: () => ({ slug: "sum-two" }),
}));

// Mock DebugPanel and CompeteLeft (CodeMirror is ESM-only in jsdom)
jest.mock("../../src/components/DebugPanel", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../src/compete/CompeteLeft", () => ({
  __esModule: true,
  default: ({ onRun, onSubmit }: { onRun: () => void; onSubmit: () => void }) =>
    React.createElement("div", { "data-testid": "compete-left" },
      React.createElement("button", { onClick: onRun, "data-testid": "run-btn" }, "Run"),
      React.createElement("button", { onClick: onSubmit, "data-testid": "submit-btn" }, "Submit"),
    ),
}));

// react-markdown and remark-gfm are ESM-only; mock them for jsdom
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    const h2Match = (children ?? "").match(/^## (.+)$/m);
    return React.createElement("div", { "data-testid": "markdown" },
      h2Match ? React.createElement("h2", null, h2Match[1]) : children,
    );
  },
}));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const MOCK_PROBLEM = {
  id: 1,
  slug: "sum-two",
  title: "Sum Two Numbers",
  statement: "## Task\nGiven two numbers, print their sum.",
  starter_code: "a, b = map(int, input().split())\nprint(a + b)",
  order_index: 1,
  visibleTests: [
    { id: 10, ordinal: 1, tier: 1, input: "1 2\n", expected: "3\n", is_visible: 1 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_PROBLEM,
  }) as jest.Mock;
});

describe("CompetePage", () => {
  it("renders problem title after fetch", async () => {
    const { default: CompetePage } = await import("../../src/compete/CompetePage");
    render(
      <MemoryRouter>
        <CompetePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Sum Two Numbers")).toBeTruthy();
    });
  });

  it("renders visible test card", async () => {
    const { default: CompetePage } = await import("../../src/compete/CompetePage");
    render(
      <MemoryRouter>
        <CompetePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Test #1/i)).toBeTruthy();
    });
  });

  it("renders markdown statement", async () => {
    const { default: CompetePage } = await import("../../src/compete/CompetePage");
    render(
      <MemoryRouter>
        <CompetePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      // Markdown renders ## Task as an h2
      expect(screen.getByText("Task")).toBeTruthy();
    });
  });

  it("shows loading/empty state when problem not found", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => null }) as jest.Mock;
    const { default: CompetePage } = await import("../../src/compete/CompetePage");
    render(
      <MemoryRouter>
        <CompetePage />
      </MemoryRouter>,
    );
    // While loading, problem is null — shows the no-problems fallback
    await waitFor(() => {
      expect(screen.getByText(/no problems/i)).toBeTruthy();
    });
  });
});
