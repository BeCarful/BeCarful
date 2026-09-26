import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ViewerControls } from "./viewer-controls";

function renderControls(
  overrides: Partial<Parameters<typeof ViewerControls>[0]> = {},
) {
  const props = {
    isAutoRotating: true,
    areDoorsOpen: false,
    isAssessmentOpen: false,
    onToggleAutoRotate: vi.fn(),
    onToggleDoors: vi.fn(),
    onResetView: vi.fn(),
    onToggleAssessment: vi.fn(),
    ...overrides,
  };
  render(<ViewerControls {...props} />);
  return props;
}

describe("ViewerControls", () => {
  it("shows the current state in labels and aria-pressed", () => {
    renderControls({ isAutoRotating: true, areDoorsOpen: false });

    expect(
      screen.getByRole("button", { name: "Auto-rotate: On" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Open doors" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("updates labels when rotation is off and doors are open", () => {
    renderControls({ isAutoRotating: false, areDoorsOpen: true });

    expect(
      screen.getByRole("button", { name: "Auto-rotate: Off" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close doors" }),
    ).toBeInTheDocument();
  });

  it("calls the matching handler for each button", async () => {
    const user = userEvent.setup();
    const props = renderControls();

    await user.click(screen.getByRole("button", { name: "Auto-rotate: On" }));
    await user.click(screen.getByRole("button", { name: "Reset view" }));
    await user.click(screen.getByRole("button", { name: "Open doors" }));
    await user.click(screen.getByRole("button", { name: "Assess photos" }));

    expect(props.onToggleAutoRotate).toHaveBeenCalledOnce();
    expect(props.onResetView).toHaveBeenCalledOnce();
    expect(props.onToggleDoors).toHaveBeenCalledOnce();
    expect(props.onToggleAssessment).toHaveBeenCalledOnce();
  });

  it("shows when the assessment panel is open", () => {
    renderControls({ isAssessmentOpen: true });

    expect(
      screen.getByRole("button", { name: "Hide assessment" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
