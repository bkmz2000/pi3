/**
 * Tests for Test Builder components: toolbar, canvas, card expansion, DnD.
 */

jest.mock("../../src/state/IdeState", () => ({
  useIde: jest.fn(() => ({})),
  useEditor: jest.fn(() => ({})),
  isExampleSessionId: jest.fn(() => false),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  useParams: () => ({ slug: undefined }),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("remark-gfm", () => ({ __esModule: true, default: () => null }));
jest.mock("remark-math", () => ({ __esModule: true, default: () => null }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: () => null }));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeacherProblemForm from "../../src/components/teacher/TeacherProblemForm";

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock;
});

describe("TestBuilderToolbar", () => {
  it("renders Preview button with visible test count badge", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Default: 1 visible test
    expect(screen.getByText(/preview.*\(1\)/i)).toBeTruthy();
  });

  it("Show All button is rendered", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getByText(/show all/i)).toBeTruthy();
  });

  it("Hide All button is rendered", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getByText(/hide all/i)).toBeTruthy();
  });

  it("Show All makes all tests visible", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a tier-2 test (defaults to hidden)
    const addBtns = screen.getAllByText(/add test to tier/i);
    fireEvent.click(addBtns[1]);
    // Click Show All
    fireEvent.click(screen.getByText(/show all/i));
    const shownBadges = document.querySelectorAll("button[aria-label*='Shown']");
    expect(shownBadges.length).toBe(2);
  });

  it("Hide All makes all tests hidden", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/hide all/i));
    const hiddenBadges = document.querySelectorAll("button[aria-label*='Hidden']");
    expect(hiddenBadges.length).toBeGreaterThanOrEqual(1);
  });
});

describe("TestBuilderCanvas", () => {
  it("renders 3 tier columns with tier labels", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.getAllByText(/tier 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tier 3/i).length).toBeGreaterThan(0);
  });

  it("each tier column shows test count badges", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Default: 1 test in tier-1, 0 in tiers 2 and 3
    // Tier 1 badge should show "1"
    const badges = document.querySelectorAll('[style*="border-radius: 999"]');
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders a test card in the correct tier column", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Default test is tier 1
    const tier1Tests = screen.getAllByText(/test 1/i);
    expect(tier1Tests.length).toBeGreaterThan(0);
  });
});

describe("TierColumn — add test", () => {
  it("each tier has an add button", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const addBtns = screen.getAllByText(/add test to tier/i);
    expect(addBtns.length).toBe(3);
  });

  it("adding a test to tier 2 creates a new test card", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const addBtns = screen.getAllByText(/add test to tier/i);
    // Click tier 2's add button
    fireEvent.click(addBtns[1]);
    // Should see new test card
    expect(screen.getAllByText(/test [12]/i).length).toBeGreaterThanOrEqual(2);
  });
});

describe("TestCard — expansion", () => {
  it("clicking a collapsed card expands it", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const testLabel = screen.getAllByText(/test 1/i)[0];
    const card = testLabel.closest('[draggable="true"]');
    if (card) fireEvent.click(card);
    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
    });
  });

  it("clicking Done on an expanded card collapses it", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const testLabel = screen.getAllByText(/test 1/i)[0];
    const card = testLabel.closest('[draggable="true"]');
    if (card) fireEvent.click(card);
    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByText(/done/i));
    await waitFor(() => {
      expect(screen.queryByText(/done/i)).toBeNull();
    });
  });

  it("only one card is expanded at a time", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    // Add a tier-1 test so we have two cards
    const addBtns = screen.getAllByText(/add test to tier/i);
    fireEvent.click(addBtns[0]); // add to tier 1

    // Expand the first card
    const test1 = screen.getAllByText(/test 1/i)[0];
    const card1 = test1.closest('[draggable="true"]');
    if (card1) fireEvent.click(card1);
    await waitFor(() => {
      expect(screen.getByText(/done/i)).toBeTruthy();
    });

    // Click the second card — should collapse first and expand second
    const test2 = screen.getAllByText(/test 2/i)[0];
    const card2 = test2.closest('[draggable="true"]');
    if (card2) fireEvent.click(card2);
    await waitFor(() => {
      // Still only one "Done" button visible
      expect(screen.getAllByText(/done/i).length).toBe(1);
    });
  });
});

describe("PreviewDrawer", () => {
  it("is not visible on initial render", () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    expect(screen.queryByTestId("preview")).toBeNull();
  });

  it("opens when Preview button is clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(screen.getByTestId("preview")).toBeTruthy();
    });
  });

  it("shows the current title in the drawer", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    const inputs = document.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "Test Title" } });
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(document.body.textContent).toContain("Test Title");
    });
  });

  it("closes when the ✕ button is clicked", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(screen.getByText("✕")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("✕"));
    await waitFor(() => {
      expect(screen.queryByTestId("preview")).toBeNull();
    });
  });

  it("shows visible test examples in the drawer", async () => {
    render(<MemoryRouter><TeacherProblemForm /></MemoryRouter>);
    fireEvent.click(screen.getByText(/preview/i));
    await waitFor(() => {
      expect(screen.getByTestId("preview")).toBeTruthy();
    });
    // The default tier-1 test is visible, so "Examples" should appear
    expect(document.body.textContent).toContain("Examples");
  });
});
