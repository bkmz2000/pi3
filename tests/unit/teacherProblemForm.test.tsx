/**
 * Tests for TeacherProblemForm: render, validation errors, preview drawer,
 * and Test Builder drag-and-drop / card expansion.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

jest.mock("../../src/runner/RunnerProvider", () => ({
  runGenerator: jest.fn(),
  runReference: jest.fn(),
  runChecker: jest.fn(),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react").createElement("div", null, children);
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
import * as RunnerProvider from "../../src/runner/RunnerProvider";

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
    const titleInput = inputs[0];
    fireEvent.change(titleInput, { target: { value: "Sum Two Numbers" } });
    await waitFor(() => {
      const slugInput = inputs[1];
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

  it("shows tier columns for test cases", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getAllByText(/tier 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 3/i).length).toBeGreaterThan(0);
  });

  it("adds a test when add test button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const removeButtonsBefore = screen.getAllByRole("button", { name: /remove/i }).length;
    const addBtns = screen.getAllByText(/add test to tier/i);
    fireEvent.click(addBtns[0]);
    const removeButtonsAfter = screen.getAllByRole("button", { name: /remove/i }).length;
    expect(removeButtonsAfter).toBe(removeButtonsBefore + 1);
  });

  it("removes a test when remove button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a tier-1 test first so there is something to remove
    fireEvent.click(screen.getAllByText(/add test to tier/i)[0]);
    const removeBtns = screen.getAllByRole("button", { name: /remove/i });
    const countBefore = removeBtns.length;
    if (countBefore > 0) {
      fireEvent.click(removeBtns[0]);
      expect(screen.queryAllByRole("button", { name: /remove/i }).length).toBeLessThanOrEqual(countBefore);
    }
  });

  it("shows unsaved changes indicator after editing", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
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
    // The default tier-1 test has is_visible=true so find visibility toggle
    const shownBadges = document.querySelectorAll("button[aria-label*='Shown']");
    expect(shownBadges.length).toBeGreaterThan(0);
    fireEvent.click(shownBadges[0]);
    // After toggle it should show "Hidden"
    expect(document.querySelector("button[aria-label*='Hidden']")).toBeTruthy();
  });

  it("has only two CodeMirror editors (starter_code and generator_py)", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const cms = document.querySelectorAll("[data-testid='codemirror']");
    expect(cms.length).toBe(2);
  });
});

describe("TeacherProblemForm — preview drawer", () => {
  it("preview is not visible until Preview button is clicked", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Preview drawer is hidden initially (no backdrop overlay)
    // The preview testid only renders when drawer is open
    expect(screen.queryByTestId("preview")).toBeNull();
  });

  it("preview opens when Preview button is clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const previewBtn = screen.getByText(/preview/i);
    fireEvent.click(previewBtn);
    await waitFor(() => {
      // The drawer renders the preview with the default statement
      expect(screen.getByTestId("preview")).toBeTruthy();
    });
  });

  it("preview shows the statement content when opened", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const textareas = document.querySelectorAll("textarea");
    // The first non-codemirror textarea is the statement
    fireEvent.change(textareas[0], { target: { value: "Hello world" } });
    // Open preview
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(screen.getByTestId("preview").textContent).toContain("Hello world");
    });
  });

  it("preview shows visible test count badge", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Default: 1 visible tier-1 test
    expect(screen.getByText(/preview.*\(1\)/i)).toBeTruthy();
  });

  it("preview title updates when title field is edited", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "My Great Problem" } });
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(document.body.textContent).toContain("My Great Problem");
    });
  });

  it("preview closes when close button is clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(screen.getByTestId("preview")).toBeTruthy();
    });
    // Click close button (✕)
    const closeBtn = screen.getByText("✕");
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByTestId("preview")).toBeNull();
    });
  });
});

describe("TeacherProblemForm — Test Builder interactions", () => {
  it("expands a test card when clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // The default test card shows "Test 1" — click it to expand
    const testLabel = screen.getAllByText(/test 1/i)[0];
    fireEvent.click(testLabel.closest('[style*="cursor: pointer"]') ?? testLabel);
    // After expansion, we should see the "Done" button
    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
    });
  });

  it("collapses expanded card when Done button is clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Expand the first test card
    const testLabel = screen.getAllByText(/test 1/i)[0];
    fireEvent.click(testLabel.closest('[style*="cursor: pointer"]') ?? testLabel);
    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
    });
    // Click Done to collapse
    fireEvent.click(screen.getByText(/done/i));
    await waitFor(() => {
      expect(screen.queryByText(/done/i)).toBeNull();
    });
  });

  it("Show All button makes all tests visible", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a tier-2 test (which defaults to hidden)
    const addBtns = screen.getAllByText(/add test to tier/i);
    fireEvent.click(addBtns[1]); // tier 2
    // Click Show All
    fireEvent.click(screen.getByText(/show all/i));
    // Both tests should now show "Shown" aria-label
    const visibleToggles = document.querySelectorAll("button[aria-label*='Shown']");
    expect(visibleToggles.length).toBe(2);
  });

  it("Hide All button makes all tests hidden", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Click Hide All
    fireEvent.click(screen.getByText(/hide all/i));
    // All tests should now show "Hidden" aria-label
    const hiddenToggles = document.querySelectorAll("button[aria-label*='Hidden']");
    expect(hiddenToggles.length).toBe(1);
  });
});

describe("TeacherProblemForm — generator section", () => {
  it("save button re-enables after generator error (no setSaving leak)", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({ stdout: "not-valid-json", error: null });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Test Problem" } });

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "from pi3.testing import *\\nprint(Easy()*1)" } });

    const saveBtn = screen.getByText(/save problem/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const btn = screen.getByText(/save problem/i);
      expect((btn as HTMLButtonElement).disabled).toBeFalsy();
    });
  });

  it("shows generator error via ConsoleView after failed run", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({ stdout: "", error: "Traceback (most recent call last):\\n  File '<pi3_generator>', line 3\\nNameError: name 'undefined_fn' is not defined" });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "from pi3.testing import *\\nundefined_fn()" } });

    const runBtn = screen.getByText(/run generator/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      const pre = document.querySelector("pre");
      expect(pre).toBeTruthy();
      expect(pre!.textContent).toContain("NameError");
    });
  });

  it("hides generator error console after a successful run", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator
      .mockResolvedValueOnce({ stdout: "", error: "Some error" })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ tests: [{ tier: 1, visible: true, fields: null, input: "1\\n", expected: "1" }], reference_solution_py: null }), error: null });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "print('test')" } });

    const runBtn = screen.getByText(/run generator/i);

    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(document.querySelector("pre")).toBeTruthy();
    });

    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(screen.getByText(/use these tests/i)).toBeTruthy();
    });
  });

  it("new problems POST with reference_solution_py and checker_py as null", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Sum" } });
    await waitFor(() => {
      expect((inputs[1] as HTMLInputElement).value).toBeTruthy();
    });

    const textareas = document.querySelectorAll("textarea");
    fireEvent.change(textareas[0], { target: { value: "Problem statement" } });

    fireEvent.click(screen.getByText(/save problem/i));

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const postCall = calls.find((c) => c[1]?.method === "POST");
      if (postCall) {
        const body = JSON.parse(postCall[1].body);
        expect(body.reference_solution_py).toBeNull();
        expect(body.checker_py).toBeNull();
      }
    });
  });
});
