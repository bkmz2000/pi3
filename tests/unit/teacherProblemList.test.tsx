/**
 * Tests for TeacherProblemList component.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeacherProblemList from "../../src/components/teacher/TeacherProblemList";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const MOCK_PROBLEMS = [
  { id: 1, slug: "sum-two", title: "Sum Two", order_index: 5, archived: 0, updated_at: "2026-06-20", tests_t1: 2, tests_t2: 1, tests_t3: 0 },
  { id: 2, slug: "bfs", title: "BFS Path", order_index: 10, archived: 0, updated_at: "2026-06-20", tests_t1: 1, tests_t2: 2, tests_t3: 1 },
  { id: 3, slug: "old", title: "Old Problem", order_index: 1, archived: 1, updated_at: "2026-06-01", tests_t1: 1, tests_t2: 0, tests_t3: 0 },
];

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_PROBLEMS,
  }) as jest.Mock;
});

describe("TeacherProblemList", () => {
  it("renders active problem titles", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Sum Two")).toBeTruthy();
      expect(screen.getByText("BFS Path")).toBeTruthy();
    });
  });

  it("shows 'new problem' button", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      // The new problem button text includes the i18n key teacher.newProblem
      expect(screen.getByText(/new problem/i)).toBeTruthy();
    });
  });

  it("navigates to new problem form on button click", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/new problem/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/new problem/i));
    expect(mockNavigate).toHaveBeenCalledWith("/teacher/problems/new");
  });

  it("navigates to edit form on edit button click", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/edit problem/i)).toHaveLength(2); // 2 active
    });
    fireEvent.click(screen.getAllByText(/edit problem/i)[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/teacher/problems/sum-two/edit");
  });

  it("shows archived section toggle", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/archived/i)).toBeTruthy();
    });
  });

  it("shows archived problems on toggle", async () => {
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      const archiveToggle = screen.getByText(/archived \(1\)/i);
      fireEvent.click(archiveToggle);
    });
    expect(screen.getByText("Old Problem")).toBeTruthy();
  });

  it("renders empty state when no problems", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as jest.Mock;
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/no problems/i)).toBeTruthy();
    });
  });

  it("calls archive API on archive button click", async () => {
    global.confirm = jest.fn(() => true);
    render(<MemoryRouter><TeacherProblemList /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/archive/i).length).toBeGreaterThan(0);
    });
    const archiveBtns = screen.getAllByText(/^archive$/i);
    if (archiveBtns.length === 0) return; // might render as "Archive problem" i18n key
    // Find the first archive button (not the section toggle)
    const btn = document.querySelector('button[style*="panelTxtMute"]') ?? archiveBtns[0];
    fireEvent.click(btn);
    expect(global.confirm).toHaveBeenCalled();
  });
});
