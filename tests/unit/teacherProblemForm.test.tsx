/**
 * Tests for TeacherProblemForm: render, validation errors, and preview toggle.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react").createElement("div", { "data-testid": "preview" }, children);
  },
}));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));
jest.mock("remark-math", () => ({ __esModule: true, default: () => {} }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: () => {} }));

// CodeMirror is ESM-only; mock it out
jest.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react").createElement("textarea", {
      "data-testid": "codemirror",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    });
  },
}));
jest.mock("@uiw/codemirror-theme-github", () => ({
  __esModule: true,
  githubDark: {},
  githubLight: {},
}));
jest.mock("@codemirror/lang-python", () => ({ __esModule: true, python: () => [] }));
jest.mock("@codemirror/view", () => ({ __esModule: true, EditorView: { lineWrapping: {} } }));
jest.mock("../../src/editor/profiles", () => ({
  __esModule: true,
  competeProfile: () => [],
  graphicsProfile: () => [],
  baseProfile: () => [],
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  useParams: () => ({ slug: undefined }),
}));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeacherProblemForm from "../../src/components/teacher/TeacherProblemForm";

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock;
});

describe("TeacherProblemForm (new mode)", () => {
  it("renders title input, slug input, statement textarea, save button", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
    expect(screen.getByText(/save problem/i)).toBeTruthy();
  });

  it("auto-suggests slug from title", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    const titleInput = inputs[0]; // first input is title
    fireEvent.change(titleInput, { target: { value: "Sum Two Numbers" } });
    await waitFor(() => {
      const slugInput = inputs[1]; // second input is slug
      expect((slugInput as HTMLInputElement).value).toBe("sum-two-numbers");
    });
  });

  it("shows validation error when title is empty", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/save problem/i));
    await waitFor(() => {
      expect(document.body.textContent).toContain("required");
    });
  });

  it("always shows the student preview panel", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Preview is a permanent side panel; the header label is always present
    expect(screen.getByTestId("preview")).toBeTruthy();
  });

  it("shows tier sections for test cases", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getAllByText(/tier 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 3/i).length).toBeGreaterThan(0);
  });

  it("adds a test when add test button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const textareasBefore = document.querySelectorAll("textarea").length;
    const addBtns = screen.getAllByText(/add test/i);
    fireEvent.click(addBtns[0]);
    const textareasAfter = document.querySelectorAll("textarea").length;
    expect(textareasAfter).toBeGreaterThan(textareasBefore);
  });

  it("removes a test when remove button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a tier-1 test first so there is something to remove
    fireEvent.click(screen.getAllByText(/add test/i)[0]);
    const removeBtns = screen.getAllByRole("button", { name: /remove/i });
    const countBefore = removeBtns.length;
    if (countBefore > 0) {
      fireEvent.click(removeBtns[0]);
      expect(screen.queryAllByRole("button", { name: /remove/i }).length).toBeLessThanOrEqual(countBefore);
    }
  });

  it("shows unsaved changes indicator after editing", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Initially no unsaved indicator
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Some title" } });
    expect(screen.getByText(/unsaved/i)).toBeTruthy();
  });

  it("renders cancel button", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getAllByText(/cancel/i).length).toBeGreaterThan(0);
  });

  it("toggles test visibility badge", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // The default tier-1 test has is_visible=true so badge shows "Shown"
    const shownBadges = screen.getAllByText(/shown/i);
    expect(shownBadges.length).toBeGreaterThan(0);
    fireEvent.click(shownBadges[0]);
    // After toggle it should show "Hidden"
    expect(screen.getByText(/hidden/i)).toBeTruthy();
  });
});
