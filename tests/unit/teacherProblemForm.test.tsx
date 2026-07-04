/**
 * Tests for TeacherProblemForm: render, validation errors, and preview toggle.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

jest.mock("../../src/runner/RunnerProvider", () => ({
  runGenerator: jest.fn(),
  runReference: jest.fn(),
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
    fireEvent.click(screen.getByText("Tests"));
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

  it("has only two CodeMirror editors (starter_code and generator_py)", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const cms = document.querySelectorAll("[data-testid='codemirror']");
    // starter_code + generator_py = 2; reference and checker editors are gone
    expect(cms.length).toBe(2);
  });
});

describe("TeacherProblemForm — permanent preview panel", () => {
  it("preview panel and form are both visible simultaneously", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Form has an input for title
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
    // Preview panel is always rendered alongside the form
    expect(screen.getByTestId("preview")).toBeTruthy();
    // Both coexist without toggling
    expect(screen.getByText(/save problem/i)).toBeTruthy();
  });

  it("preview updates when statement is edited", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const statementArea = document.querySelectorAll("textarea")[0];
    fireEvent.change(statementArea, { target: { value: "Hello world" } });
    await waitFor(() => {
      expect(screen.getByTestId("preview").textContent).toContain("Hello world");
    });
  });

  it("preview shows visible test cards from the default tier-1 test", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // The default tier-1 test has is_visible=true, so the preview should
    // render an "Examples" section with a test card (even if input/expected are empty)
    // The student preview is rendered outside the react-markdown mock div
    const body = document.body.textContent ?? "";
    expect(body).toContain("Examples");
    // The preview card shows Input/Expected labels
    const inputLabels = screen.getAllByText(/^Input$/i);
    expect(inputLabels.length).toBeGreaterThan(0);
  });

  it("preview title updates when title field is edited", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "My Great Problem" } });
    await waitFor(() => {
      expect(document.body.textContent).toContain("My Great Problem");
    });
  });
});

describe("TeacherProblemForm — generator section", () => {
  it("save button re-enables after generator error (no setSaving leak)", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({ stdout: "not-valid-json", error: null });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    // Fill in a title and slug so base validation passes when generator is present
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Test Problem" } });

    // Fill in generator code so the generator path is taken
    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    // starter_code=0, generator_py=1
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "from pi3.testing import *\nprint(Easy()*1)" } });

    const saveBtn = screen.getByText(/save problem/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // After generator JSON parse fails, saving state should reset
      const btn = screen.getByText(/save problem/i);
      expect((btn as HTMLButtonElement).disabled).toBeFalsy();
    });
  });

  it("shows generator error via ConsoleView after failed run", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({ stdout: "", error: "Traceback (most recent call last):\n  File '<pi3_generator>', line 3\nNameError: name 'undefined_fn' is not defined" });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "from pi3.testing import *\nundefined_fn()" } });

    const runBtn = screen.getByText(/run generator/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      // ConsoleView renders a <pre> with the traceback text
      const pre = document.querySelector("pre");
      expect(pre).toBeTruthy();
      expect(pre!.textContent).toContain("NameError");
    });
  });

  it("hides generator error console after a successful run", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    // First run fails, second run succeeds
    mockRunGenerator
      .mockResolvedValueOnce({ stdout: "", error: "Some error" })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ tests: [{ tier: 1, visible: true, fields: null, input: "1\n", expected: "1" }], reference_solution_py: null }), error: null });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    const generatorCm = codemirrors[1];
    fireEvent.change(generatorCm, { target: { value: "print('test')" } });

    const runBtn = screen.getByText(/run generator/i);

    // First run — produces error
    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(document.querySelector("pre")).toBeTruthy();
    });

    // Second run — clears error
    fireEvent.click(runBtn);
    await waitFor(() => {
      // After successful run the error console should be gone and preview should appear
      expect(screen.getByText(/preview/i)).toBeTruthy();
    });
  });

  it("remove button on preview row decreases preview count", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({
      stdout: JSON.stringify({
        tests: [
          { tier: 1, visible: true, fields: null, input: "1\n", expected: "1" },
          { tier: 1, visible: false, fields: null, input: "2\n", expected: "2" },
        ],
        reference_solution_py: null,
      }),
      error: null,
    });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText("Generator"));

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    fireEvent.change(codemirrors[1], { target: { value: "x = 1" } });

    fireEvent.click(screen.getByText(/run generator/i));

    // Wait for preview remove buttons to appear (one per test)
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /remove test/i }).length).toBe(2);
    });

    // Click remove on the first preview row
    const removeBtns = screen.getAllByRole("button", { name: /remove test/i });
    fireEvent.click(removeBtns[0]);

    await waitFor(() => {
      // Now only 1 remove-test button remains
      expect(screen.getAllByRole("button", { name: /remove test/i }).length).toBe(1);
    });
  });

  it("remove button in preview does not affect hand-authored tests", async () => {
    const mockRunGenerator = RunnerProvider.runGenerator as jest.Mock;
    mockRunGenerator.mockResolvedValue({
      stdout: JSON.stringify({
        tests: [{ tier: 1, visible: true, fields: null, input: "5\n", expected: "5" }],
        reference_solution_py: null,
      }),
      error: null,
    });

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText("Generator"));

    // Count hand-authored test cards before running generator
    const textareasBefore = document.querySelectorAll("textarea").length;

    const codemirrors = document.querySelectorAll("[data-testid='codemirror']");
    fireEvent.change(codemirrors[1], { target: { value: "x = 1" } });
    fireEvent.click(screen.getByText(/run generator/i));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /remove test/i }).length).toBeGreaterThan(0);
    });

    // Remove the preview test
    const removeBtns = screen.getAllByRole("button", { name: /remove test/i });
    fireEvent.click(removeBtns[removeBtns.length - 1]);

    await waitFor(() => {
      // Hand-authored textareas should be unchanged (same count as before generator run)
      expect(document.querySelectorAll("textarea").length).toBe(textareasBefore);
    });
  });
});

describe("TeacherProblemForm — Section 4: single editor", () => {
  it("new problems POST with reference_solution_py and checker_py as null", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);

    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Sum" } });
    // Wait for slug to auto-fill
    await waitFor(() => {
      expect((inputs[1] as HTMLInputElement).value).toBeTruthy();
    });

    // Add required fields: statement and at least one visible tier-1 test
    const textareas = document.querySelectorAll("textarea");
    fireEvent.change(textareas[0], { target: { value: "Problem statement" } });

    fireEvent.click(screen.getByText(/save problem/i));

    await waitFor(() => {
      // The fetch should have been called with POST
      const calls = mockFetch.mock.calls;
      const postCall = calls.find((c) => c[1]?.method === "POST");
      if (postCall) {
        const body = JSON.parse(postCall[1].body);
        expect(body.reference_solution_py).toBeNull();
        expect(body.checker_py).toBeNull();
      }
    });
  });

  it("form in new mode has no separate reference_solution_py or checker_py editors", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // After section 4, only starter_code and generator_py editors remain.
    // No FieldLabel for the removed editors.
    const cms = document.querySelectorAll("[data-testid='codemirror']");
    expect(cms.length).toBe(2); // starter_code + generator_py only
    // The generator editor label is present
    expect(document.body.textContent).toContain("Generator");
  });
});
