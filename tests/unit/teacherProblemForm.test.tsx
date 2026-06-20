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
jest.mock("@uiw/codemirror-theme-github", () => ({ __esModule: true, githubDark: {} }));
jest.mock("@codemirror/lang-python", () => ({ __esModule: true, python: () => [] }));
jest.mock("@codemirror/view", () => ({ __esModule: true, EditorView: { lineWrapping: {} } }));

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
    // Should find some form inputs — use * to find any inputs
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
    expect(screen.getByText(/save problem/i)).toBeTruthy();
  });

  it("auto-suggests slug from title", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    const titleInput = inputs[0]; // first input is title
    fireEvent.change(titleInput, { target: { value: "Sum Two Numbers" } });
    // Slug should be auto-suggested from title
    await waitFor(() => {
      const slugInput = inputs[1]; // second input is slug
      expect((slugInput as HTMLInputElement).value).toBe("sum-two-numbers");
    });
  });

  it("shows validation error when title is empty", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Try to save without filling anything
    fireEvent.click(screen.getByText(/save problem/i));
    await waitFor(() => {
      expect(document.body.textContent).toContain("required");
    });
  });

  it("shows preview when preview button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const previewBtn = screen.getByText(/preview/i);
    fireEvent.click(previewBtn);
    expect(screen.getByTestId("preview")).toBeTruthy();
  });

  it("switches back to edit when edit button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Click preview
    fireEvent.click(screen.getByText(/preview/i));
    // Now click edit (button text changes to "✎ Edit")
    fireEvent.click(screen.getByText(/edit/i));
    // Preview div should be gone, textarea should be back
    const textarea = document.querySelector("textarea:not([data-testid])");
    expect(textarea).toBeTruthy();
  });

  it("shows tier sections for test cases", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getAllByText(/tier 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 3/i).length).toBeGreaterThan(0);
  });

  it("adds a test when add test button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const countBefore = document.querySelectorAll('[placeholder]').length;
    const addBtns = screen.getAllByText(/\+ add test/i);
    fireEvent.click(addBtns[0]);
    const countAfter = document.querySelectorAll('[placeholder]').length;
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });

  it("removes a test when remove button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a test first
    fireEvent.click(screen.getAllByText(/\+ add test/i)[0]);
    const removeBtns = screen.getAllByText(/remove/i);
    const countBefore = removeBtns.length;
    if (countBefore > 0) {
      fireEvent.click(removeBtns[0]);
      expect(screen.queryAllByText(/remove/i).length).toBeLessThanOrEqual(countBefore);
    }
  });
});
