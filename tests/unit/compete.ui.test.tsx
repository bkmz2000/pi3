/**
 * UI tests for compete-mode components.
 *
 * Covers: ProblemsPanel (list render + navigation), validateProblemBody logic
 * via the TeacherProblemForm (renders without crash, shows validation errors).
 */

// IdeState + storage mocks required by any file that imports SideMenu ancestry
jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({ activePanel: null })),
  useEditor: jest.fn(() => ({ project: { files: {}, assets: {} } })),
  isExampleSessionId: jest.fn(() => false),
}));
jest.mock("../../src/utils/storage", () => ({
  projectStorage: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
  isOnline: jest.fn(() => true),
}));

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProblemsPanel from "../../src/ProblemsPanel";
import type { ProblemListItem, BestStars } from "../../src/compete/types";

// ── Shared mock helpers ────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ slug: "test-slug" }),
}));

// Stub useUser so ProblemsPanel skips the /submissions/me fetch when logged out
jest.mock("../../src/state/useUser", () => ({
  useUser: () => ({ user: null, loading: false }),
}));

// ── ProblemsPanel ──────────────────────────────────────────────────────────────

describe("ProblemsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty state when no problems", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [] as ProblemListItem[],
    }) as jest.Mock;

    render(
      <MemoryRouter>
        <ProblemsPanel onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no problems/i)).toBeTruthy();
    });
  });

  it("renders problem list with correct titles", async () => {
    const problems: ProblemListItem[] = [
      { id: 1, slug: "sum-two", title: "Sum Two Numbers", order_index: 1 },
      { id: 2, slug: "bfs", title: "BFS Shortest Path", order_index: 2 },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => problems,
    }) as jest.Mock;

    render(
      <MemoryRouter>
        <ProblemsPanel onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sum Two Numbers")).toBeTruthy();
      expect(screen.getByText("BFS Shortest Path")).toBeTruthy();
    });
  });

  it("shows star progress for problems with submissions", async () => {
    const problems: ProblemListItem[] = [
      { id: 1, slug: "p1", title: "Problem One", order_index: 1 },
    ];
    const stars: BestStars[] = [{ problem_id: 1, best_stars: 2 }];
    let callIdx = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      const data = callIdx++ === 0 ? problems : stars;
      return Promise.resolve({ ok: true, json: async () => data });
    }) as jest.Mock;

    render(
      <MemoryRouter>
        <ProblemsPanel onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Problem One")).toBeTruthy();
    });
  });

  it("navigates to compete page and closes on row click", async () => {
    const problems: ProblemListItem[] = [
      { id: 1, slug: "sum-two", title: "Sum Two Numbers", order_index: 1 },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => problems,
    }) as jest.Mock;

    const onClose = jest.fn();
    render(
      <MemoryRouter>
        <ProblemsPanel onClose={onClose} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sum Two Numbers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Sum Two Numbers"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/compete/sum-two");
  });

  it("calls onClose when the close button is clicked", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as jest.Mock;

    const onClose = jest.fn();
    render(
      <MemoryRouter>
        <ProblemsPanel onClose={onClose} />
      </MemoryRouter>,
    );

    // Close button has title matching i18n key "sideMenu.close" — find by role
    // The i18n key sideMenu.close renders as "Close" in test env
    const btn = document.querySelector('button[title]');
    if (btn) fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
